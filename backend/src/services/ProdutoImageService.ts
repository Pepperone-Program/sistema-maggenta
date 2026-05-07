import { ProdutoModel } from '@models/Produto';
import { throwError } from '@utils/helpers';
import { Client as FtpClient, enterPassiveModeIPv4 } from 'basic-ftp';
import sharp from 'sharp';
import { Readable, Writable } from 'stream';

export type ProdutoImage = {
  filename: string;
  ordem: number;
  url: string | null;
  version: string;
  sources: Array<'alta' | 'thumb'>;
};

type PreparedImage = {
  filename: string;
  altaBuffer: Buffer;
  thumbBuffer: Buffer;
};

type FtpImageFile = {
  filename: string;
  ordem: number;
  size: number;
  modifiedAt: Date | null;
};

const IMAGE_LIMIT = 8;

function maskSecret(value: string) {
  if (!value) return '';
  if (value.length <= 4) return '****';
  return `${value.slice(0, 2)}****${value.slice(-2)}`;
}

function getFtpConfig() {
  const host = process.env.FTP_HOST?.trim();
  const user = process.env.FTP_USER?.trim();
  const password = process.env.FTP_PASSWORD?.trim();

  if (!host || !user || !password) {
    throwError('FTP_CONFIG_ERROR', 'Credenciais FTP nao configuradas', 500);
  }

  return {
    host: String(host),
    port: Number(process.env.FTP_PORT || 21),
    user: String(user),
    password: String(password),
    secure: String(process.env.FTP_SECURE || 'false') === 'true',
    basePath: (process.env.FTP_BASE_PATH || 'sistema/images/produtos').replace(/\/+$/, ''),
    publicBaseUrl: process.env.FTP_PUBLIC_BASE_URL?.replace(/\/+$/, '') || '',
  };
}

function imagePattern(produtoId: number) {
  return new RegExp(`^${produtoId}-(\\d+)\\.jpe?g$`, 'i');
}

function buildImageUrl(publicBaseUrl: string, filename: string) {
  return publicBaseUrl ? `${publicBaseUrl}/thumb/${filename}` : null;
}

async function withFtp<T>(task: (client: FtpClient, cfg: ReturnType<typeof getFtpConfig>) => Promise<T>) {
  const cfg = getFtpConfig();
  const client = new FtpClient();
  client.ftp.verbose = false;
  client.prepareTransfer = enterPassiveModeIPv4;

  try {
    console.log('[ProdutoImageService][ftp] access:start', {
      host: cfg.host,
      port: cfg.port,
      user: cfg.user,
      password_masked: maskSecret(cfg.password),
      password_length: cfg.password.length,
      password_has_hash: cfg.password.includes('#'),
      secure: cfg.secure,
      basePath: cfg.basePath,
      publicBaseUrl_configured: Boolean(cfg.publicBaseUrl),
    });

    await client.access({
      host: cfg.host,
      port: cfg.port,
      user: cfg.user,
      password: cfg.password,
      secure: cfg.secure,
      secureOptions: cfg.secure ? { rejectUnauthorized: false } : undefined,
    });
    console.log('[ProdutoImageService][ftp] access:ok');
    await client.cd('/');
    console.log('[ProdutoImageService][ftp] cd:/ ok');
    await client.ensureDir(cfg.basePath);
    console.log('[ProdutoImageService][ftp] ensureDir:base ok', {
      basePath: cfg.basePath,
      pwd: await client.pwd().catch(() => 'pwd_failed'),
    });
    return await task(client, cfg);
  } catch (error) {
    const err = error as any;
    console.error('[ProdutoImageService][ftp] error', {
      code: err?.code,
      message: err?.message,
      stack: err?.stack,
    });
    throw error;
  } finally {
    console.log('[ProdutoImageService][ftp] close');
    client.close();
  }
}

async function ensureProdutoExists(empresaId: number, produtoId: number) {
  console.log('[ProdutoImageService] ensureProdutoExists:start', { empresaId, produtoId });
  const produto = await ProdutoModel.findById(empresaId, produtoId);
  if (!produto) {
    console.warn('[ProdutoImageService] ensureProdutoExists:not_found', { empresaId, produtoId });
    throwError('PRODUTO_NOT_FOUND', 'Produto nao encontrado', 404);
  }
  if (!produto) return;
  console.log('[ProdutoImageService] ensureProdutoExists:ok', {
    empresaId,
    produtoId,
    codigo: produto.codigo,
    imagem: produto.imagem,
  });
}

async function listFilenames(client: FtpClient, produtoId: number) {
  return listFilenamesInFolder(client, produtoId, 'alta');
}

async function listFilenamesInFolder(
  client: FtpClient,
  produtoId: number,
  folder: 'alta' | 'thumb'
): Promise<FtpImageFile[]> {
  console.log('[ProdutoImageService] listFilenames:start', { produtoId, folder });
  await client.ensureDir(folder);
  const files = await client.list();
  await client.cd('..');

  const pattern = imagePattern(produtoId);
  const result = files
    .map((file) => {
      const match = file.name.match(pattern);
      return match
        ? {
            filename: file.name,
            ordem: Number(match[1]),
            size: Number(file.size || 0),
            modifiedAt: file.modifiedAt || null,
          }
        : null;
    })
    .filter((item): item is FtpImageFile => Boolean(item))
    .sort((a, b) => a.ordem - b.ordem);

  console.log('[ProdutoImageService] listFilenames:ok', {
    produtoId,
    folder,
    totalFtpItems: files.length,
    productImages: result,
  });
  return result;
}

async function listProductImages(
  client: FtpClient,
  cfg: ReturnType<typeof getFtpConfig>,
  produtoId: number
): Promise<ProdutoImage[]> {
  const altaFiles = await listFilenamesInFolder(client, produtoId, 'alta');
  const thumbFiles = await listFilenamesInFolder(client, produtoId, 'thumb');
  const byName = new Map<string, { filename: string; ordem: number; alta?: FtpImageFile; thumb?: FtpImageFile }>();

  for (const file of altaFiles) {
    byName.set(file.filename, {
      filename: file.filename,
      ordem: file.ordem,
      alta: file,
    });
  }

  for (const file of thumbFiles) {
    const existing = byName.get(file.filename);
    if (existing) {
      existing.ordem = Math.min(existing.ordem, file.ordem);
      existing.thumb = file;
      continue;
    }

    byName.set(file.filename, {
      filename: file.filename,
      ordem: file.ordem,
      thumb: file,
    });
  }

  const images = Array.from(byName.values())
    .sort((a, b) => a.ordem - b.ordem)
    .map((file) => {
      const meta = file.thumb || file.alta;
      const sources: Array<'alta' | 'thumb'> = [];
      if (file.alta) sources.push('alta');
      if (file.thumb) sources.push('thumb');
      const version = [
        file.filename,
        meta?.size || 0,
        meta?.modifiedAt?.getTime() || 0,
      ].join(':');

      return {
        filename: file.filename,
        ordem: file.ordem,
        version,
        sources,
        url:
          buildImageUrl(cfg.publicBaseUrl, file.filename) ||
          `/api/v1/produtos/${produtoId}/images/${encodeURIComponent(file.filename)}/view?folder=thumb`,
      };
    });

  console.log('[ProdutoImageService] listProductImages:filtered', {
    produtoId,
    alta: altaFiles.map((file) => file.filename),
    thumb: thumbFiles.map((file) => file.filename),
    result: images.map((file) => ({ filename: file.filename, sources: file.sources })),
  });

  return images;
}

async function syncMainImageColumn(empresaId: number, produtoId: number) {
  console.log('[ProdutoImageService] syncMainImageColumn:start', { empresaId, produtoId });
  const images = await withFtp((client) => listFilenames(client, produtoId));
  await ProdutoModel.updateImage(empresaId, produtoId, images[0]?.filename || null);
  console.log('[ProdutoImageService] syncMainImageColumn:ok', {
    empresaId,
    produtoId,
    imagem: images[0]?.filename || null,
  });
}

async function prepareUpload(produtoId: number, files: Express.Multer.File[], startOrder: number) {
  return Promise.all(
    files.map(async (file, index): Promise<PreparedImage> => {
      const base = sharp(file.buffer).rotate();
      const altaBuffer = await base
        .clone()
        .resize({ width: 1600, withoutEnlargement: true })
        .jpeg({ quality: 90, mozjpeg: true })
        .toBuffer();
      const thumbBuffer = await base
        .clone()
        .resize(300, 300, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 90 })
        .toBuffer();

      return {
        filename: `${produtoId}-${startOrder + index}.jpg`,
        altaBuffer,
        thumbBuffer,
      };
    })
  );
}

async function uploadPrepared(client: FtpClient, folder: 'alta' | 'thumb', items: PreparedImage[]) {
  await client.ensureDir(folder);
  for (const item of items) {
    const buffer = folder === 'alta' ? item.altaBuffer : item.thumbBuffer;
    console.log('[ProdutoImageService] upload:file', { folder, filename: item.filename, bytes: buffer.length });
    await client.uploadFrom(Readable.from(buffer), item.filename);
  }
  await client.cd('..');
}

async function downloadFileBuffer(client: FtpClient, filename: string) {
  const chunks: Buffer[] = [];
  const writable = new Writable({
    write(chunk, _encoding, callback) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      callback();
    },
  });

  await client.downloadTo(writable, filename);
  return Buffer.concat(chunks);
}

async function removeFolderProductImages(
  client: FtpClient,
  produtoId: number,
  folder: 'alta' | 'thumb',
  opts: { ignoreErrors?: boolean } = {}
) {
  const files = await listFilenamesInFolder(client, produtoId, folder);
  await client.ensureDir(folder);
  for (const file of files) {
    try {
      await client.remove(file.filename);
    } catch (error) {
      const err = error as any;
      console.warn('[ProdutoImageService] removeFolderProductImages:remove_failed', {
        folder,
        filename: file.filename,
        code: err?.code,
        message: err?.message,
      });
      if (!opts.ignoreErrors) throw error;
    }
  }
  await client.cd('..');
}

async function rewriteFolderOrder(
  client: FtpClient,
  produtoId: number,
  folder: 'alta' | 'thumb',
  requested: string[]
) {
  const existing = await listFilenamesInFolder(client, produtoId, folder);
  const existingNames = new Set(existing.map((image) => image.filename));
  const orderedExisting = requested.filter((filename) => existingNames.has(filename));

  if (folder === 'alta' && orderedExisting.length !== requested.length) {
    throwError('INVALID_ORDER', 'A nova ordem contem imagens que nao existem no FTP', 400);
  }

  await client.ensureDir(folder);
  const buffers: Array<{ filename: string; buffer: Buffer }> = [];
  for (const filename of orderedExisting) {
    buffers.push({ filename, buffer: await downloadFileBuffer(client, filename) });
  }
  await client.cd('..');

  await client.ensureDir(folder);
  const tempPrefix = `${produtoId}-reorder-${Date.now()}`;
  const tempFiles: string[] = [];
  for (const [index, item] of buffers.entries()) {
    const tempFilename = `${tempPrefix}-${index}.jpg`;
    tempFiles.push(tempFilename);
    console.log('[ProdutoImageService] rewriteFolderOrder:upload_temp', {
      folder,
      from: item.filename,
      to: tempFilename,
      bytes: item.buffer.length,
    });
    await client.uploadFrom(Readable.from(item.buffer), tempFilename);
  }
  await client.cd('..');

  await removeFolderProductImages(client, produtoId, folder);

  await client.ensureDir(folder);
  for (const [index, tempFilename] of tempFiles.entries()) {
    const filename = `${produtoId}-${index + 1}.jpg`;
    console.log('[ProdutoImageService] rewriteFolderOrder:rename_final', {
      folder,
      from: tempFilename,
      to: filename,
    });
    await client.rename(tempFilename, filename);
  }
  await client.cd('..');
}

export class ProdutoImageService {
  static async list(empresaId: number, produtoId: number): Promise<ProdutoImage[]> {
    console.log('[ProdutoImageService] list:start', { empresaId, produtoId });
    await ensureProdutoExists(empresaId, produtoId);

    const images = await withFtp(async (client, cfg) => {
      return listProductImages(client, cfg, produtoId);
    });
    console.log('[ProdutoImageService] list:ok', { empresaId, produtoId, images });
    return images;
  }

  static async upload(
    empresaId: number,
    produtoId: number,
    files: Express.Multer.File[]
  ): Promise<ProdutoImage[]> {
    console.log('[ProdutoImageService] upload:start', {
      empresaId,
      produtoId,
      fileCount: files.length,
      files: files.map((file) => ({
        originalname: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
      })),
    });
    await ensureProdutoExists(empresaId, produtoId);
    if (!files.length) {
      throwError('NO_IMAGES', 'Envie ao menos uma imagem', 400);
    }

    await withFtp(async (client) => {
      const existing = await listFilenames(client, produtoId);
      const availableSlots = IMAGE_LIMIT - existing.length;
      if (availableSlots <= 0) {
        throwError('IMAGE_LIMIT', `Limite de ${IMAGE_LIMIT} imagens atingido`, 400);
      }

      const selectedFiles = files.slice(0, availableSlots);
      const nextOrder = existing.reduce((max, image) => Math.max(max, image.ordem), 0) + 1;
      const prepared = await prepareUpload(produtoId, selectedFiles, nextOrder);
      console.log('[ProdutoImageService] upload:prepared', {
        produtoId,
        existing: existing.map((image) => image.filename),
        availableSlots,
        nextOrder,
        prepared: prepared.map((image) => image.filename),
      });

      await uploadPrepared(client, 'alta', prepared);
      await uploadPrepared(client, 'thumb', prepared);
    });

    await syncMainImageColumn(empresaId, produtoId);
    return this.list(empresaId, produtoId);
  }

  static async remove(
    empresaId: number,
    produtoId: number,
    filename: string
  ): Promise<ProdutoImage[]> {
    console.log('[ProdutoImageService] remove:start', { empresaId, produtoId, filename });
    await ensureProdutoExists(empresaId, produtoId);
    const pattern = imagePattern(produtoId);
    if (!pattern.test(filename)) {
      throwError('INVALID_IMAGE', 'Imagem invalida para este produto', 400);
    }

    await withFtp(async (client) => {
      for (const folder of ['alta', 'thumb'] as const) {
        await client.ensureDir(folder);
        await client.remove(filename).catch(() => undefined);
        await client.cd('..');
      }
    });

    const remaining = await this.list(empresaId, produtoId);
    await this.reorder(empresaId, produtoId, remaining.map((image) => image.filename));
    return this.list(empresaId, produtoId);
  }

  static async reorder(
    empresaId: number,
    produtoId: number,
    filenames: string[]
  ): Promise<ProdutoImage[]> {
    console.log('[ProdutoImageService] reorder:start', { empresaId, produtoId, filenames });
    await ensureProdutoExists(empresaId, produtoId);

    await withFtp(async (client) => {
      const existing = await listFilenames(client, produtoId);
      const existingNames = new Set(existing.map((image) => image.filename));
      const requested = filenames.filter((filename) => existingNames.has(filename));
      console.log('[ProdutoImageService] reorder:existing', {
        produtoId,
        existing: existing.map((image) => image.filename),
        requested,
      });

      if (requested.length !== existing.length) {
        throwError('INVALID_ORDER', 'A nova ordem deve conter todas as imagens existentes', 400);
      }

      await rewriteFolderOrder(client, produtoId, 'alta', requested);
      await rewriteFolderOrder(client, produtoId, 'thumb', requested);
    });

    await syncMainImageColumn(empresaId, produtoId);
    return this.list(empresaId, produtoId);
  }

  static async getImageBuffer(
    empresaId: number,
    produtoId: number,
    filename: string,
    folder: 'alta' | 'thumb' = 'thumb'
  ): Promise<Buffer> {
    console.log('[ProdutoImageService] getImageBuffer:start', { empresaId, produtoId, filename, folder });
    await ensureProdutoExists(empresaId, produtoId);

    const pattern = imagePattern(produtoId);
    if (!pattern.test(filename)) {
      throwError('INVALID_IMAGE', 'Imagem invalida para este produto', 400);
    }

    return withFtp(async (client) => {
      await client.ensureDir(folder);
      let buffer: Buffer;
      try {
        buffer = await downloadFileBuffer(client, filename);
      } catch (error) {
        if (folder !== 'thumb') throw error;
        await client.cd('..');
        await client.ensureDir('alta');
        buffer = await downloadFileBuffer(client, filename);
      }
      await client.cd('..');
      console.log('[ProdutoImageService] getImageBuffer:ok', {
        empresaId,
        produtoId,
        filename,
        folder,
        bytes: buffer.length,
      });
      return buffer;
    });
  }
}
