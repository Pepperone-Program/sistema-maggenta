import crypto from 'crypto';
import dotenv from 'dotenv';
import { Client as FtpClient, enterPassiveModeIPv4 } from 'basic-ftp';
import fs from 'fs/promises';
import path from 'path';
import { Writable } from 'stream';
import pool, { query } from '../database/connection';

dotenv.config();

type FtpImage = {
  filename: string;
  idProduto: number;
  ordemImagem: number;
  size: number;
};

type ImportStats = {
  run: number;
  totalFtpItems: number;
  rawFtpItemsListed: number;
  ftpProbeFound: number;
  validImages: number;
  invalidNames: number;
  skippedExisting: number;
  skippedDuplicatedInFtp: number;
  skippedMissingProduct: number;
  productNotFoundWarnings: number;
  uploaded: number;
  inserted: number;
  failed: number;
};

type ExistingOrdersByProduct = Map<number, Set<number>>;

type ProductPlan = {
  idProduto: number;
  ftpTotal: number;
  ftpOrders: number[];
  existingOrders: number[];
  pending: FtpImage[];
  skippedExisting: FtpImage[];
  skippedDuplicatedInFtp: FtpImage[];
  skippedMissingProduct: FtpImage[];
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
  requireProductExists: boolean;
  ftpListPrefixes: string[];
  targetProductIds: number[];
  useTargetProductJson: boolean;
  targetProductJsonPath: string;
  debugProductIds: number[];
  probeAllProducts: boolean;
  probeMaxOrder: number;
  probeEmptyMaxOrder: number;
  probeStopAfterMisses: number;
  auditDir: string;
  autoRepeat: boolean;
  autoRepeatDelayMs: number;
  maxRuns: number;
  directProbeOnly: boolean;
  probeConcurrency: number;
};

type ImportResult = {
  pending: number;
  inserted: number;
  uploaded: number;
  failed: number;
};

function createStats(run: number): ImportStats {
  return {
    run,
    totalFtpItems: 0,
    rawFtpItemsListed: 0,
    ftpProbeFound: 0,
    validImages: 0,
    invalidNames: 0,
    skippedExisting: 0,
    skippedDuplicatedInFtp: 0,
    skippedMissingProduct: 0,
    productNotFoundWarnings: 0,
    uploaded: 0,
    inserted: 0,
    failed: 0,
  };
}

let stats = createStats(1);

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

function numberCsvEnv(name: string) {
  return csvEnv(name, [])
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value) && value > 0);
}

function uniqueSortedProductIds(productIds: number[]) {
  return Array.from(new Set(productIds))
    .filter((value) => Number.isInteger(value) && value > 0)
    .sort((a, b) => a - b);
}

function collectProductIdsFromJson(value: unknown): number[] {
  if (Array.isArray(value)) {
    return value.flatMap(collectProductIdsFromJson);
  }

  if (typeof value === 'number') {
    return Number.isInteger(value) && value > 0 ? [value] : [];
  }

  if (!value || typeof value !== 'object') {
    return [];
  }

  const record = value as Record<string, unknown>;
  const directId = record.id_produto ?? record.idProduto ?? record.productId;
  if (typeof directId === 'number' || typeof directId === 'string') {
    const parsed = Number(directId);
    return Number.isInteger(parsed) && parsed > 0 ? [parsed] : [];
  }

  return Object.values(record).flatMap(collectProductIdsFromJson);
}

async function loadTargetProductIds(config: Config) {
  if (config.targetProductIds.length) {
    return uniqueSortedProductIds(config.targetProductIds);
  }

  if (!config.useTargetProductJson) {
    return [];
  }

  const jsonPath = path.resolve(process.cwd(), config.targetProductJsonPath);

  try {
    const raw = await fs.readFile(jsonPath, 'utf8');
    const parsed = JSON.parse(raw) as unknown;
    const productIds = uniqueSortedProductIds(collectProductIdsFromJson(parsed));
    if (!productIds.length) {
      fail(`Nenhum id_produto encontrado em ${jsonPath}`);
    }

    return productIds;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return [];
    }

    throw error;
  }
}

async function getAllProductIds() {
  const rows = (await query(
    `
      SELECT id_produto
      FROM produtos
      ORDER BY id_produto ASC
    `
  )) as Array<{ id_produto: number }>;

  return uniqueSortedProductIds(rows.map((row) => Number(row.id_produto)));
}

async function getProductIdsWithoutImages(productIds: number[]) {
  const uniqueProductIds = uniqueSortedProductIds(productIds);
  if (!uniqueProductIds.length) return [];

  const productIdsWithValidImages = new Set<number>();
  const chunkSize = 1000;

  for (let start = 0; start < uniqueProductIds.length; start += chunkSize) {
    const chunk = uniqueProductIds.slice(start, start + chunkSize);
    const placeholders = chunk.map(() => '?').join(',');
    const rows = (await query(
      `
        SELECT DISTINCT id_produto
        FROM imagens_produtos
        WHERE id_produto IN (${placeholders})
          AND url_imagem IS NOT NULL
          AND TRIM(url_imagem) <> ''
      `,
      chunk
    )) as Array<{ id_produto: number }>;

    for (const row of rows) {
      productIdsWithValidImages.add(Number(row.id_produto));
    }
  }

  return uniqueProductIds.filter((idProduto) => !productIdsWithValidImages.has(idProduto));
}

function getConfig(): Config {
  const ftpBasePath = (process.env.FTP_BASE_PATH || 'sistema/images/produtos').replace(/\/+$/, '');
  const ftpRemotePath = (process.env.PRODUTO_IMAGES_FTP_PATH || `${ftpBasePath}/alta`)
    .replace(/^\/+/, '')
    .replace(/\/+$/, '');
  const targetProductIds = numberCsvEnv('PRODUTO_IMAGES_PRODUCT_IDS');

  return {
    ftpHost: requiredEnv('FTP_HOST'),
    ftpPort: numberEnv('FTP_PORT', 21),
    ftpUser: requiredEnv('FTP_USER'),
    ftpPassword: requiredEnv('FTP_PASSWORD'),
    ftpSecure: String(process.env.FTP_SECURE || 'false') === 'true',
    ftpRemotePath,
    supabaseUrl: requiredEnv('SUPABASE_URL', 'https://kabftbmncilygvpcyazc.supabase.co').replace(/\/+$/, ''),
    supabaseS3AccessKeyId: requiredEnv('SUPABASE_S3_ACCESS_KEY_ID'),
    supabaseS3SecretAccessKey: requiredEnv('SUPABASE_S3_SECRET_ACCESS_KEY'),
    supabaseS3Region: requiredEnv('SUPABASE_S3_REGION', 'us-east-1'),
    supabaseBucket: requiredEnv('SUPABASE_STORAGE_BUCKET', 'imagens_produtos_maggenta-site'),
    batchSize: numberEnv('PRODUTO_IMAGES_BATCH_SIZE', 500),
    batchPauseMs: numberEnv('PRODUTO_IMAGES_BATCH_PAUSE_MS', 60000),
    concurrency: numberEnv('PRODUTO_IMAGES_CONCURRENCY', 8),
    maxRetries: numberEnv('PRODUTO_IMAGES_MAX_RETRIES', 3),
    requireProductExists: booleanEnv('PRODUTO_IMAGES_REQUIRE_PRODUCT_EXISTS', false),
    ftpListPrefixes: csvEnv('PRODUTO_IMAGES_FTP_LIST_PREFIXES', ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9']),
    targetProductIds,
    useTargetProductJson: booleanEnv('PRODUTO_IMAGES_USE_PRODUCT_IDS_JSON', false),
    targetProductJsonPath: process.env.PRODUTO_IMAGES_PRODUCT_IDS_JSON?.trim() || 'produtosSemImagem.json',
    debugProductIds: numberCsvEnv('PRODUTO_IMAGES_DEBUG_PRODUCT_IDS'),
    probeAllProducts: booleanEnv('PRODUTO_IMAGES_PROBE_ALL_PRODUCTS', true),
    probeMaxOrder: numberEnv('PRODUTO_IMAGES_PROBE_MAX_ORDER', 80),
    probeEmptyMaxOrder: numberEnv('PRODUTO_IMAGES_PROBE_EMPTY_MAX_ORDER', 8),
    probeStopAfterMisses: numberEnv('PRODUTO_IMAGES_PROBE_STOP_AFTER_MISSES', 6),
    auditDir: process.env.PRODUTO_IMAGES_AUDIT_DIR?.trim() || 'logs/produto-images-import',
    autoRepeat: booleanEnv('PRODUTO_IMAGES_AUTO_REPEAT', true),
    autoRepeatDelayMs: numberEnv('PRODUTO_IMAGES_AUTO_REPEAT_DELAY_MS', 10000),
    maxRuns: Number(process.env.PRODUTO_IMAGES_MAX_RUNS || 0),
    directProbeOnly: booleanEnv('PRODUTO_IMAGES_DIRECT_PROBE_ONLY', true),
    probeConcurrency: numberEnv('PRODUTO_IMAGES_PROBE_CONCURRENCY', 8),
  };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseFtpImage(filename: string, size: number): FtpImage | null {
  const match = filename.match(/^(\d+)-(\d+)\.jpe?g$/i);
  if (!match) return null;

  return {
    filename,
    idProduto: Number(match[1]),
    ordemImagem: Number(match[2]),
    size,
  };
}

async function connectFtp(config: Config) {
  const client = new FtpClient(30000, { maxListingBytes: 200 * 1024 * 1024 });
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

async function probeProductImages(
  config: Config,
  client: FtpClient,
  productId: number,
  maxOrder: number,
  deadlineMs?: number
) {
  const startedAt = Date.now();
  const found: FtpImage[] = [];
  let missesAfterLastFound = 0;

  for (let order = 1; order <= maxOrder; order += 1) {
    if (deadlineMs && Date.now() - startedAt >= deadlineMs) break;
    if (!found.length && order > config.probeEmptyMaxOrder) break;
    if (found.length && missesAfterLastFound >= config.probeStopAfterMisses) break;

    let foundOrder = false;
    for (const extension of ['jpg', 'jpeg', 'JPG', 'JPEG']) {
      const filename = `${productId}-${order}.${extension}`;

      try {
        const size = await client.size(filename);
        found.push({
          filename,
          idProduto: productId,
          ordemImagem: order,
          size: Number(size || 0),
        });
        missesAfterLastFound = 0;
        foundOrder = true;
        break;
      } catch {
        // File absent or SIZE unsupported for this file. The next extension/order is tried.
      }
    }

    if (!foundOrder) {
      missesAfterLastFound += 1;
    }
  }

  return found;
}

async function listFtpImages(config: Config) {
  const client = await connectFtp(config);
  try {
    const ftpItemsByName = new Map<string, { name: string; size?: number; isDirectory?: boolean }>();

    log('Consultando listagem principal do FTP');
    const rootItems = await client.list();
    stats.rawFtpItemsListed += rootItems.length;
    log('Listagem principal concluida', { arquivos: rootItems.length });

    for (const item of rootItems) {
      addFtpItem(ftpItemsByName, item);
    }

    for (const command of ['MLSD', 'NLST', 'LIST']) {
      try {
        log('Consultando FTP por comando alternativo', { comando: command });
        const commandItems = await listWithCommand(client, command);
        stats.rawFtpItemsListed += commandItems.length;
        const before = ftpItemsByName.size;

        for (const item of commandItems) {
          addFtpItem(ftpItemsByName, item);
        }

        log('Comando alternativo concluido', {
          comando: command,
          retornados: commandItems.length,
          novos: ftpItemsByName.size - before,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        log('Comando alternativo falhou', { comando: command, erro: message });
      }
    }

    for (const prefix of config.ftpListPrefixes) {
      const pattern = `${prefix}*`;

      try {
        log('Consultando FTP por prefixo', { prefixo: pattern });
        const prefixedItems = await client.list(pattern);
        stats.rawFtpItemsListed += prefixedItems.length;
        const before = ftpItemsByName.size;

        for (const item of prefixedItems) {
          addFtpItem(ftpItemsByName, item);
        }

        log('Prefixo concluido', {
          prefixo: pattern,
          retornados: prefixedItems.length,
          novos: ftpItemsByName.size - before,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        log('Prefixo falhou', { prefixo: pattern, erro: message });
      }
    }

    const ftpItems = Array.from(ftpItemsByName.values());
    stats.totalFtpItems = ftpItems.length;

    const images: FtpImage[] = [];

    for (const item of ftpItems) {
      if (item.isDirectory) continue;

      const image = parseFtpImage(item.name, Number(item.size || 0));
      if (!image) {
        stats.invalidNames += 1;
        if (stats.invalidNames <= 200) {
          log('Arquivo ignorado por nome invalido', { arquivo: item.name });
        }
        continue;
      }

      images.push(image);
    }

    images.sort((a, b) => a.idProduto - b.idProduto || a.ordemImagem - b.ordemImagem);
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

function groupFtpImagesByProduct(images: FtpImage[]) {
  const grouped = new Map<number, FtpImage[]>();

  for (const image of images) {
    const current = grouped.get(image.idProduto) || [];
    current.push(image);
    grouped.set(image.idProduto, current);
  }

  for (const productImages of grouped.values()) {
    productImages.sort((a, b) => a.ordemImagem - b.ordemImagem || a.filename.localeCompare(b.filename));
  }

  return grouped;
}

async function getExistingOrdersByProduct(productIds: number[]): Promise<ExistingOrdersByProduct> {
  const existing = new Map<number, Set<number>>();
  const chunkSize = 1000;

  for (let start = 0; start < productIds.length; start += chunkSize) {
    const chunk = productIds.slice(start, start + chunkSize);
    if (!chunk.length) continue;

    const placeholders = chunk.map(() => '?').join(',');
    const rows = (await query(
      `
        SELECT id_produto, ordem_imagem
        FROM imagens_produtos
        WHERE id_produto IN (${placeholders})
          AND url_imagem IS NOT NULL
          AND TRIM(url_imagem) <> ''
      `,
      chunk
    )) as Array<{ id_produto: number; ordem_imagem: number }>;

    for (const row of rows) {
      const idProduto = Number(row.id_produto);
      const ordemImagem = Number(row.ordem_imagem);
      const orders = existing.get(idProduto) || new Set<number>();
      orders.add(ordemImagem);
      existing.set(idProduto, orders);
    }
  }

  return existing;
}

async function getExistingProductIds(productIds: number[]) {
  const existing = new Set<number>();
  const chunkSize = 1000;

  for (let start = 0; start < productIds.length; start += chunkSize) {
    const chunk = productIds.slice(start, start + chunkSize);
    const placeholders = chunk.map(() => '?').join(',');
    const rows = (await query(
      `SELECT id_produto FROM produtos WHERE id_produto IN (${placeholders})`,
      chunk
    )) as Array<{ id_produto: number }>;

    for (const row of rows) {
      existing.add(Number(row.id_produto));
    }
  }

  return existing;
}

async function addProbedImages(config: Config, baseImages: FtpImage[], productIds: number[]) {
  if (!productIds.length || config.probeMaxOrder <= 0) return baseImages;

  const byName = new Map(baseImages.map((image) => [image.filename, image]));
  const client = await connectFtp(config);

  try {
    log('Iniciando fallback por existencia de arquivo no FTP', {
      produtos: productIds.length,
      ordemMaxima: config.probeMaxOrder,
    });

    for (const productId of productIds) {
      const found = await probeProductImages(config, client, productId, config.probeMaxOrder);

      for (const image of found) {
        if (!byName.has(image.filename)) {
          byName.set(image.filename, image);
          stats.ftpProbeFound += 1;
        }
      }
    }

    log('Fallback por existencia concluido', {
      novosArquivos: stats.ftpProbeFound,
      totalComFallback: byName.size,
    });
  } finally {
    client.close();
  }

  return Array.from(byName.values()).sort((a, b) => a.idProduto - b.idProduto || a.ordemImagem - b.ordemImagem);
}

async function listProductImages(client: FtpClient, productId: number) {
  const byName = new Map<string, FtpImage>();

  try {
    const items = await client.list(`${productId}-*`);
    for (const item of items) {
      if (item.isDirectory) continue;

      const image = parseFtpImage(item.name, Number(item.size || 0));
      if (image?.idProduto === productId) {
        byName.set(image.filename, image);
      }
    }
  } catch {
    // Some FTP servers do not support wildcard LIST. Direct probing is used below.
  }

  return Array.from(byName.values()).sort((a, b) => a.ordemImagem - b.ordemImagem);
}

async function discoverImagesForProduct(config: Config, client: FtpClient, productId: number) {
  const listed = await listProductImages(client, productId);
  if (listed.length) return listed;

  return probeProductImages(config, client, productId, config.probeMaxOrder);
}

async function discoverImagesByDirectProbe(config: Config, productIds: number[]) {
  const byName = new Map<string, FtpImage>();
  let nextIndex = 0;
  let checkedProducts = 0;

  log('Buscando arquivos no FTP', {
    produtos: productIds.length,
    ordemMaxima: config.probeMaxOrder,
    concorrencia: config.probeConcurrency,
  });

  async function worker() {
    const client = await connectFtp(config);

    try {
      while (nextIndex < productIds.length) {
        const currentIndex = nextIndex;
        nextIndex += 1;
        const productId = productIds[currentIndex];
        const found = await discoverImagesForProduct(config, client, productId);

        for (const image of found) {
          byName.set(image.filename, image);
        }

        checkedProducts += 1;
        if (found.length > 0) {
          log('Produto com arquivo encontrado', {
            idProduto: productId,
            arquivos: found.map((image) => image.filename),
          });
        } else if (checkedProducts % 50 === 0 || checkedProducts === productIds.length) {
          log('Busca em andamento', {
            consultados: checkedProducts,
            total: productIds.length,
            encontrados: byName.size,
          });
        }
      }
    } finally {
      client.close();
    }
  }

  const workerCount = Math.min(config.probeConcurrency, productIds.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));

  const images = Array.from(byName.values()).sort((a, b) => a.idProduto - b.idProduto || a.ordemImagem - b.ordemImagem);
  log('Busca no FTP finalizada', {
    produtosConsultados: checkedProducts,
    arquivosEncontrados: images.length,
  });

  return images;
}

function buildImportPlan(
  groupedFtpImages: Map<number, FtpImage[]>,
  existingProductIds: Set<number>,
  existingOrdersByProduct: ExistingOrdersByProduct,
  config: Config
) {
  const plans: ProductPlan[] = [];
  const pendingImages: FtpImage[] = [];

  for (const [idProduto, productImages] of groupedFtpImages) {
    const plan: ProductPlan = {
      idProduto,
      ftpTotal: productImages.length,
      ftpOrders: productImages.map((image) => image.ordemImagem),
      existingOrders: Array.from(existingOrdersByProduct.get(idProduto) || []).sort((a, b) => a - b),
      pending: [],
      skippedExisting: [],
      skippedDuplicatedInFtp: [],
      skippedMissingProduct: [],
    };

    const productExists = existingProductIds.has(idProduto);
    if (!productExists) {
      stats.productNotFoundWarnings += productImages.length;
      log(config.requireProductExists ? 'Produto ausente no banco' : 'Produto ausente no banco, tentativa mantida', {
        idProduto,
        arquivos: productImages.length,
      });

      if (config.requireProductExists) {
        plan.skippedMissingProduct.push(...productImages);
        stats.skippedMissingProduct += productImages.length;
        plans.push(plan);
        continue;
      }
    }

    const dbOrders = new Set(existingOrdersByProduct.get(idProduto) || []);
    const plannedOrders = new Set<number>();

    for (const image of productImages) {
      if (dbOrders.has(image.ordemImagem)) {
        plan.skippedExisting.push(image);
        stats.skippedExisting += 1;
        continue;
      }

      if (plannedOrders.has(image.ordemImagem)) {
        plan.skippedDuplicatedInFtp.push(image);
        stats.skippedDuplicatedInFtp += 1;
        continue;
      }

      plannedOrders.add(image.ordemImagem);
      plan.pending.push(image);
      pendingImages.push(image);
    }

    plans.push(plan);
  }

  return { plans, pendingImages };
}

function logProductPlan(plan: ProductPlan) {
  log('Plano do produto', {
    idProduto: plan.idProduto,
    ftp: plan.ftpTotal,
    inserir: plan.pending.length,
    jaExistiam: plan.skippedExisting.length,
    duplicadas: plan.skippedDuplicatedInFtp.length,
    produtoAusente: plan.skippedMissingProduct.length,
  });
}

async function writeAuditJson(config: Config, run: number, ftpImages: FtpImage[], plans: ProductPlan[]) {
  const absoluteAuditDir = path.resolve(process.cwd(), config.auditDir);
  await fs.mkdir(absoluteAuditDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const auditPath = path.join(absoluteAuditDir, `produto-images-run-${run}-${timestamp}.json`);
  const byProduct = plans.map((plan) => ({
    id_produto: plan.idProduto,
    total_ftp: plan.ftpTotal,
    arquivos_ftp: plan.pending
      .concat(plan.skippedExisting, plan.skippedDuplicatedInFtp, plan.skippedMissingProduct)
      .sort((a, b) => a.ordemImagem - b.ordemImagem)
      .map((image) => image.filename),
    ordens_ftp: plan.ftpOrders,
    ordens_existentes_banco: plan.existingOrders,
    arquivos_para_inserir: plan.pending.map((image) => image.filename),
    arquivos_pulados_por_ordem_existente: plan.skippedExisting.map((image) => image.filename),
    arquivos_duplicados_no_ftp: plan.skippedDuplicatedInFtp.map((image) => image.filename),
    arquivos_com_produto_ausente: plan.skippedMissingProduct.map((image) => image.filename),
  }));

  await fs.writeFile(
    auditPath,
    JSON.stringify(
      {
        generated_at: new Date().toISOString(),
        run,
        counts: {
          total_ftp_items: stats.totalFtpItems,
          raw_ftp_items_listed: stats.rawFtpItemsListed,
          valid_images: stats.validImages,
          invalid_names: stats.invalidNames,
          products: plans.length,
          pending: plans.reduce((sum, plan) => sum + plan.pending.length, 0),
          skipped_existing: stats.skippedExisting,
          skipped_missing_product: stats.skippedMissingProduct,
        },
        all_files: ftpImages.map((image) => image.filename),
        by_product: byProduct,
      },
      null,
      2
    )
  );

  log('JSON de auditoria gerado', { caminho: auditPath, arquivos: ftpImages.length });
}

async function verifyPendingImages(pendingImages: FtpImage[]) {
  const productIds = Array.from(new Set(pendingImages.map((image) => image.idProduto))).sort((a, b) => a - b);
  const existingOrdersByProduct = await getExistingOrdersByProduct(productIds);
  const missing: FtpImage[] = [];

  for (const image of pendingImages) {
    const orders = existingOrdersByProduct.get(image.idProduto);
    if (!orders?.has(image.ordemImagem)) {
      missing.push(image);
    }
  }

  log('Verificacao final concluida', {
    esperados: pendingImages.length,
    confirmadosNoBanco: pendingImages.length - missing.length,
    faltandoNoBanco: missing.length,
    faltantes: missing.slice(0, 200).map((image) => ({
      arquivo: image.filename,
      idProduto: image.idProduto,
      ordemImagem: image.ordemImagem,
    })),
    listaFaltantesTruncada: missing.length > 200,
  });

  return missing;
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
  const canonicalRequest = [
    'PUT',
    canonicalUri,
    '',
    `${canonicalHeaders}\n`,
    signedHeaders,
    payloadHash,
  ].join('\n');
  const credentialScope = `${dateStamp}/${config.supabaseS3Region}/s3/aws4_request`;
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    hashHex(canonicalRequest),
  ].join('\n');
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

async function withRetry<T>(config: Config, label: string, task: (attempt: number) => Promise<T>) {
  let lastError: unknown;

  for (let attempt = 1; attempt <= config.maxRetries; attempt += 1) {
    try {
      return await task(attempt);
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      log('Tentativa falhou, tentando novamente se houver limite', {
        operacao: label,
        tentativa: attempt,
        maxTentativas: config.maxRetries,
        erro: message,
      });

      if (attempt < config.maxRetries) {
        await sleep(Math.min(30000, 1000 * attempt * attempt));
      }
    }
  }

  throw lastError;
}

async function insertImageRow(image: FtpImage, publicUrl: string) {
  const result = (await query(
    `
      INSERT INTO imagens_produtos (id_produto, url_imagem, ordem_imagem)
      VALUES (?, ?, ?)
      ON DUPLICATE KEY UPDATE
        url_imagem = IF(url_imagem IS NULL OR TRIM(url_imagem) = '', VALUES(url_imagem), url_imagem),
        ordem_imagem = VALUES(ordem_imagem)
    `,
    [image.idProduto, publicUrl, image.ordemImagem]
  )) as { affectedRows: number };

  return result.affectedRows > 0;
}

function isDuplicateOrderError(error: unknown) {
  const dbError = error as { code?: string; message?: string };
  return dbError.code === 'ER_DUP_ENTRY' || String(dbError.message || '').includes('Duplicate entry');
}

function isForeignKeyError(error: unknown) {
  const dbError = error as { code?: string; message?: string };
  return dbError.code === 'ER_NO_REFERENCED_ROW_2' || String(dbError.message || '').includes('foreign key');
}

async function processImage(config: Config, client: FtpClient, image: FtpImage, sequence: number, total: number) {
  const storageKey = `${image.idProduto}/${image.filename}`;
  const publicUrl = buildPublicUrl(config, storageKey);

  const buffer = await withRetry(config, `ftp.download:${image.filename}`, () => downloadFtpBuffer(client, image.filename));

  await withRetry(config, `supabase.upload:${storageKey}`, () => uploadToSupabaseS3(config, storageKey, buffer));
  stats.uploaded += 1;

  const inserted = await withRetry(config, `mysql.insert:${image.filename}`, async () => {
    try {
      return await insertImageRow(image, publicUrl);
    } catch (error) {
      if (isDuplicateOrderError(error)) {
        log('Duplicidade detectada no MySQL', {
          arquivo: image.filename,
          idProduto: image.idProduto,
          ordemImagem: image.ordemImagem,
        });
        return false;
      }

      if (isForeignKeyError(error)) {
        log('MySQL recusou por chave estrangeira', {
          arquivo: image.filename,
          idProduto: image.idProduto,
          ordemImagem: image.ordemImagem,
          erro: error instanceof Error ? error.message : String(error),
        });
      }

      throw error;
    }
  });
  if (inserted) {
    stats.inserted += 1;
    log('Imagem importada', {
      sequencia: `${sequence}/${total}`,
      arquivo: image.filename,
      idProduto: image.idProduto,
      ordemImagem: image.ordemImagem,
      bytes: buffer.length,
    });
  } else {
    stats.skippedExisting += 1;
    log('Imagem ja existia no banco', {
      arquivo: image.filename,
      idProduto: image.idProduto,
      ordemImagem: image.ordemImagem,
    });
  }
}

async function processBatch(config: Config, batch: FtpImage[], offset: number, total: number) {
  let nextIndex = 0;

  async function worker() {
    const client = await connectFtp(config);

    try {
      while (nextIndex < batch.length) {
        const currentIndex = nextIndex;
        nextIndex += 1;
        const image = batch[currentIndex];

        try {
          await processImage(config, client, image, offset + currentIndex + 1, total);
        } catch (error) {
          stats.failed += 1;
          const message = error instanceof Error ? error.message : String(error);
          log('Imagem falhou', {
            arquivo: image.filename,
            idProduto: image.idProduto,
            ordemImagem: image.ordemImagem,
            erro: message,
          });
        }
      }
    } finally {
      client.close();
    }
  }

  const workerCount = Math.min(config.concurrency, batch.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
}

function orderPendingImages(config: Config, pendingImages: FtpImage[]) {
  const priority = new Set(config.targetProductIds.length ? config.targetProductIds : config.debugProductIds);

  return pendingImages.sort((a, b) => {
    const aPriority = priority.has(a.idProduto) ? 0 : 1;
    const bPriority = priority.has(b.idProduto) ? 0 : 1;
    return aPriority - bPriority || a.idProduto - b.idProduto || a.ordemImagem - b.ordemImagem;
  });
}

function filterImagesByTargetProductIds(images: FtpImage[], targetProductIds: number[]) {
  if (!targetProductIds.length) return images;

  const targetProductIdSet = new Set(targetProductIds);
  return images.filter((image) => targetProductIdSet.has(image.idProduto));
}

async function planImages(config: Config, images: FtpImage[]) {
  const groupedFtpImages = groupFtpImagesByProduct(images);
  const uniqueProductIds = Array.from(groupedFtpImages.keys()).sort((a, b) => a - b);
  const existingProductIds = await getExistingProductIds(uniqueProductIds);
  const existingOrdersByProduct = await getExistingOrdersByProduct(uniqueProductIds);
  const { plans, pendingImages } = buildImportPlan(
    groupedFtpImages,
    existingProductIds,
    existingOrdersByProduct,
    config
  );

  return {
    groupedFtpImages,
    uniqueProductIds,
    existingProductIds,
    plans,
    pendingImages: orderPendingImages(config, pendingImages),
  };
}

async function processPendingImages(config: Config, pendingImages: FtpImage[], label: string) {
  if (!pendingImages.length) {
    log('Nenhum arquivo para processar nesta etapa', { etapa: label });
    return;
  }

  log('Processamento iniciado', {
    etapa: label,
    arquivosParaProcessar: pendingImages.length,
  });

  for (let start = 0; start < pendingImages.length; start += config.batchSize) {
    const batch = pendingImages.slice(start, start + config.batchSize);
    const batchNumber = Math.floor(start / config.batchSize) + 1;
    const totalBatches = Math.ceil(pendingImages.length / config.batchSize);

    log('Lote iniciado', {
      etapa: label,
      loteAtual: batchNumber,
      totalLotes: totalBatches,
      arquivosNoLote: batch.length,
      processadosAntesDoLote: start,
    });

    await processBatch(config, batch, start, pendingImages.length);

    log('Lote finalizado', {
      etapa: label,
      loteAtual: batchNumber,
      totalLotes: totalBatches,
      enviadosBucket: stats.uploaded,
      inseridosBanco: stats.inserted,
      falhas: stats.failed,
    });

    const hasNextBatch = start + config.batchSize < pendingImages.length;
    if (hasNextBatch) {
      log('Intervalo iniciado', { etapa: label, tempoMs: config.batchPauseMs });
      await sleep(config.batchPauseMs);
      log('Intervalo finalizado', { etapa: label });
    }
  }
}

async function runImportOnce(config: Config, run: number, productIds: number[], label: string): Promise<ImportResult> {
  stats = createStats(run);
  log('Importacao iniciada', {
    execucao: run,
    etapa: label,
    ftp: config.ftpRemotePath,
    bucket: config.supabaseBucket,
    lote: config.batchSize,
    intervaloMs: config.batchPauseMs,
    concorrencia: config.concurrency,
    produtosAlvo: productIds.length,
  });

  const allProductIds = uniqueSortedProductIds(productIds);
  log('Produtos selecionados', {
    etapa: label,
    total: allProductIds.length,
    primeirosIds: allProductIds.slice(0, 50),
    listaTruncada: allProductIds.length > 50,
  });

  let ftpImages: FtpImage[];

  if (config.directProbeOnly) {
    ftpImages = await discoverImagesByDirectProbe(config, allProductIds);
    stats.totalFtpItems = ftpImages.length;
    stats.validImages = ftpImages.length;
  } else {
    ftpImages = filterImagesByTargetProductIds(await listFtpImages(config), allProductIds);
    stats.totalFtpItems = ftpImages.length;
    stats.validImages = ftpImages.length;

    if (config.probeAllProducts) {
      ftpImages = await addProbedImages(config, ftpImages, allProductIds);
      ftpImages = filterImagesByTargetProductIds(ftpImages, allProductIds);
      stats.totalFtpItems = ftpImages.length;
      stats.validImages = ftpImages.length;
    }
  }

  log('Consulta do FTP finalizada', {
    arquivosEncontrados: ftpImages.length,
    leiturasFTP: stats.rawFtpItemsListed,
    encontradosPorFallback: stats.ftpProbeFound,
    nomesInvalidos: stats.invalidNames,
  });

  const fullPlan = await planImages(config, ftpImages);
  const { groupedFtpImages, uniqueProductIds, existingProductIds, plans } = fullPlan;
  const orderedPendingImages = fullPlan.pendingImages;

  for (const plan of plans) {
    if (!config.debugProductIds.length || config.debugProductIds.includes(plan.idProduto)) {
      logProductPlan(plan);
    }
  }

  await writeAuditJson(config, run, ftpImages, plans);

  log('Planejamento finalizado', {
    produtosNoFtp: groupedFtpImages.size,
    ids: uniqueProductIds,
    produtosSemArquivoNoFtp: allProductIds.filter((idProduto) => !groupedFtpImages.has(idProduto)),
    produtosEncontradosNoBanco: existingProductIds.size,
    produtosNaoEncontradosNoBanco: uniqueProductIds.length - existingProductIds.size,
    arquivosParaProcessar: orderedPendingImages.length,
    arquivosJaExistentes: stats.skippedExisting,
    duplicadosNoFtp: stats.skippedDuplicatedInFtp,
    puladosPorProdutoAusente: stats.skippedMissingProduct,
    avisosProdutoAusente: stats.productNotFoundWarnings,
  });

  log('Resumo antes do processamento', {
    totalArquivos: ftpImages.length,
    totalProdutos: uniqueProductIds.length,
    inserirNoBucket: orderedPendingImages.length,
    inserirNoBanco: orderedPendingImages.length,
  });

  await processPendingImages(config, orderedPendingImages, label);

  const missingAfterImport = await verifyPendingImages(orderedPendingImages);
  if (missingAfterImport.length > 0) {
    stats.failed += missingAfterImport.length;
  }

  log('Importacao finalizada', {
    arquivosFTP: stats.totalFtpItems,
    validas: stats.validImages,
    jaExistiam: stats.skippedExisting,
    enviadosBucket: stats.uploaded,
    inseridosBanco: stats.inserted,
    falhas: stats.failed,
  });

  return {
    pending: orderedPendingImages.length,
    inserted: stats.inserted,
    uploaded: stats.uploaded,
    failed: stats.failed,
  };
}

async function main() {
  const config = getConfig();

  const configuredProductIds = await loadTargetProductIds(config);
  const allProductIds = configuredProductIds.length ? configuredProductIds : await getAllProductIds();
  if (!allProductIds.length) {
    fail('Nenhum produto encontrado para varredura');
  }

  log('Estrategia de importacao definida', {
    produtos: allProductIds.length,
    origem: configuredProductIds.length ? 'PRODUTO_IMAGES_PRODUCT_IDS/produtosSemImagem.json' : 'todos os produtos do banco',
  });

  const results: ImportResult[] = [];
  let run = 1;

  results.push(await runImportOnce(config, run, allProductIds, '1-varredura-todos-produtos'));
  const reachedMaxRuns = () => config.maxRuns > 0 && results.length >= config.maxRuns;

  let productsWithoutImages = await getProductIdsWithoutImages(allProductIds);
  log('Primeira varredura concluida', {
    produtosSemImagem: productsWithoutImages.length,
    primeirosIds: productsWithoutImages.slice(0, 100),
    listaTruncada: productsWithoutImages.length > 100,
  });

  if (productsWithoutImages.length && !reachedMaxRuns()) {
    run += 1;
    if (config.autoRepeatDelayMs > 0) {
      log('Intervalo antes da segunda revisao', { aguardarMs: config.autoRepeatDelayMs });
      await sleep(config.autoRepeatDelayMs);
    }

    results.push(await runImportOnce(config, run, productsWithoutImages, '2-revisao-produtos-sem-imagem'));
  }

  productsWithoutImages = await getProductIdsWithoutImages(allProductIds);
  log('Segunda revisao concluida', {
    produtosSemImagem: productsWithoutImages.length,
    primeirosIds: productsWithoutImages.slice(0, 100),
    listaTruncada: productsWithoutImages.length > 100,
  });

  if (productsWithoutImages.length && !reachedMaxRuns()) {
    log('Iniciando revisao individual dos produtos ainda sem imagem', {
      produtos: productsWithoutImages.length,
    });

    for (const idProduto of productsWithoutImages) {
      if (reachedMaxRuns()) break;
      run += 1;
      results.push(await runImportOnce(config, run, [idProduto], '3-revisao-individual'));
    }
  }

  const remainingWithoutImages = await getProductIdsWithoutImages(allProductIds);
  const totalFailed = results.reduce((sum, result) => sum + result.failed, 0);
  log('Fluxo de importacao finalizado', {
    execucoes: results.length,
    enviadosBucket: results.reduce((sum, result) => sum + result.uploaded, 0),
    inseridosBanco: results.reduce((sum, result) => sum + result.inserted, 0),
    falhas: totalFailed,
    produtosAindaSemImagem: remainingWithoutImages.length,
    primeirosAindaSemImagem: remainingWithoutImages.slice(0, 200),
    listaAindaSemImagemTruncada: remainingWithoutImages.length > 200,
  });

  if (totalFailed > 0) {
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    log('Importacao interrompida por erro fatal', { erro: message });
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
