import { ProdutoModel } from '@models/Produto';
import type { ProdutoImagem } from '@/types/produto';
import { throwError } from '@utils/helpers';
import crypto from 'crypto';
import sharp from 'sharp';

export type ProdutoImage = ProdutoImagem & {
  filename: string;
  ordem: number;
  url: string;
  version: string;
  sources: Array<'database'>;
};

function imageFilename(url: string, idImagem: number) {
  const cleanUrl = url.split('?')[0];
  const filename = cleanUrl.split('/').filter(Boolean).pop();
  return filename || `imagem-${idImagem}`;
}

function toPanelImage(image: ProdutoImagem): ProdutoImage {
  return {
    ...image,
    filename: imageFilename(image.url_imagem, Number(image.id_imagem)),
    ordem: Number(image.ordem_imagem),
    url: image.url_imagem,
    version: [
      image.id_imagem,
      image.ordem_imagem,
      image.created_at || '',
    ].join(':'),
    sources: ['database'],
  };
}

function requiredEnv(name: string, fallback?: string) {
  const value = process.env[name]?.trim() || fallback;
  if (!value) {
    throwError('STORAGE_CONFIG_ERROR', `${name} nao configurado`, 500);
    throw new Error(`${name} nao configurado`);
  }
  return value;
}

function encodeS3PathPart(value: string) {
  return encodeURIComponent(value).replace(/[!'()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
}

function hashHex(value: crypto.BinaryLike) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function hmac(key: crypto.BinaryLike, value: string) {
  return crypto.createHmac('sha256', key).update(value).digest();
}

function s3SigningKey(secret: string, dateStamp: string, region: string) {
  const dateKey = hmac(`AWS4${secret}`, dateStamp);
  const regionKey = hmac(dateKey, region);
  const serviceKey = hmac(regionKey, 's3');
  return hmac(serviceKey, 'aws4_request');
}

function getStorageConfig() {
  return {
    supabaseUrl: requiredEnv('SUPABASE_URL', 'https://kabftbmncilygvpcyazc.supabase.co').replace(/\/+$/, ''),
    accessKeyId: requiredEnv('SUPABASE_S3_ACCESS_KEY_ID'),
    secretAccessKey: requiredEnv('SUPABASE_S3_SECRET_ACCESS_KEY'),
    region: requiredEnv('SUPABASE_S3_REGION', 'us-east-1'),
    bucket: requiredEnv('SUPABASE_STORAGE_BUCKET', 'imagens_produtos_maggenta-site'),
  };
}

async function uploadToSupabase(key: string, body: Buffer) {
  const config = getStorageConfig();
  const endpoint = new URL(config.supabaseUrl);
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = hashHex(body);
  const canonicalUri = `/storage/v1/s3/${encodeS3PathPart(config.bucket)}/${key
    .split('/')
    .map(encodeS3PathPart)
    .join('/')}`;
  const contentType = 'image/jpeg';
  const canonicalHeaders = [
    `content-type:${contentType}`,
    `host:${endpoint.host}`,
    `x-amz-content-sha256:${payloadHash}`,
    `x-amz-date:${amzDate}`,
  ].join('\n');
  const signedHeaders = 'content-type;host;x-amz-content-sha256;x-amz-date';
  const canonicalRequest = ['PUT', canonicalUri, '', `${canonicalHeaders}\n`, signedHeaders, payloadHash].join('\n');
  const credentialScope = `${dateStamp}/${config.region}/s3/aws4_request`;
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, credentialScope, hashHex(canonicalRequest)].join('\n');
  const signature = crypto
    .createHmac('sha256', s3SigningKey(config.secretAccessKey, dateStamp, config.region))
    .update(stringToSign)
    .digest('hex');

  const response = await fetch(`${config.supabaseUrl}${canonicalUri}`, {
    method: 'PUT',
    headers: {
      Authorization:
        `AWS4-HMAC-SHA256 Credential=${config.accessKeyId}/${credentialScope}, ` +
        `SignedHeaders=${signedHeaders}, Signature=${signature}`,
      'Content-Type': contentType,
      'x-amz-content-sha256': payloadHash,
      'x-amz-date': amzDate,
    },
    body,
  });

  if (!response.ok) {
    const responseBody = await response.text().catch(() => '');
    throwError('STORAGE_UPLOAD_ERROR', `Upload da imagem falhou: HTTP ${response.status} ${responseBody}`, 500);
  }

  return `${config.supabaseUrl}/storage/v1/object/public/${encodeS3PathPart(config.bucket)}/${key
    .split('/')
    .map(encodeS3PathPart)
    .join('/')}`;
}

function normalizeOrderedImageIds(current: ProdutoImagem[], requested: Array<number | string>) {
  const currentById = new Map(current.map((image) => [String(image.id_imagem), Number(image.id_imagem)]));
  const currentByFilename = new Map(
    current.map((image) => [imageFilename(image.url_imagem, Number(image.id_imagem)), Number(image.id_imagem)])
  );
  const currentByUrl = new Map(current.map((image) => [image.url_imagem, Number(image.id_imagem)]));

  return requested
    .map((item) => {
      const value = String(item);
      const numericId = Number(value);
      if (Number.isInteger(numericId) && numericId > 0) return numericId;
      return currentById.get(value) || currentByFilename.get(value) || currentByUrl.get(value) || 0;
    })
    .filter((id) => id > 0);
}

async function ensureProdutoExists(empresaId: number, produtoId: number) {
  const produto = await ProdutoModel.findById(empresaId, produtoId);
  if (!produto) {
    throwError('PRODUTO_NOT_FOUND', 'Produto nao encontrado', 404);
  }
}

export class ProdutoImageService {
  static async list(empresaId: number, produtoId: number): Promise<ProdutoImage[]> {
    console.log('[ProdutoImageService] list:db:start', { empresaId, produtoId });
    await ensureProdutoExists(empresaId, produtoId);

    const images = await ProdutoModel.findImagesByProductId(produtoId);
    const result = images.map(toPanelImage);

    console.log('[ProdutoImageService] list:db:ok', {
      empresaId,
      produtoId,
      imageCount: result.length,
    });

    return result;
  }

  static async reorder(
    empresaId: number,
    produtoId: number,
    orderedImages: Array<number | string>
  ): Promise<ProdutoImage[]> {
    console.log('[ProdutoImageService] reorder:db:start', { empresaId, produtoId, orderedImages });
    await ensureProdutoExists(empresaId, produtoId);

    const current = await ProdutoModel.findImagesByProductId(produtoId);
    const currentIds = current.map((image) => Number(image.id_imagem));
    const currentIdSet = new Set(currentIds);
    const requestedIds = normalizeOrderedImageIds(current, orderedImages);

    if (
      requestedIds.length !== currentIds.length ||
      new Set(requestedIds).size !== requestedIds.length ||
      requestedIds.some((id) => !currentIdSet.has(id))
    ) {
      throwError('INVALID_ORDER', 'A nova ordem deve conter todas as imagens deste produto', 400);
    }

    await ProdutoModel.reorderImages(produtoId, requestedIds);

    console.log('[ProdutoImageService] reorder:db:ok', {
      empresaId,
      produtoId,
      imageIds: requestedIds,
    });

    return this.list(empresaId, produtoId);
  }

  static async upload(
    empresaId: number,
    produtoId: number,
    files: Express.Multer.File[]
  ): Promise<ProdutoImage[]> {
    await ensureProdutoExists(empresaId, produtoId);
    if (!files.length) {
      throwError('NO_IMAGES', 'Envie ao menos uma imagem', 400);
    }

    const current = await ProdutoModel.findImagesByProductId(produtoId);
    let nextOrder = current.reduce((max, image) => Math.max(max, Number(image.ordem_imagem)), 0) + 1;

    for (const [index, file] of files.entries()) {
      const buffer = await sharp(file.buffer)
        .rotate()
        .resize({ width: 1600, withoutEnlargement: true })
        .jpeg({ quality: 90, mozjpeg: true })
        .toBuffer();
      const filename = `${produtoId}-${Date.now()}-${index + 1}.jpg`;
      const publicUrl = await uploadToSupabase(`${produtoId}/${filename}`, buffer);
      await ProdutoModel.insertImage(produtoId, publicUrl, nextOrder);
      nextOrder += 1;
    }

    return this.list(empresaId, produtoId);
  }

  static async remove(
    empresaId: number,
    produtoId: number,
    filename: string
  ): Promise<ProdutoImage[]> {
    await ensureProdutoExists(empresaId, produtoId);
    const current = await ProdutoModel.findImagesByProductId(produtoId);
    const imageId = Number(filename);
    const image = current.find((item) => {
      return Number(item.id_imagem) === imageId || imageFilename(item.url_imagem, Number(item.id_imagem)) === filename;
    });

    if (!image) {
      throwError('INVALID_IMAGE', 'Imagem invalida para este produto', 400);
      throw new Error('INVALID_IMAGE');
    }

    await ProdutoModel.deleteImage(produtoId, Number(image.id_imagem));
    const remaining = await ProdutoModel.findImagesByProductId(produtoId);
    if (remaining.length) {
      await ProdutoModel.reorderImages(produtoId, remaining.map((item) => Number(item.id_imagem)));
    }

    return this.list(empresaId, produtoId);
  }

  static async getImageBuffer(
    _empresaId: number,
    _produtoId: number,
    _filename: string,
    _folder: 'alta' | 'thumb' = 'thumb'
  ): Promise<Buffer> {
    throwError(
      'IMAGE_VIEW_DISABLED',
      'A imagem deve ser acessada pela URL cadastrada em imagens_produtos.',
      400
    );
    throw new Error('IMAGE_VIEW_DISABLED');
  }
}
