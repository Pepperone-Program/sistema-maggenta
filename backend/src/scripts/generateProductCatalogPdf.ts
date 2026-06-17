import dotenv from 'dotenv';
import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import PDFDocument from 'pdfkit';

dotenv.config();

type ProdutoImagem = {
  id_imagem: number;
  id_produto: number;
  url_imagem: string;
  ordem_imagem: number;
  created_at?: string;
};

type ProdutoSite = {
  id_produto: number;
  produto: string;
  codigo: string;
  altura?: string | number | null;
  largura?: string | number | null;
  profundidade?: string | number | null;
  peso?: string | number | null;
  quantidade_minima?: string | number | null;
  imagem?: string | null;
  imagens?: ProdutoImagem[];
};

type ApiResponse<T> = {
  success: boolean;
  message: string;
  data: T;
  error?: { code?: string; details?: unknown };
};

type PaginatedData<T> = {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

type Config = {
  apiUrl: string;
  outputPath: string;
  empresaId: number;
  pageLimit: number;
  maxProducts: number;
  requestTimeoutMs: number;
  maxRetries: number;
  coverLogoUrl: string;
  evenPageLogoUrl: string;
};

type SocialLink = {
  name: string;
  url: string;
  icon: 'linkedin' | 'whatsapp' | 'instagram' | 'site';
};

type InfoItem = {
  icon: 'code' | 'name' | 'height' | 'width' | 'depth' | 'weight' | 'minimum';
  label: string;
  value: string;
  strong?: boolean;
};

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const LOGO_FULL =
  'https://kabftbmncilygvpcyazc.supabase.co/storage/v1/object/public/imagem_empresa/logoNovoCompleta.png';
const LOGO_SMALL =
  'https://kabftbmncilygvpcyazc.supabase.co/storage/v1/object/public/imagem_empresa/logoNovoPepperone.png';
const PRODUCT_URL_BASE = 'https://www.maggenta.com.br/brindes-personalizados';
const SOCIAL_LINKS: SocialLink[] = [
  { name: 'LinkedIn', url: 'https://www.linkedin.com/company/pepperone/', icon: 'linkedin' },
  {
    name: 'WhatsApp',
    url: 'https://api.whatsapp.com/send/?phone=5511947388467&text=Ol%C3%A1&type=phone_number&app_absent=0',
    icon: 'whatsapp',
  },
  { name: 'Instagram', url: 'https://www.instagram.com/pepperonebrindes/', icon: 'instagram' },
  { name: 'Site', url: 'https://www.pepperone.com.br/', icon: 'site' },
];
const CODE_COLLATOR = new Intl.Collator('pt-BR', {
  numeric: true,
  sensitivity: 'base',
  ignorePunctuation: true,
});
const LINKEDIN_ICON_PATH =
  'M347.445 0H34.555C15.471 0 0 15.471 0 34.555v312.889C0 366.529 15.471 382 34.555 382h312.889C366.529 382 382 366.529 382 347.444V34.555C382 15.471 366.529 0 347.445 0zM118.207 329.844c0 5.554-4.502 10.056-10.056 10.056H65.345c-5.554 0-10.056-4.502-10.056-10.056V150.403c0-5.554 4.502-10.056 10.056-10.056h42.806c5.554 0 10.056 4.502 10.056 10.056v179.441zM86.748 123.432c-22.459 0-40.666-18.207-40.666-40.666S64.289 42.1 86.748 42.1s40.666 18.207 40.666 40.666-18.206 40.666-40.666 40.666zM341.91 330.654c0 5.106-4.14 9.246-9.246 9.246H286.73c-5.106 0-9.246-4.14-9.246-9.246v-84.168c0-12.556 3.683-55.021-32.813-55.021-28.309 0-34.051 29.066-35.204 42.11v97.079c0 5.106-4.139 9.246-9.246 9.246h-44.426c-5.106 0-9.246-4.14-9.246-9.246V149.593c0-5.106 4.14-9.246 9.246-9.246h44.426c5.106 0 9.246 4.14 9.246 9.246v15.655c10.497-15.753 26.097-27.912 59.312-27.912 73.552 0 73.131 68.716 73.131 106.472v86.846z';
const WHATSAPP_ICON_PATH =
  'M26.576 5.363c-2.69-2.69-6.406-4.354-10.511-4.354-8.209 0-14.865 6.655-14.865 14.865 0 2.732 0.737 5.291 2.022 7.491l-0.038-0.070-2.109 7.702 7.879-2.067c2.051 1.139 4.498 1.809 7.102 1.809h0.006c8.209-0.003 14.862-6.659 14.862-14.868 0-4.103-1.662-7.817-4.349-10.507zM16.062 28.228h-0.006c-2.319 0-4.489-0.64-6.342-1.753l0.056 0.031-0.451-0.267-4.675 1.227 1.247-4.559-0.294-0.467c-1.185-1.862-1.889-4.131-1.889-6.565 0-6.822 5.531-12.353 12.353-12.353s12.353 5.531 12.353 12.353c0 6.822-5.53 12.353-12.353 12.353zM22.838 18.977c-0.371-0.186-2.197-1.083-2.537-1.208-0.341-0.124-0.589-0.185-0.837 0.187-0.246 0.371-0.958 1.207-1.175 1.455-0.216 0.249-0.434 0.279-0.805 0.094-1.15-0.466-2.138-1.087-2.997-1.852l0.010 0.009c-0.799-0.74-1.484-1.587-2.037-2.521l-0.028-0.052c-0.216-0.371-0.023-0.572 0.162-0.757 0.167-0.166 0.372-0.434 0.557-0.65 0.146-0.179 0.271-0.384 0.366-0.604l0.006-0.017c0.043-0.087 0.068-0.188 0.068-0.296 0-0.131-0.037-0.253-0.101-0.357l0.002 0.003c-0.094-0.186-0.836-2.014-1.145-2.758-0.302-0.724-0.609-0.625-0.836-0.637-0.216-0.010-0.464-0.012-0.712-0.012-0.395 0.010-0.746 0.188-0.988 0.463l-0.001 0.002c-0.802 0.761-1.3 1.834-1.3 3.023 0 0.026 0 0.053 0.001 0.079l0-0.004c0.131 1.467 0.681 2.784 1.527 3.857l-0.012-0.015c1.604 2.379 3.742 4.282 6.251 5.564l0.094 0.043c0.548 0.248 1.25 0.513 1.968 0.74l0.149 0.041c0.442 0.14 0.951 0.221 1.479 0.221 0.303 0 0.601-0.027 0.889-0.078l-0.031 0.004c1.069-0.223 1.956-0.868 2.497-1.749l0.009-0.017c0.165-0.366 0.261-0.793 0.261-1.242 0-0.185-0.016-0.366-0.047-0.542l0.003 0.019c-0.092-0.155-0.34-0.247-0.712-0.434z';

function log(message: string, data: Record<string, unknown> = {}) {
  const details = Object.entries(data)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${key}=${Array.isArray(value) || typeof value === 'object' ? JSON.stringify(value) : value}`)
    .join(' | ');

  console.log(`[${new Date().toLocaleString('pt-BR')}] ${message}${details ? ` | ${details}` : ''}`);
}

function numberEnv(name: string, fallback: number) {
  const value = process.env[name]?.trim();
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Variavel ${name} deve ser um numero positivo`);
  }
  return parsed;
}

function getConfig(): Config {
  return {
    apiUrl: (process.env.CATALOG_PRODUCTS_API_URL || 'http://localhost:3001/api/v1/produtos/site').trim(),
    outputPath: process.env.CATALOG_OUTPUT_PATH?.trim() || 'catalogos/catalogo-produtos-pepperone.pdf',
    empresaId: numberEnv('CATALOG_EMPRESA_ID', 1),
    pageLimit: numberEnv('CATALOG_PAGE_LIMIT', 100),
    maxProducts: Number(process.env.CATALOG_MAX_PRODUCTS || 0),
    requestTimeoutMs: numberEnv('CATALOG_REQUEST_TIMEOUT_MS', 30000),
    maxRetries: numberEnv('CATALOG_MAX_RETRIES', 3),
    coverLogoUrl: process.env.CATALOG_COVER_LOGO_URL?.trim() || LOGO_FULL,
    evenPageLogoUrl: process.env.CATALOG_EVEN_PAGE_LOGO_URL?.trim() || LOGO_SMALL,
  };
}

function formatValue(value: unknown, suffix = '') {
  if (value === null || value === undefined || value === '') return 'Nao informado';
  return `${String(value).trim()}${suffix}`;
}

function imageUrlForProduct(produto: ProdutoSite) {
  const image = [...(produto.imagens || [])]
    .filter((item) => item.url_imagem)
    .sort((a, b) => Number(a.ordem_imagem) - Number(b.ordem_imagem) || Number(a.id_imagem) - Number(b.id_imagem))[0];

  if (image?.url_imagem) return image.url_imagem;
  if (produto.imagem && /^https?:\/\//i.test(produto.imagem)) return produto.imagem;
  return null;
}

function productPageUrl(produto: ProdutoSite) {
  return `${PRODUCT_URL_BASE}/${produto.id_produto}`;
}

function productSortCode(produto: ProdutoSite) {
  return (produto.codigo || '').trim();
}

function sortProductsByCode(products: ProdutoSite[]) {
  return [...products].sort((a, b) => {
    const codeCompare = CODE_COLLATOR.compare(productSortCode(a), productSortCode(b));
    if (codeCompare !== 0) return codeCompare;

    const nameCompare = CODE_COLLATOR.compare(a.produto || '', b.produto || '');
    if (nameCompare !== 0) return nameCompare;

    return Number(a.id_produto) - Number(b.id_produto);
  });
}

async function withRetry<T>(config: Config, label: string, task: () => Promise<T>) {
  let lastError: unknown;

  for (let attempt = 1; attempt <= config.maxRetries; attempt += 1) {
    try {
      return await task();
    } catch (error) {
      lastError = error;
      log('Tentativa falhou', {
        operacao: label,
        tentativa: attempt,
        maxTentativas: config.maxRetries,
        erro: error instanceof Error ? error.message : String(error),
      });

      if (attempt < config.maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, Math.min(10000, attempt * attempt * 700)));
      }
    }
  }

  throw lastError;
}

async function fetchWithTimeout(url: string, timeoutMs: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchJson<T>(config: Config, url: string): Promise<T> {
  return withRetry(config, `fetch.json:${url}`, async () => {
    const response = await fetchWithTimeout(url, config.requestTimeoutMs);
    const body = (await response.json().catch(() => null)) as ApiResponse<T> | null;

    if (!response.ok || !body?.success) {
      throw new Error(body?.message || `HTTP ${response.status} ao consultar ${url}`);
    }

    return body.data;
  });
}

async function fetchBuffer(config: Config, url: string) {
  return withRetry(config, `fetch.image:${url}`, async () => {
    const response = await fetchWithTimeout(url, config.requestTimeoutMs);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ao baixar imagem`);
    }

    return Buffer.from(await response.arrayBuffer());
  });
}

function buildPageUrl(config: Config, page: number) {
  const url = new URL(config.apiUrl);
  url.searchParams.set('empresaId', String(config.empresaId));
  url.searchParams.set('page', String(page));
  url.searchParams.set('limit', String(config.pageLimit));
  return url.toString();
}

function drawCodeIcon(doc: PDFKit.PDFDocument, x: number, y: number) {
  doc.roundedRect(x + 2, y + 4, 20, 15, 3).stroke();
  doc.moveTo(x + 6, y + 9).lineTo(x + 10, y + 13).lineTo(x + 6, y + 17).stroke();
  doc.moveTo(x + 18, y + 9).lineTo(x + 14, y + 13).lineTo(x + 18, y + 17).stroke();
}

function drawNameIcon(doc: PDFKit.PDFDocument, x: number, y: number) {
  doc.circle(x + 12, y + 9, 5).stroke();
  doc.roundedRect(x + 5, y + 16, 14, 7, 3).stroke();
}

function drawMeasureIcon(doc: PDFKit.PDFDocument, x: number, y: number, direction: 'vertical' | 'horizontal' | 'cube') {
  if (direction === 'vertical') {
    doc.moveTo(x + 12, y + 3).lineTo(x + 12, y + 23).stroke();
    doc.moveTo(x + 8, y + 7).lineTo(x + 12, y + 3).lineTo(x + 16, y + 7).stroke();
    doc.moveTo(x + 8, y + 19).lineTo(x + 12, y + 23).lineTo(x + 16, y + 19).stroke();
    return;
  }

  if (direction === 'horizontal') {
    doc.moveTo(x + 3, y + 13).lineTo(x + 23, y + 13).stroke();
    doc.moveTo(x + 7, y + 9).lineTo(x + 3, y + 13).lineTo(x + 7, y + 17).stroke();
    doc.moveTo(x + 19, y + 9).lineTo(x + 23, y + 13).lineTo(x + 19, y + 17).stroke();
    return;
  }

  doc.rect(x + 5, y + 7, 12, 12).stroke();
  doc.moveTo(x + 9, y + 3).lineTo(x + 21, y + 3).lineTo(x + 17, y + 7).stroke();
  doc.moveTo(x + 17, y + 7).lineTo(x + 21, y + 3).lineTo(x + 21, y + 15).lineTo(x + 17, y + 19).stroke();
}

function drawWeightIcon(doc: PDFKit.PDFDocument, x: number, y: number) {
  doc.roundedRect(x + 5, y + 9, 16, 13, 3).stroke();
  doc.circle(x + 13, y + 8, 4).stroke();
  doc.rect(x + 10, y + 8, 6, 4).fillAndStroke('#FFFFFF', '#CE2B37');
}

function drawMinimumIcon(doc: PDFKit.PDFDocument, x: number, y: number) {
  doc.circle(x + 8, y + 12, 4).stroke();
  doc.circle(x + 17, y + 12, 4).stroke();
  doc.circle(x + 12.5, y + 19, 4).stroke();
}

function drawIcon(doc: PDFKit.PDFDocument, icon: InfoItem['icon'], x: number, y: number) {
  doc.save().lineWidth(1.4).strokeColor('#CE2B37');

  if (icon === 'code') drawCodeIcon(doc, x, y);
  if (icon === 'name') drawNameIcon(doc, x, y);
  if (icon === 'height') drawMeasureIcon(doc, x, y, 'vertical');
  if (icon === 'width') drawMeasureIcon(doc, x, y, 'horizontal');
  if (icon === 'depth') drawMeasureIcon(doc, x, y, 'cube');
  if (icon === 'weight') drawWeightIcon(doc, x, y);
  if (icon === 'minimum') drawMinimumIcon(doc, x, y);

  doc.restore();
}

function infoItemHeight(item: InfoItem) {
  if (item.icon === 'name') return 112;
  if (item.strong) return 76;
  return 56;
}

function drawInfoItem(doc: PDFKit.PDFDocument, item: InfoItem, x: number, y: number, width: number) {
  const height = infoItemHeight(item);
  const isProductName = item.icon === 'name';
  const valueFontSize = isProductName ? 13.5 : item.strong ? 20 : 12.5;
  const valueHeight = isProductName ? 72 : item.strong ? 40 : 20;

  doc.save();
  doc.roundedRect(x, y, width, height, 10).fill('#FFFFFF');
  doc.roundedRect(x, y, width, height, 10).strokeColor('#E4E7EC').lineWidth(0.8).stroke();
  drawIcon(doc, item.icon, x + 14, y + 15);
  doc.fillColor('#687385').font('Helvetica-Bold').fontSize(8.5).text(item.label.toUpperCase(), x + 48, y + 13);
  doc
    .fillColor(item.strong ? '#141923' : '#252B37')
    .font(item.strong ? 'Helvetica-Bold' : 'Helvetica')
    .fontSize(valueFontSize)
    .text(item.value, x + 48, y + 27, {
      width: width - 62,
      height: valueHeight,
      lineGap: isProductName ? 2 : 0,
      ellipsis: !isProductName,
    });
  doc.restore();
}

function addPageBackground(doc: PDFKit.PDFDocument) {
  doc.save();
  doc.rect(0, 0, PAGE_WIDTH, PAGE_HEIGHT).fill('#F6F7F9');
  doc.rect(0, 0, 9, PAGE_HEIGHT).fill('#CE2B37');
  doc.circle(PAGE_WIDTH - 70, 88, 90).fillOpacity(0.08).fill('#CE2B37');
  doc.circle(PAGE_WIDTH - 118, PAGE_HEIGHT - 120, 150).fillOpacity(0.05).fill('#111827');
  doc.restore();
}

function addOddPageLogo(doc: PDFKit.PDFDocument, pageNumber: number, logoBuffer: Buffer | null) {
  if (pageNumber <= 1 || pageNumber % 2 === 0 || !logoBuffer) return;

  doc.save();
  doc.image(logoBuffer, PAGE_WIDTH - 150, PAGE_HEIGHT - 76, {
    fit: [108, 42],
    align: 'right',
    valign: 'bottom',
  });
  doc.restore();
}

function addCover(doc: PDFKit.PDFDocument, logoBuffer: Buffer | null) {
  addPageBackground(doc);

  doc.save();
  doc.fillColor('#141923').font('Helvetica-Bold').fontSize(32).text('Catalogo de Produtos', 72, 130, {
    width: PAGE_WIDTH - 144,
    align: 'center',
  });
  doc.fillColor('#CE2B37').fontSize(11).text('PEPPERONE BRINDES', 72, 174, {
    width: PAGE_WIDTH - 144,
    align: 'center',
    characterSpacing: 2,
  });

  if (logoBuffer) {
    doc.image(logoBuffer, 94, 290, {
      fit: [PAGE_WIDTH - 188, 190],
      align: 'center',
      valign: 'center',
    });
  }

  doc
    .fillColor('#687385')
    .font('Helvetica')
    .fontSize(10)
    .text(`Gerado em ${new Date().toLocaleDateString('pt-BR')}`, 72, PAGE_HEIGHT - 120, {
      width: PAGE_WIDTH - 144,
      align: 'center',
    });
  doc.restore();
}

function drawLinkedinIcon(doc: PDFKit.PDFDocument, x: number, y: number, size: number) {
  const iconSize = size * 0.5;
  doc
    .save()
    .translate(x + (size - iconSize) / 2, y + (size - iconSize) / 2)
    .scale(iconSize / 382)
    .path(LINKEDIN_ICON_PATH)
    .fill('#FFFFFF')
    .restore();
}

function drawWhatsappIcon(doc: PDFKit.PDFDocument, x: number, y: number, size: number) {
  const iconSize = size * 0.64;
  doc
    .save()
    .translate(x + (size - iconSize) / 2, y + (size - iconSize) / 2)
    .scale(iconSize / 32)
    .path(WHATSAPP_ICON_PATH)
    .fill('#FFFFFF')
    .restore();
}

function drawInstagramIcon(doc: PDFKit.PDFDocument, x: number, y: number, size: number) {
  doc.roundedRect(x + size * 0.25, y + size * 0.25, size * 0.5, size * 0.5, size * 0.13).stroke();
  doc.circle(x + size / 2, y + size / 2, size * 0.13).stroke();
  doc.circle(x + size * 0.64, y + size * 0.36, size * 0.025).fill('#FFFFFF');
}

function drawSiteIcon(doc: PDFKit.PDFDocument, x: number, y: number, size: number) {
  doc.circle(x + size / 2, y + size / 2, size * 0.25).stroke();
  doc.moveTo(x + size * 0.25, y + size / 2).lineTo(x + size * 0.75, y + size / 2).stroke();
  doc.ellipse(x + size / 2, y + size / 2, size * 0.1, size * 0.25).stroke();
}

function drawSocialIcon(doc: PDFKit.PDFDocument, link: SocialLink, x: number, y: number, size: number) {
  doc.save();
  doc.circle(x + size / 2, y + size / 2, size / 2).fill('#CE2B37');
  doc.fillColor('#FFFFFF').strokeColor('#FFFFFF').lineWidth(1.8);

  if (link.icon === 'linkedin') drawLinkedinIcon(doc, x, y, size);
  if (link.icon === 'whatsapp') drawWhatsappIcon(doc, x, y, size);
  if (link.icon === 'instagram') drawInstagramIcon(doc, x, y, size);
  if (link.icon === 'site') drawSiteIcon(doc, x, y, size);

  doc.link(x, y, size, size, link.url);
  doc.restore();
}

function addClosingPage(doc: PDFKit.PDFDocument, logoBuffer: Buffer | null, pageNumber: number) {
  addPageBackground(doc);

  const panelX = 72;
  const panelY = 148;
  const panelWidth = PAGE_WIDTH - panelX * 2;
  const panelHeight = 520;

  doc.save();
  doc.roundedRect(panelX, panelY, panelWidth, panelHeight, 24).fill('#FFFFFF');
  doc.roundedRect(panelX, panelY, panelWidth, panelHeight, 24).strokeColor('#E4E7EC').lineWidth(0.8).stroke();
  doc.rect(panelX, panelY, panelWidth, 9).fill('#CE2B37');

  if (logoBuffer) {
    doc.image(logoBuffer, panelX + 96, panelY + 58, {
      fit: [panelWidth - 192, 88],
      align: 'center',
      valign: 'center',
    });
  }

  doc
    .fillColor('#141923')
    .font('Helvetica-Bold')
    .fontSize(24)
    .text('Obrigado pela visita', panelX + 48, panelY + 178, {
      width: panelWidth - 96,
      align: 'center',
    });

  doc
    .fillColor('#4B5563')
    .font('Helvetica')
    .fontSize(14)
    .text(
      'Esperamos que tenha gostado do nosso catálogo.\nQuer saber das novidades antes de todo mundo? Entre em contato por:',
      panelX + 64,
      panelY + 238,
      {
        width: panelWidth - 128,
        align: 'center',
        lineGap: 6,
      }
    );

  const iconSize = 58;
  const iconGap = 32;
  const iconsWidth = SOCIAL_LINKS.length * iconSize + (SOCIAL_LINKS.length - 1) * iconGap;
  const iconY = panelY + 354;
  let iconX = panelX + (panelWidth - iconsWidth) / 2;

  for (const link of SOCIAL_LINKS) {
    drawSocialIcon(doc, link, iconX, iconY, iconSize);
    doc.fillColor('#252B37').font('Helvetica-Bold').fontSize(9).text(link.name, iconX - 8, iconY + iconSize + 12, {
      width: iconSize + 16,
      align: 'center',
    });
    iconX += iconSize + iconGap;
  }

  doc
    .fillColor('#9AA3B2')
    .font('Helvetica')
    .fontSize(8)
    .text(`Página ${pageNumber}`, 38, PAGE_HEIGHT - 42, {
      width: 240,
    });
  doc.restore();
}

function addNoImagePlaceholder(doc: PDFKit.PDFDocument, x: number, y: number, width: number, height: number) {
  doc.save();
  doc.roundedRect(x, y, width, height, 18).fill('#FFFFFF');
  doc.roundedRect(x, y, width, height, 18).strokeColor('#E4E7EC').stroke();
  doc.circle(x + width / 2, y + height / 2 - 18, 30).strokeColor('#CE2B37').lineWidth(2).stroke();
  doc.moveTo(x + width / 2 - 42, y + height / 2 + 28).lineTo(x + width / 2 + 42, y + height / 2 + 28).stroke();
  doc.fillColor('#687385').font('Helvetica-Bold').fontSize(12).text('Imagem indisponivel', x, y + height / 2 + 48, {
    width,
    align: 'center',
  });
  doc.restore();
}

function addProductPage(
  doc: PDFKit.PDFDocument,
  produto: ProdutoSite,
  productImage: Buffer | null,
  evenLogo: Buffer | null,
  pageNumber: number,
  sequence: number,
  total: number
) {
  addPageBackground(doc);

  const leftX = 38;
  const leftWidth = 220;
  const items: InfoItem[] = [
    { icon: 'code', label: 'Codigo', value: formatValue(produto.codigo), strong: true },
    { icon: 'name', label: 'Produto', value: formatValue(produto.produto), strong: true },
    { icon: 'height', label: 'Altura', value: formatValue(produto.altura, ' cm') },
    { icon: 'width', label: 'Largura', value: formatValue(produto.largura, ' cm') },
    { icon: 'depth', label: 'Profundidade', value: formatValue(produto.profundidade, ' cm') },
    { icon: 'weight', label: 'Peso', value: formatValue(produto.peso, ' g') },
    { icon: 'minimum', label: 'Quantidade minima', value: formatValue(produto.quantidade_minima) },
  ];

  let y = 44;
  for (const item of items) {
    drawInfoItem(doc, item, leftX, y, leftWidth);
    y += infoItemHeight(item) + 10;
  }

  const imageX = 288;
  const imageY = 122;
  const imageWidth = 258;
  const imageHeight = 500;
  doc.save();
  doc.roundedRect(imageX - 18, imageY - 24, imageWidth + 36, imageHeight + 48, 22).fill('#FFFFFF');
  doc.roundedRect(imageX - 18, imageY - 24, imageWidth + 36, imageHeight + 48, 22).strokeColor('#E4E7EC').lineWidth(0.8).stroke();
  doc.restore();

  if (productImage) {
    doc.image(productImage, imageX, imageY, {
      fit: [imageWidth, imageHeight],
      align: 'center',
      valign: 'center',
    });
    doc.link(imageX, imageY, imageWidth, imageHeight, productPageUrl(produto));
  } else {
    addNoImagePlaceholder(doc, imageX, imageY + 72, imageWidth, 260);
  }

  doc
    .fillColor('#9AA3B2')
    .font('Helvetica')
    .fontSize(8)
    .text(`${sequence}/${total}  Produto #${produto.id_produto}`, 38, PAGE_HEIGHT - 42, {
      width: 240,
    });

  addOddPageLogo(doc, pageNumber, evenLogo);
}

async function main() {
  const config = getConfig();
  const absoluteOutputPath = path.resolve(process.cwd(), config.outputPath);
  await fsp.mkdir(path.dirname(absoluteOutputPath), { recursive: true });

  log('Catalogo iniciado', {
    api: config.apiUrl,
    saida: absoluteOutputPath,
    empresaId: config.empresaId,
    limitePorPagina: config.pageLimit,
    maxProdutos: config.maxProducts || 'todos',
  });

  const [coverLogo, evenLogo, firstPage] = await Promise.all([
    fetchBuffer(config, config.coverLogoUrl).catch((error) => {
      log('Logo da capa nao foi carregada', { erro: error instanceof Error ? error.message : String(error) });
      return null;
    }),
    fetchBuffer(config, config.evenPageLogoUrl).catch((error) => {
      log('Logo das paginas pares nao foi carregada', { erro: error instanceof Error ? error.message : String(error) });
      return null;
    }),
    fetchJson<PaginatedData<ProdutoSite>>(config, buildPageUrl(config, 1)),
  ]);

  const total = config.maxProducts > 0 ? Math.min(firstPage.total, config.maxProducts) : firstPage.total;
  log('Pagina de produtos carregada', {
    pagina: firstPage.page,
    totalPaginas: firstPage.totalPages,
    produtosNestaPagina: firstPage.items.length,
    total,
  });
  const allProducts = [...firstPage.items];
  const totalPages = firstPage.totalPages || Math.ceil(firstPage.total / firstPage.limit);

  for (let page = 2; page <= totalPages; page += 1) {
    const data = await fetchJson<PaginatedData<ProdutoSite>>(config, buildPageUrl(config, page));
    allProducts.push(...data.items);
    log('Pagina de produtos carregada', {
      pagina: page,
      totalPaginas: totalPages,
      produtosNestaPagina: data.items.length,
      total: data.total,
    });
  }

  const sortedProducts = sortProductsByCode(allProducts).slice(0, total);
  const renderTotal = sortedProducts.length;
  log('Produtos ordenados por codigo', {
    produtos: renderTotal,
    primeiroCodigo: sortedProducts[0]?.codigo,
    ultimoCodigo: sortedProducts[sortedProducts.length - 1]?.codigo,
  });

  const doc = new PDFDocument({
    size: 'A4',
    margin: 0,
    autoFirstPage: false,
    bufferPages: false,
    info: {
      Title: 'Catalogo de Produtos Pepperone',
      Author: 'Pepperone',
      Subject: 'Catalogo de produtos do site',
      Creator: 'Pepperone Site Admin',
    },
  });

  const output = fs.createWriteStream(absoluteOutputPath);
  doc.pipe(output);

  let pageNumber = 1;
  doc.addPage();
  addCover(doc, coverLogo);

  let sequence = 0;
  async function renderProduto(produto: ProdutoSite) {
    sequence += 1;
    pageNumber += 1;
    doc.addPage();

    const imageUrl = imageUrlForProduct(produto);
    const imageBuffer = imageUrl
      ? await fetchBuffer(config, imageUrl).catch((error) => {
          log('Imagem do produto nao foi carregada', {
            idProduto: produto.id_produto,
            codigo: produto.codigo,
            url: imageUrl,
            erro: error instanceof Error ? error.message : String(error),
          });
          return null;
        })
      : null;

    addProductPage(doc, produto, imageBuffer, evenLogo, pageNumber, sequence, renderTotal);

    if (sequence % 50 === 0 || sequence === renderTotal) {
      log('Produtos renderizados', { renderizados: sequence, total: renderTotal });
    }
  }

  for (const produto of sortedProducts) {
    await renderProduto(produto);
  }

  pageNumber += 1;
  doc.addPage();
  addClosingPage(doc, coverLogo, pageNumber);

  pageNumber += 1;
  doc.addPage();

  doc.end();
  await new Promise<void>((resolve, reject) => {
    output.on('finish', resolve);
    output.on('error', reject);
  });

  log('Catalogo finalizado', {
    arquivo: absoluteOutputPath,
    produtos: sequence,
    paginas: pageNumber,
  });
}

main().catch((error) => {
  log('Catalogo interrompido por erro fatal', {
    erro: error instanceof Error ? error.message : String(error),
  });
  process.exitCode = 1;
});
