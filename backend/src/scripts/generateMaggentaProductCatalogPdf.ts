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
  logoUrl: string;
};

type SocialLink = {
  name: string;
  url: string;
  icon: 'linkedin' | 'whatsapp' | 'instagram' | 'site';
};

type ProductDetail = {
  label: string;
  value: string;
};

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MAGGENTA_PINK = '#db2777';
const MAGGENTA_GREEN = '#166534';
const TEXT_DARK = '#15151f';
const TEXT_MUTED = '#697386';
const BORDER = '#e7eaf0';
const SOFT_PINK = '#fce7f3';
const SOFT_GREEN = '#dcfce7';
const LOGO_URL =
  'https://kabftbmncilygvpcyazc.supabase.co/storage/v1/object/public/imagem_empresa/LOGO_MAGGENTA_HORIZONTAL_SEM_FUNDO%20(1).png';
const PRODUCT_URL_BASE = 'https://www.maggenta.com.br/brindes-personalizados';
const SOCIAL_LINKS: SocialLink[] = [
  { name: 'Site', url: 'https://www.maggenta.com.br', icon: 'site' },
  {
    name: 'LinkedIn',
    url: 'https://www.linkedin.com/company/maggenta-brindes-promocionais/posts/?feedView=all',
    icon: 'linkedin',
  },
  { name: 'Instagram', url: 'https://www.instagram.com/brindesmaggenta', icon: 'instagram' },
  {
    name: 'WhatsApp',
    url: 'https://api.whatsapp.com/send/?phone=5511993303533&text&type=phone_number&app_absent=0',
    icon: 'whatsapp',
  },
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
    outputPath: process.env.CATALOG_OUTPUT_PATH?.trim() || 'catalogos/catalogo-produtos-maggenta.pdf',
    empresaId: numberEnv('CATALOG_EMPRESA_ID', 1),
    pageLimit: numberEnv('CATALOG_PAGE_LIMIT', 100),
    maxProducts: Number(process.env.CATALOG_MAX_PRODUCTS || 0),
    requestTimeoutMs: numberEnv('CATALOG_REQUEST_TIMEOUT_MS', 30000),
    maxRetries: numberEnv('CATALOG_MAX_RETRIES', 3),
    logoUrl: process.env.CATALOG_MAGGENTA_LOGO_URL?.trim() || LOGO_URL,
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

function drawGradientWave(
  doc: PDFKit.PDFDocument,
  startY: number,
  endY: number,
  lineWidth: number,
  opacity: number,
  reverse = false
) {
  const gradient = (doc as unknown as { linearGradient: (x1: number, y1: number, x2: number, y2: number) => PDFKit.PDFLinearGradient })
    .linearGradient(0, startY, PAGE_WIDTH, endY)
    .stop(0, reverse ? MAGGENTA_GREEN : MAGGENTA_PINK)
    .stop(0.54, reverse ? '#5f7d58' : '#7c516a')
    .stop(1, reverse ? MAGGENTA_PINK : '#00a85a');

  doc
    .save()
    .opacity(opacity)
    .lineWidth(lineWidth)
    .lineCap('round')
    .strokeColor(gradient as unknown as string)
    .moveTo(-60, startY)
    .bezierCurveTo(145, startY + 58, 290, endY - 104, PAGE_WIDTH + 72, endY)
    .stroke()
    .restore();
}



function addDecorativeBackground(doc: PDFKit.PDFDocument, showWaves = false) {
  doc.save();
  doc.rect(0, 0, PAGE_WIDTH, PAGE_HEIGHT).fill('#FFFFFF');
  doc.circle(PAGE_WIDTH - 22, 118, 120).fillOpacity(0.34).fill(SOFT_PINK);
  doc.circle(20, PAGE_HEIGHT - 42, 132).fillOpacity(0.28).fill(SOFT_GREEN);
  doc.circle(PAGE_WIDTH - 86, PAGE_HEIGHT - 104, 124).fillOpacity(0.2).fill(SOFT_PINK);
  doc.restore();

  if (showWaves) {
    drawGradientWave(doc, 120, 64, 18, 0.95);
    drawGradientWave(doc, PAGE_HEIGHT - 120, PAGE_HEIGHT - 186, 14, 0.9, true);
    drawGradientWave(doc, PAGE_HEIGHT - 82, PAGE_HEIGHT - 136, 5, 0.34);
  }
}

function drawCenteredLogo(doc: PDFKit.PDFDocument, logoBuffer: Buffer | null, y: number, width = 190, height = 62) {
  if (!logoBuffer) {
    doc
      .fillColor(MAGGENTA_PINK)
      .font('Helvetica')
      .fontSize(25)
      .text('MAGGENTA', (PAGE_WIDTH - width) / 2, y + 16, { width, align: 'center' });
    return;
  }

  doc.image(logoBuffer, (PAGE_WIDTH - width) / 2, y, {
    fit: [width, height],
    align: 'center',
    valign: 'center',
  });
}

function addCover(doc: PDFKit.PDFDocument, logoBuffer: Buffer | null, total: number) {
  // capa: manter as ondas (primeira pagina)
  addDecorativeBackground(doc, true);
  drawCenteredLogo(doc, logoBuffer, 94, 250, 92);

  doc
    .fillColor(TEXT_DARK)
    .font('Helvetica-Bold')
    .fontSize(32)
    .text('Catalogo de Produtos', 66, 260, { width: PAGE_WIDTH - 132, align: 'center' });
  doc
    .fillColor(MAGGENTA_PINK)
    .font('Helvetica-Bold')
    .fontSize(11)
    .text('BRINDES PERSONALIZADOS', 66, 307, {
      width: PAGE_WIDTH - 132,
      align: 'center',
      characterSpacing: 2.2,
    });
  doc
    .fillColor(TEXT_MUTED)
    .font('Helvetica')
    .fontSize(12)
    .text(`${total} produtos selecionados`, 66, 360, { width: PAGE_WIDTH - 132, align: 'center' });

  doc
    .roundedRect(166, 430, 264, 68, 18)
    .fillOpacity(0.96)
    .fill('#FFFFFF')
    .fillOpacity(1)
    .strokeColor(BORDER)
    .stroke();
  doc
    .fillColor(MAGGENTA_GREEN)
    .font('Helvetica-Bold')
    .fontSize(10)
    .text('maggenta.com.br', 166, 456, { width: 264, align: 'center', characterSpacing: 1.1 });
  doc.link(166, 430, 264, 68, 'https://www.maggenta.com.br');
}

function productDetails(produto: ProdutoSite): ProductDetail[] {
  return [
    { label: 'Codigo', value: formatValue(produto.codigo) },
    { label: 'Altura', value: formatValue(produto.altura, ' cm') },
    { label: 'Largura', value: formatValue(produto.largura, ' cm') },
    { label: 'Profundidade', value: formatValue(produto.profundidade, ' cm') },
    { label: 'Peso', value: formatValue(produto.peso, ' g') },
    { label: 'Quantidade minima', value: formatValue(produto.quantidade_minima) },
  ];
}

function addNoImagePlaceholder(doc: PDFKit.PDFDocument, x: number, y: number, width: number, height: number) {
  doc.save();
  doc.roundedRect(x, y, width, height, 26).fill('#FFFFFF');
  doc.roundedRect(x, y, width, height, 26).strokeColor(BORDER).lineWidth(1).stroke();
  doc.circle(x + width / 2, y + height / 2 - 20, 31).strokeColor(MAGGENTA_PINK).lineWidth(2).stroke();
  doc.moveTo(x + width / 2 - 46, y + height / 2 + 26).lineTo(x + width / 2 + 46, y + height / 2 + 26).stroke();
  doc.fillColor(TEXT_MUTED).font('Helvetica-Bold').fontSize(12).text('Imagem indisponivel', x, y + height / 2 + 50, {
    width,
    align: 'center',
  });
  doc.restore();
}

function drawDetailCell(doc: PDFKit.PDFDocument, detail: ProductDetail, x: number, y: number, width: number, accent: string) {
  doc.save();
  doc.roundedRect(x, y, width, 42, 10).fill('#FFFFFF');
  doc.roundedRect(x, y, width, 42, 10).strokeColor(BORDER).lineWidth(0.7).stroke();
  doc.circle(x + 16, y + 21, 4).fill(accent);
  doc.fillColor(TEXT_MUTED).font('Helvetica-Bold').fontSize(7.5).text(detail.label.toUpperCase(), x + 30, y + 9, {
    width: width - 42,
    ellipsis: true,
  });
  doc.fillColor(TEXT_DARK).font('Helvetica-Bold').fontSize(11.2).text(detail.value, x + 30, y + 22, {
    width: width - 42,
    ellipsis: true,
  });
  doc.restore();
}

function addProductPage(
  doc: PDFKit.PDFDocument,
  produto: ProdutoSite,
  productImage: Buffer | null,
  logoBuffer: Buffer | null,
  sequence: number,
  total: number
) {
  addDecorativeBackground(doc, false);
  drawCenteredLogo(doc, logoBuffer, 35, 190, 58);

  const imagePanelX = 86;
  const imagePanelY = 134;
  const imagePanelWidth = PAGE_WIDTH - 172;
  const imagePanelHeight = 428;
  const productUrl = productPageUrl(produto);

  doc.save();
  doc.roundedRect(imagePanelX, imagePanelY, imagePanelWidth, imagePanelHeight, 28).fill('#FFFFFF');
  doc.roundedRect(imagePanelX, imagePanelY, imagePanelWidth, imagePanelHeight, 28).strokeColor(BORDER).lineWidth(0.9).stroke();
  doc.restore();

  if (productImage) {
    doc.image(productImage, imagePanelX + 34, imagePanelY + 34, {
      fit: [imagePanelWidth - 68, imagePanelHeight - 68],
      align: 'center',
      valign: 'center',
    });
    doc.link(imagePanelX, imagePanelY, imagePanelWidth, imagePanelHeight, productUrl);
  } else {
    addNoImagePlaceholder(doc, imagePanelX + 34, imagePanelY + 78, imagePanelWidth - 68, 252);
  }

  const infoX = 52;
  const infoY = 594;
  const infoWidth = PAGE_WIDTH - 104;
  doc
    .fillColor(TEXT_DARK)
    .font('Helvetica-Bold')
    .fontSize(20)
    .text(formatValue(produto.produto), infoX, infoY, {
      width: infoWidth,
      align: 'center',
      height: 26,
      ellipsis: true,
    });

  const details = productDetails(produto);
  const colGap = 14;
  const rowGap = 10;
  const cellWidth = (infoWidth - colGap) / 2;
  const leftX = infoX;
  const rightX = infoX + cellWidth + colGap;
  const firstRowY = infoY + 46;

  details.forEach((detail, index) => {
    const column = index < 3 ? 0 : 1;
    const row = column === 0 ? index : index - 3;
    drawDetailCell(doc, detail, column === 0 ? leftX : rightX, firstRowY + row * (42 + rowGap), cellWidth, index % 2 === 0 ? MAGGENTA_PINK : MAGGENTA_GREEN);
  });

  doc
    .fillColor(TEXT_MUTED)
    .font('Helvetica')
    .fontSize(8)
    .text(`${sequence}/${total}  Produto #${produto.id_produto}`, 42, PAGE_HEIGHT - 37, { width: 190 });
  doc
    .fillColor(MAGGENTA_GREEN)
    .font('Helvetica-Bold')
    .fontSize(8)
    .text('Ver produto online', PAGE_WIDTH - 188, PAGE_HEIGHT - 37, { width: 146, align: 'right' });
  doc.link(PAGE_WIDTH - 188, PAGE_HEIGHT - 42, 146, 18, productUrl);
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
  doc.circle(x + size / 2, y + size / 2, size / 2).fill(link.icon === 'whatsapp' || link.icon === 'site' ? MAGGENTA_GREEN : MAGGENTA_PINK);
  doc.fillColor('#FFFFFF').strokeColor('#FFFFFF').lineWidth(1.8);

  if (link.icon === 'linkedin') drawLinkedinIcon(doc, x, y, size);
  if (link.icon === 'whatsapp') drawWhatsappIcon(doc, x, y, size);
  if (link.icon === 'instagram') drawInstagramIcon(doc, x, y, size);
  if (link.icon === 'site') drawSiteIcon(doc, x, y, size);

  doc.link(x, y, size, size, link.url);
  doc.restore();
}

function addClosingPage(doc: PDFKit.PDFDocument, logoBuffer: Buffer | null, pageNumber: number) {
  // ultima pagina: manter as ondas
  addDecorativeBackground(doc, true);
  drawCenteredLogo(doc, logoBuffer, 120, 250, 90);

  doc
    .fillColor(TEXT_DARK)
    .font('Helvetica-Bold')
    .fontSize(25)
    .text('Fale Conosco', 70, 270, { width: PAGE_WIDTH - 140, align: 'center' });
  doc
    .fillColor(TEXT_MUTED)
    .font('Helvetica')
    .fontSize(13)
    .text('Confira novidades, solicite orcamentos e veja mais opcoes de brindes personalizados.', 94, 320, {
      width: PAGE_WIDTH - 188,
      align: 'center',
      lineGap: 5,
    });

  const iconSize = 58;
  const iconGap = 30;
  const iconsWidth = SOCIAL_LINKS.length * iconSize + (SOCIAL_LINKS.length - 1) * iconGap;
  const iconY = 420;
  let iconX = (PAGE_WIDTH - iconsWidth) / 2;

  for (const link of SOCIAL_LINKS) {
    drawSocialIcon(doc, link, iconX, iconY, iconSize);
    doc.fillColor(TEXT_DARK).font('Helvetica-Bold').fontSize(9).text(link.name, iconX - 10, iconY + iconSize + 12, {
      width: iconSize + 20,
      align: 'center',
    });
    iconX += iconSize + iconGap;
  }

  doc.fillColor(TEXT_MUTED).font('Helvetica').fontSize(8).text(`Pagina ${pageNumber}`, 42, PAGE_HEIGHT - 37, {
    width: 140,
  });
}

async function main() {
  const config = getConfig();
  const absoluteOutputPath = path.resolve(process.cwd(), config.outputPath);
  await fsp.mkdir(path.dirname(absoluteOutputPath), { recursive: true });

  log('Catalogo Maggenta iniciado', {
    api: config.apiUrl,
    saida: absoluteOutputPath,
    empresaId: config.empresaId,
    limitePorPagina: config.pageLimit,
    maxProdutos: config.maxProducts || 'todos',
  });

  const [logoBuffer, firstPage] = await Promise.all([
    fetchBuffer(config, config.logoUrl).catch((error) => {
      log('Logo Maggenta nao foi carregada', { erro: error instanceof Error ? error.message : String(error) });
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
      Title: 'Catalogo de Produtos Maggenta',
      Author: 'Maggenta',
      Subject: 'Catalogo de produtos do site',
      Creator: 'Maggenta Site Admin',
    },
  });

  const output = fs.createWriteStream(absoluteOutputPath);
  doc.pipe(output);

  let pageNumber = 1;
  doc.addPage();
  addCover(doc, logoBuffer, renderTotal);

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

    addProductPage(doc, produto, imageBuffer, logoBuffer, sequence, renderTotal);

    if (sequence % 50 === 0 || sequence === renderTotal) {
      log('Produtos renderizados', { renderizados: sequence, total: renderTotal });
    }
  }

  for (const produto of sortedProducts) {
    await renderProduto(produto);
  }

  pageNumber += 1;
  doc.addPage();
  addClosingPage(doc, logoBuffer, pageNumber);

  doc.end();
  await new Promise<void>((resolve, reject) => {
    output.on('finish', resolve);
    output.on('error', reject);
  });

  log('Catalogo Maggenta finalizado', {
    arquivo: absoluteOutputPath,
    produtos: sequence,
    paginas: pageNumber,
  });
}

main().catch((error) => {
  log('Catalogo Maggenta interrompido por erro fatal', {
    erro: error instanceof Error ? error.message : String(error),
  });
  process.exitCode = 1;
});
