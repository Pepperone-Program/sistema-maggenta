import { ProdutoModel } from '@models/Produto';
import type { Produto, ProdutoCategoria, ProdutoImagem } from '@/types/produto';

const PRODUCT_URL_BASE =
  process.env.PRODUCT_URL_BASE || 'https://www.maggenta.com.br/brindes-personalizados';

function escapeXml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function cdata(value: unknown): string {
  return `<![CDATA[${String(value ?? '').replace(/]]>/g, ']]]]><![CDATA[>')}]]>`;
}

function formatDate(value: unknown): string {
  if (!value) return '';
  if (value instanceof Date) {
    return value.toLocaleString('sv-SE', {
      timeZone: 'America/Sao_Paulo',
      hour12: false,
    });
  }
  return String(value).replace('T', ' ').replace(/\.\d{3}Z?$/, '').slice(0, 19);
}

function nowInSaoPaulo(): string {
  return new Date().toLocaleString('sv-SE', {
    timeZone: 'America/Sao_Paulo',
    hour12: false,
  });
}

function imageFilename(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    return decodeURIComponent(pathname.slice(pathname.lastIndexOf('/') + 1));
  } catch {
    return url.slice(url.lastIndexOf('/') + 1);
  }
}

function productYear(produto: Produto): string {
  const modified = formatDate(produto.data_modificacao);
  return /^\d{4}/.test(modified) ? modified.slice(0, 4) : nowInSaoPaulo().slice(0, 4);
}

function renderCategories(categories: ProdutoCategoria[]): string {
  return [
    '    <categorias>',
    ...categories.flatMap((category) => [
      '      <categoria>',
      `        <cat_dsc>${escapeXml(category.categoria)}</cat_dsc>`,
      '      </categoria>',
    ]),
    '    </categorias>',
  ].join('\n');
}

function renderImages(produto: Produto, images: ProdutoImagem[]): string {
  return [
    '    <fotos>',
    ...images.flatMap((image, index) => [
      '      <foto>',
      `        <arquivo_foto>${escapeXml(imageFilename(image.url_imagem))}</arquivo_foto>`,
      `        <url_foto>${escapeXml(image.url_imagem)}</url_foto>`,
      `        <alt_foto>${escapeXml(`${produto.produto} ${index + 1}`)}</alt_foto>`,
      '        <foto_bloqueada>0</foto_bloqueada>',
      `        <foto_principal>${Number(image.ordem_imagem) === 1 ? '1' : '0'}</foto_principal>`,
      '      </foto>',
    ]),
    '    </fotos>',
  ].join('\n');
}

function renderProduct(
  produto: Produto,
  categories: ProdutoCategoria[],
  images: ProdutoImagem[]
): string {
  const description = produto.descricao || '';
  return [
    '  <produto>',
    `    <data_alt>${escapeXml(formatDate(produto.data_modificacao))}</data_alt>`,
    `    <prd_cod>${escapeXml(produto.codigo)}</prd_cod>`,
    `    <prd_titulo>${cdata(produto.produto)}</prd_titulo>`,
    `    <prd_dsc>${cdata(description)}</prd_dsc>`,
    '    <prd_preco></prd_preco>',
    `    <prd_description>${cdata(description)}</prd_description>`,
    '    <prd_tags></prd_tags>',
    `    <prd_qtdemin>${escapeXml(produto.quantidade_minima)}</prd_qtdemin>`,
    `    <prd_url>${escapeXml(`${PRODUCT_URL_BASE}/${produto.id_produto}`)}</prd_url>`,
    `    <prd_edicao>${productYear(produto)}</prd_edicao>`,
    `    <prd_inddesativ>${produto.habilitado === 'S' ? '0' : '1'}</prd_inddesativ>`,
    renderCategories(categories),
    renderImages(produto, images),
    '  </produto>',
  ].join('\n');
}

export class FreeshopService {
  static async generateXml(empresaId: number): Promise<string> {
    const produtos = await ProdutoModel.findAllForXmlFeed(empresaId);
    const productIds = produtos.map((produto) => Number(produto.id_produto));
    const [imagesByProduct, categoriesByProduct] = await Promise.all([
      ProdutoModel.findImagesByProductIds(productIds),
      ProdutoModel.findCategoriesByProductIds(empresaId, productIds),
    ]);

    const xml = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<produtos>',
      `  <data>${nowInSaoPaulo()}</data>`,
      ...produtos.map((produto) =>
        renderProduct(
          produto,
          categoriesByProduct.get(Number(produto.id_produto)) || [],
          imagesByProduct.get(Number(produto.id_produto)) || []
        )
      ),
      '</produtos>',
    ];

    return `${xml.join('\n')}\n`;
  }
}
