import crypto from 'crypto';
import dotenv from 'dotenv';
import { Client as FtpClient, enterPassiveModeIPv4 } from 'basic-ftp';
import fs from 'fs/promises';
import path from 'path';
import { Writable } from 'stream';
import pool, { query } from '../database/connection';

dotenv.config();

type FtpBannerImage = {
  filename: string;
  idBanner: number;
  size: number;
};

type ImportStats = {
  rawFtpItemsListed: number;
  totalFtpItems: number;
  validImages: number;
  invalidNames: number;
  ftpProbeFound: number;
  skippedMissingBanner: number;
  skippedExistingUrl: number;
  uploaded: number;
  updated: number;
  verified: number;
  failed: number;
};

type Config = {
  ftpHost: string;
  ftpPort: number;
  ftpUser: string;
  ftpPassword: string;
  ftpSecure: boolean;
  ftpRemotePath: string;
  supabaseUrl: string;
  supabaseS3AccessKeyId: string;
  supabaseS3SecretAccessKey: string;
  supabaseS3Region: string;
  supabaseBucket: string;
  batchSize: number;
  batchPauseMs: number;
  concurrency: number;
  maxRetries: number;
  requireBannerExists: boolean;
  overwriteExistingUrl: boolean;
  verifyUpload: boolean;
  ftpListPrefixes: string[];
  directProbeFromDatabase: boolean;
  auditDir: string;
};

type BannerPlan = {
  idBanner: number;
  filename: string;
  size: number;
  existingUrl: string | null;
  publicUrl: string;
  action: 'process' | 'skip_existing_url' | 'skip_missing_banner';
};

const stats: ImportStats = {
  rawFtpItemsListed: 0,
  totalFtpItems: 0,
  validImages: 0,
  invalidNames: 0,
  ftpProbeFound: 0,
  skippedMissingBanner: 0,
  skippedExistingUrl: 0,
  uploaded: 0,
  updated: 0,
  verified: 0,
  failed: 0,
};

function log(message: string, data: Record<string, unknown> = {}) {
  const details = Object.entries(data)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${key}=${Array.isArray(value) || typeof value === 'object' ? JSON.stringify(value) : value}`)
    .join(' | ');

  console.log(`[${new Date().toLocaleString('pt-BR')}] ${message}${details ? ` | ${details}` : ''}`);
}

function fail(message: string): never {
  throw new Error(message);
}

function requiredEnv(name: string, fallback?: string) {
  const value = process.env[name]?.trim() || fallback || '';
  if (!value) fail(`Variavel de ambiente obrigatoria ausente: ${name}`);
  return value;
}

function numberEnv(name: string, fallback: number) {
  const value = process.env[name]?.trim();
  if (!value) return fallback;

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    fail(`Variavel ${name} deve ser um numero positivo`);
  }

  return parsed;
}

function booleanEnv(name: string, fallback: boolean) {
  const value = process.env[name]?.trim().toLowerCase();
  if (!value) return fallback;
  return ['1', 'true', 's', 'sim', 'yes', 'y'].includes(value);
}

function csvEnv(name: string, fallback: string[]) {
  const value = process.env[name]?.trim();
  if (!value) return fallback;

  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function getConfig(): Config {
  return {
    ftpHost: requiredEnv('FTP_HOST'),
    ftpPort: numberEnv('FTP_PORT', 21),
    ftpUser: requiredEnv('FTP_USER'),
    ftpPassword: requiredEnv('FTP_PASSWORD'),
    ftpSecure: String(process.env.FTP_SECURE || 'false') === 'true',
    ftpRemotePath: (process.env.BANNER_IMAGES_FTP_PATH || 'sistema/images/banners')
      .replace(/^\/+/, '')
      .replace(/\/+$/, ''),
    supabaseUrl: requiredEnv('SUPABASE_URL', 'https://kabftbmncilygvpcyazc.supabase.co').replace(/\/+$/, ''),
    supabaseS3AccessKeyId: requiredEnv('SUPABASE_S3_ACCESS_KEY_ID'),
    supabaseS3SecretAccessKey: requiredEnv('SUPABASE_S3_SECRET_ACCESS_KEY'),
    supabaseS3Region: requiredEnv('SUPABASE_S3_REGION', 'us-east-1'),
    supabaseBucket: requiredEnv('BANNER_IMAGES_SUPABASE_BUCKET', 'banners-site-maggenta'),
    batchSize: numberEnv('BANNER_IMAGES_BATCH_SIZE', 200),
    batchPauseMs: numberEnv('BANNER_IMAGES_BATCH_PAUSE_MS', 10000),
    concurrency: numberEnv('BANNER_IMAGES_CONCURRENCY', 4),
    maxRetries: numberEnv('BANNER_IMAGES_MAX_RETRIES', 3),
    requireBannerExists: booleanEnv('BANNER_IMAGES_REQUIRE_BANNER_EXISTS', true),
    overwriteExistingUrl: booleanEnv('BANNER_IMAGES_OVERWRITE_EXISTING_URL', true),
    verifyUpload: booleanEnv('BANNER_IMAGES_VERIFY_UPLOAD', true),
    ftpListPrefixes: csvEnv('BANNER_IMAGES_FTP_LIST_PREFIXES', ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9']),
    directProbeFromDatabase: booleanEnv('BANNER_IMAGES_DIRECT_PROBE_FROM_DATABASE', true),
    auditDir: process.env.BANNER_IMAGES_AUDIT_DIR?.trim() || 'logs/banner-images-import',
  };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function connectFtp(config: Config) {
  const client = new FtpClient(30000, { maxListingBytes: 100 * 1024 * 1024 });
  client.ftp.verbose = false;
  client.prepareTransfer = enterPassiveModeIPv4;

  await client.access({
    host: config.ftpHost,
    port: config.ftpPort,
    user: config.ftpUser,
    password: config.ftpPassword,
    secure: config.ftpSecure,
    secureOptions: config.ftpSecure ? { rejectUnauthorized: false } : undefined,
  });

  await client.cd('/');
  await client.cd(config.ftpRemotePath);
  return client;
}

function parseBannerImage(filename: string, size: number): FtpBannerImage | null {
  const match = filename.match(/^(\d+)\.jpe?g$/i);
  if (!match) return null;

  return {
    filename,
    idBanner: Number(match[1]),
    size,
  };
}

function addFtpItem(
  itemsByName: Map<string, { name: string; size?: number; isDirectory?: boolean }>,
  item: { name: string; size?: number; isDirectory?: boolean }
) {
  const normalized = item.name.trim();
  if (!normalized || normalized === '.' || normalized === '..') return;
  itemsByName.set(normalized, { ...item, name: normalized });
}

async function listWithCommand(
  client: FtpClient,
  command: string
): Promise<Array<{ name: string; size?: number; isDirectory?: boolean }>> {
  const internalClient = client as unknown as {
    _requestListWithCommand(command: string): Promise<Array<{ name: string; size?: number; isDirectory?: boolean }>>;
  };

  await client.prepareTransfer(client.ftp);
  return internalClient._requestListWithCommand(command);
}

async function listFtpImages(config: Config) {
  const client = await connectFtp(config);

  try {
    const ftpItemsByName = new Map<string, { name: string; size?: number; isDirectory?: boolean }>();

    log('Consultando listagem principal do FTP');
    const rootItems = await client.list();
    stats.rawFtpItemsListed += rootItems.length;
    for (const item of rootItems) addFtpItem(ftpItemsByName, item);

    for (const command of ['MLSD', 'NLST', 'LIST']) {
      try {
        const commandItems = await listWithCommand(client, command);
        stats.rawFtpItemsListed += commandItems.length;
        for (const item of commandItems) addFtpItem(ftpItemsByName, item);
      } catch (error) {
        log('Comando alternativo de listagem falhou', {
          comando: command,
          erro: error instanceof Error ? error.message : String(error),
        });
      }
    }

    for (const prefix of config.ftpListPrefixes) {
      try {
        const prefixedItems = await client.list(`${prefix}*`);
        stats.rawFtpItemsListed += prefixedItems.length;
        for (const item of prefixedItems) addFtpItem(ftpItemsByName, item);
      } catch (error) {
        log('Listagem por prefixo falhou', {
          prefixo: prefix,
          erro: error instanceof Error ? error.message : String(error),
        });
      }
    }

    const images: FtpBannerImage[] = [];
    for (const item of ftpItemsByName.values()) {
      if (item.isDirectory) continue;

      const image = parseBannerImage(item.name, Number(item.size || 0));
      if (!image) {
        stats.invalidNames += 1;
        if (stats.invalidNames <= 100) log('Arquivo ignorado por nome invalido', { arquivo: item.name });
        continue;
      }

      images.push(image);
    }

    images.sort((a, b) => a.idBanner - b.idBanner || a.filename.localeCompare(b.filename));
    stats.totalFtpItems = ftpItemsByName.size;
    stats.validImages = images.length;

    log('Listagem unica concluida', {
      leituras: stats.rawFtpItemsListed,
      arquivosUnicos: stats.totalFtpItems,
      imagensValidas: stats.validImages,
      nomesInvalidos: stats.invalidNames,
    });

    return images;
  } finally {
    client.close();
  }
}

async function getAllBanners() {
  const rows = (await query(
    `
      SELECT id_banner, url_banner
      FROM banners
      ORDER BY id_banner
    `
  )) as Array<{ id_banner: number; url_banner: string | null }>;

  return rows.map((row) => ({
    idBanner: Number(row.id_banner),
    urlBanner: row.url_banner,
  }));
}

async function probeBannersFromDatabase(config: Config, banners: Array<{ idBanner: number; urlBanner: string | null }>) {
  const client = await connectFtp(config);
  const byName = new Map<string, FtpBannerImage>();

  try {
    log('Consulta direta por id_banner iniciada', { banners: banners.length });

    for (const banner of banners) {
      for (const extension of ['jpg', 'jpeg']) {
        const filename = `${banner.idBanner}.${extension}`;

        try {
          const size = await client.size(filename);
          byName.set(filename, {
            filename,
            idBanner: banner.idBanner,
            size: Number(size || 0),
          });
          break;
        } catch {
          // Arquivo ausente ou servidor sem SIZE para este nome/extensao.
        }
      }
    }

    stats.ftpProbeFound = byName.size;
    log('Consulta direta por id_banner finalizada', { encontrados: byName.size });
    return Array.from(byName.values()).sort((a, b) => a.idBanner - b.idBanner);
  } finally {
    client.close();
  }
}

function mergeImages(...groups: FtpBannerImage[][]) {
  const byName = new Map<string, FtpBannerImage>();
  for (const group of groups) {
    for (const image of group) byName.set(image.filename, image);
  }
  return Array.from(byName.values()).sort((a, b) => a.idBanner - b.idBanner || a.filename.localeCompare(b.filename));
}

function encodeS3PathPart(value: string) {
  return encodeURIComponent(value).replace(/[!'()*]/g, (char) =>
    `%${char.charCodeAt(0).toString(16).toUpperCase()}`
  );
}

function hashHex(value: crypto.BinaryLike) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function hmac(key: crypto.BinaryLike, value: string) {
  return crypto.createHmac('sha256', key).update(value).digest();
}

function s3SigningKey(secretAccessKey: string, dateStamp: string, region: string) {
  const dateKey = hmac(`AWS4${secretAccessKey}`, dateStamp);
  const regionKey = hmac(dateKey, region);
  const serviceKey = hmac(regionKey, 's3');
  return hmac(serviceKey, 'aws4_request');
}

async function uploadToSupabaseS3(config: Config, key: string, body: Buffer) {
  const endpoint = new URL(config.supabaseUrl);
  const host = endpoint.host;
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = hashHex(body);
  const canonicalUri = `/storage/v1/s3/${encodeS3PathPart(config.supabaseBucket)}/${key
    .split('/')
    .map(encodeS3PathPart)
    .join('/')}`;
  const contentType = 'image/jpeg';
  const canonicalHeaders = [
    `content-type:${contentType}`,
    `host:${host}`,
    `x-amz-content-sha256:${payloadHash}`,
    `x-amz-date:${amzDate}`,
  ].join('\n');
  const signedHeaders = 'content-type;host;x-amz-content-sha256;x-amz-date';
  const canonicalRequest = ['PUT', canonicalUri, '', `${canonicalHeaders}\n`, signedHeaders, payloadHash].join('\n');
  const credentialScope = `${dateStamp}/${config.supabaseS3Region}/s3/aws4_request`;
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, credentialScope, hashHex(canonicalRequest)].join('\n');
  const signature = crypto
    .createHmac('sha256', s3SigningKey(config.supabaseS3SecretAccessKey, dateStamp, config.supabaseS3Region))
    .update(stringToSign)
    .digest('hex');
  const authorization =
    `AWS4-HMAC-SHA256 Credential=${config.supabaseS3AccessKeyId}/${credentialScope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const response = await fetch(`${config.supabaseUrl}${canonicalUri}`, {
    method: 'PUT',
    headers: {
      Authorization: authorization,
      'Content-Type': contentType,
      'x-amz-content-sha256': payloadHash,
      'x-amz-date': amzDate,
    },
    body,
  });

  if (!response.ok) {
    const responseBody = await response.text().catch(() => '');
    throw new Error(`Supabase upload falhou: HTTP ${response.status} ${response.statusText} ${responseBody}`);
  }
}

function buildPublicUrl(config: Config, key: string) {
  return `${config.supabaseUrl}/storage/v1/object/public/${encodeS3PathPart(config.supabaseBucket)}/${key
    .split('/')
    .map(encodeS3PathPart)
    .join('/')}`;
}

async function downloadFtpBuffer(client: FtpClient, filename: string) {
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

async function verifyPublicUpload(config: Config, publicUrl: string, original: Buffer) {
  if (!config.verifyUpload) return;

  const originalHash = hashHex(original);
  const originalLength = original.length;

  await withRetry(config, `supabase.verify:${publicUrl}`, async () => {
    const verifyUrl = new URL(publicUrl);
    verifyUrl.searchParams.set('_verify', String(Date.now()));
    const response = await fetch(verifyUrl);
    if (!response.ok) {
      throw new Error(`Verificacao falhou: HTTP ${response.status} ${response.statusText}`);
    }

    const uploaded = Buffer.from(await response.arrayBuffer());
    const uploadedHash = hashHex(uploaded);
    if (uploaded.length !== originalLength || uploadedHash !== originalHash) {
      throw new Error(
        `Arquivo no bucket diverge do original: original=${originalLength}/${originalHash}, bucket=${uploaded.length}/${uploadedHash}`
      );
    }
  });

  stats.verified += 1;
}

async function withRetry<T>(config: Config, label: string, task: (attempt: number) => Promise<T>) {
  let lastError: unknown;

  for (let attempt = 1; attempt <= config.maxRetries; attempt += 1) {
    try {
      return await task(attempt);
    } catch (error) {
      lastError = error;
      log('Tentativa falhou, tentando novamente se houver limite', {
        operacao: label,
        tentativa: attempt,
        maxTentativas: config.maxRetries,
        erro: error instanceof Error ? error.message : String(error),
      });

      if (attempt < config.maxRetries) {
        await sleep(Math.min(30000, 1000 * attempt * attempt));
      }
    }
  }

  throw lastError;
}

async function updateBannerUrl(idBanner: number, publicUrl: string) {
  const result = (await query(
    `
      UPDATE banners
      SET url_banner = ?
      WHERE id_banner = ?
    `,
    [publicUrl, idBanner]
  )) as { affectedRows: number };

  return result.affectedRows === 1;
}

function buildPlan(
  config: Config,
  images: FtpBannerImage[],
  banners: Array<{ idBanner: number; urlBanner: string | null }>
) {
  const bannersById = new Map(banners.map((banner) => [banner.idBanner, banner.urlBanner]));

  return images.map((image): BannerPlan => {
    const publicUrl = buildPublicUrl(config, image.filename);
    const existingUrl = bannersById.get(image.idBanner);
    let action: BannerPlan['action'] = 'process';

    if (existingUrl === undefined && config.requireBannerExists) {
      action = 'skip_missing_banner';
      stats.skippedMissingBanner += 1;
    } else if (existingUrl === publicUrl && !config.overwriteExistingUrl) {
      action = 'skip_existing_url';
      stats.skippedExistingUrl += 1;
    }

    return {
      idBanner: image.idBanner,
      filename: image.filename,
      size: image.size,
      existingUrl: existingUrl ?? null,
      publicUrl,
      action,
    };
  });
}

async function writeAuditJson(config: Config, images: FtpBannerImage[], plan: BannerPlan[]) {
  const absoluteAuditDir = path.resolve(process.cwd(), config.auditDir);
  await fs.mkdir(absoluteAuditDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const auditPath = path.join(absoluteAuditDir, `banner-images-${timestamp}.json`);

  await fs.writeFile(
    auditPath,
    JSON.stringify(
      {
        generated_at: new Date().toISOString(),
        counts: {
          raw_ftp_items_listed: stats.rawFtpItemsListed,
          total_ftp_items: stats.totalFtpItems,
          valid_images: stats.validImages,
          invalid_names: stats.invalidNames,
          ftp_probe_found: stats.ftpProbeFound,
          planned_to_process: plan.filter((item) => item.action === 'process').length,
          skipped_missing_banner: stats.skippedMissingBanner,
          skipped_existing_url: stats.skippedExistingUrl,
        },
        all_files: images.map((image) => image.filename),
        plan,
      },
      null,
      2
    )
  );

  log('JSON de auditoria gerado', { caminho: auditPath, arquivos: images.length });
}

async function processBanner(config: Config, client: FtpClient, item: BannerPlan, sequence: number, total: number) {
  log('Banner iniciado', {
    sequencia: sequence,
    total,
    arquivo: item.filename,
    idBanner: item.idBanner,
    bytesNoFtp: item.size,
  });

  const buffer = await withRetry(config, `ftp.download:${item.filename}`, () => downloadFtpBuffer(client, item.filename));
  log('Banner baixado do FTP', { arquivo: item.filename, bytes: buffer.length });

  await withRetry(config, `supabase.upload:${item.filename}`, () => uploadToSupabaseS3(config, item.filename, buffer));
  stats.uploaded += 1;

  await verifyPublicUpload(config, item.publicUrl, buffer);
  log('Banner enviado ao bucket', { arquivo: item.filename, publicUrl: item.publicUrl, verificado: config.verifyUpload });

  const updated = await withRetry(config, `mysql.update:${item.filename}`, () => updateBannerUrl(item.idBanner, item.publicUrl));
  if (!updated) {
    throw new Error(`Nenhum banner atualizado para id_banner=${item.idBanner}`);
  }

  stats.updated += 1;
  log('Banner atualizado no banco', { idBanner: item.idBanner, urlBanner: item.publicUrl });
}

async function processBatch(config: Config, batch: BannerPlan[], offset: number, total: number) {
  let nextIndex = 0;

  async function worker(workerId: number) {
    const client = await connectFtp(config);
    log('Worker conectado ao FTP', { workerId });

    try {
      while (nextIndex < batch.length) {
        const currentIndex = nextIndex;
        nextIndex += 1;
        const item = batch[currentIndex];

        try {
          await processBanner(config, client, item, offset + currentIndex + 1, total);
        } catch (error) {
          stats.failed += 1;
          log('Banner falhou', {
            arquivo: item.filename,
            idBanner: item.idBanner,
            erro: error instanceof Error ? error.message : String(error),
          });
        }
      }
    } finally {
      client.close();
      log('Worker fechado', { workerId });
    }
  }

  const workerCount = Math.min(config.concurrency, batch.length);
  await Promise.all(Array.from({ length: workerCount }, (_, index) => worker(index + 1)));
}

async function processPendingBanners(config: Config, pending: BannerPlan[]) {
  if (!pending.length) {
    log('Nenhum banner para processar');
    return;
  }

  for (let start = 0; start < pending.length; start += config.batchSize) {
    const batch = pending.slice(start, start + config.batchSize);
    const batchNumber = Math.floor(start / config.batchSize) + 1;
    const totalBatches = Math.ceil(pending.length / config.batchSize);

    log('Lote iniciado', {
      loteAtual: batchNumber,
      totalLotes: totalBatches,
      arquivosNoLote: batch.length,
      processadosAntesDoLote: start,
    });

    await processBatch(config, batch, start, pending.length);

    log('Lote finalizado', {
      loteAtual: batchNumber,
      totalLotes: totalBatches,
      enviadosBucket: stats.uploaded,
      verificados: stats.verified,
      atualizadosBanco: stats.updated,
      falhas: stats.failed,
    });

    const hasNextBatch = start + config.batchSize < pending.length;
    if (hasNextBatch) {
      log('Intervalo iniciado', { tempoMs: config.batchPauseMs });
      await sleep(config.batchPauseMs);
      log('Intervalo finalizado');
    }
  }
}

async function main() {
  const config = getConfig();

  log('Importacao de banners iniciada', {
    ftp: config.ftpRemotePath,
    bucket: config.supabaseBucket,
    lote: config.batchSize,
    intervaloMs: config.batchPauseMs,
    concorrencia: config.concurrency,
    verificarUpload: config.verifyUpload,
  });

  const banners = await getAllBanners();
  const listedImages = await listFtpImages(config);
  const probedImages = config.directProbeFromDatabase ? await probeBannersFromDatabase(config, banners) : [];
  const images = mergeImages(listedImages, probedImages);

  stats.validImages = images.length;
  log('Consulta do FTP finalizada', {
    arquivosEncontrados: images.length,
    bannersNoBanco: banners.length,
  });

  const plan = buildPlan(config, images, banners);
  const pending = plan.filter((item) => item.action === 'process');

  await writeAuditJson(config, images, plan);

  log('Planejamento finalizado', {
    arquivosValidos: images.length,
    processar: pending.length,
    semBannerNoBanco: stats.skippedMissingBanner,
    urlJaExistente: stats.skippedExistingUrl,
  });

  await processPendingBanners(config, pending);

  log('Importacao de banners finalizada', {
    arquivosFTP: images.length,
    enviadosBucket: stats.uploaded,
    verificados: stats.verified,
    atualizadosBanco: stats.updated,
    ignoradosSemBanner: stats.skippedMissingBanner,
    ignoradosUrlExistente: stats.skippedExistingUrl,
    falhas: stats.failed,
  });

  if (stats.failed > 0) {
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    log('Importacao de banners interrompida por erro fatal', {
      erro: error instanceof Error ? error.message : String(error),
    });
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
