import { query } from '@database/connection';
import type { CreateOrcamentoDTO } from '@/types/orcamento';
import type { CreateOrcamentoItemDTO } from '@/types/orcamento-item';

type ProductImageRow = {
  id_produto: number;
  url_imagem: string;
};

type QuoteItemInput = Partial<CreateOrcamentoItemDTO> & {
  [key: string]: unknown;
  nome?: string;
  name?: string;
  title?: string;
  product?: unknown;
  produto_data?: unknown;
  price?: string | number;
  preco?: string | number;
  valor?: string | number;
  unitPrice?: string | number;
  unit_price?: string | number;
  precoFinal?: string | number;
  quantity?: string | number;
  qtd?: string | number;
  quantidadeSolicitada?: string | number;
  total?: string | number;
  image_url?: string;
  imagem_url?: string;
  url_imagem?: string;
};

type QuoteEmailInput = CreateOrcamentoDTO & {
  itens?: QuoteItemInput[];
  items?: QuoteItemInput[];
  produtos?: QuoteItemInput[];
  products?: QuoteItemInput[];
  orcamento_itens?: QuoteItemInput[];
  carrinho?: QuoteItemInput[];
  cart?: QuoteItemInput[];
  quoteItems?: QuoteItemInput[];
  quote_items?: QuoteItemInput[];
  produtos_orcados?: QuoteItemInput[];
  produtosOrcados?: QuoteItemInput[];
  selectedProducts?: QuoteItemInput[];
  selected_products?: QuoteItemInput[];
  cnpj_cpf?: string;
  documento?: string;
  empresa?: string;
};

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatDate(value: unknown): string {
  if (!value) return '-';
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return escapeHtml(value);
  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo' }).format(date);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readObjectValue(source: unknown, keys: string[]): unknown {
  if (!isRecord(source)) return undefined;

  for (const key of keys) {
    const value = source[key];
    if (value !== undefined && value !== null && value !== '') {
      return value;
    }
  }

  return undefined;
}

function itemScore(item: unknown): number {
  if (!isRecord(item)) return 0;

  const directKeys = [
    'produto',
    'nome',
    'name',
    'title',
    'productName',
    'product_name',
    'nome_produto',
    'codigo',
    'code',
    'sku',
    'id_produto',
    'productId',
    'product_id',
    'quantidade',
    'quantity',
    'qtd',
    'preco',
    'price',
    'valor',
    'total',
  ];
  const score = directKeys.reduce((sum, key) => {
    const value = item[key];
    return value !== undefined && value !== null && value !== '' ? sum + 1 : sum;
  }, 0);

  const nestedProduct = item.product || item.produto_data || item.produtoInfo;
  return score + (readObjectValue(nestedProduct, ['produto', 'nome', 'name', 'title', 'codigo', 'code']) ? 2 : 0);
}

function findNestedItemList(value: unknown, depth: number = 0): QuoteItemInput[] {
  if (depth > 5) return [];

  if (Array.isArray(value)) {
    const objectItems = value.filter(isRecord);
    if (objectItems.length) {
      const bestScore = Math.max(...objectItems.map(itemScore));
      if (bestScore >= 2) {
        return objectItems as QuoteItemInput[];
      }
    }

    for (const item of value) {
      const nested = findNestedItemList(item, depth + 1);
      if (nested.length) return nested;
    }
  }

  if (isRecord(value)) {
    for (const nestedValue of Object.values(value)) {
      const nested = findNestedItemList(nestedValue, depth + 1);
      if (nested.length) return nested;
    }
  }

  return [];
}

function getQuoteItems(data: QuoteEmailInput): QuoteItemInput[] {
  const possibleKeys = [
    'itens',
    'items',
    'produtos',
    'products',
    'orcamento_itens',
    'carrinho',
    'cart',
    'quoteItems',
    'quote_items',
    'produtos_orcados',
    'produtosOrcados',
    'selectedProducts',
    'selected_products',
    'productItems',
    'product_items',
  ];
  const record = data as Record<string, unknown>;

  for (const key of possibleKeys) {
    const value = record[key];
    if (Array.isArray(value) && value.length > 0) {
      return value.filter(isRecord) as QuoteItemInput[];
    }
  }

  return findNestedItemList(data);
}

function getItemProductName(item: QuoteItemInput): unknown {
  return (
    item.produto ||
    item.nome ||
    item.name ||
    item.title ||
    item.productName ||
    item.product_name ||
    item.nome_produto ||
    readObjectValue(item.product, ['produto', 'nome', 'name', 'title', 'productName', 'product_name']) ||
    readObjectValue(item.produto_data, ['produto', 'nome', 'name', 'title', 'productName', 'product_name']) ||
    'Produto sem nome'
  );
}

function getItemCode(item: QuoteItemInput): unknown {
  return (
    item.codigo ||
    item.code ||
    item.sku ||
    readObjectValue(item.product, ['codigo', 'code', 'sku']) ||
    readObjectValue(item.produto_data, ['codigo', 'code', 'sku'])
  );
}

function getItemProductId(item: QuoteItemInput): number | null {
  const value =
    item.id_produto ||
    item.productId ||
    item.product_id ||
    readObjectValue(item.product, ['id_produto', 'productId', 'product_id', 'id']) ||
    readObjectValue(item.produto_data, ['id_produto', 'productId', 'product_id', 'id']);
  const productId = Number(value);

  return Number.isInteger(productId) && productId > 0 ? productId : null;
}

function getItemImageUrl(
  item: QuoteItemInput,
  primaryImageUrls: ReadonlyMap<number, string>
): string | null {
  const productId = getItemProductId(item);
  const databaseUrl = productId ? primaryImageUrls.get(productId) : undefined;
  if (databaseUrl) {
    return databaseUrl;
  }

  const explicitUrl =
    item.url_imagem ||
    item.imagem_url ||
    item.image_url ||
    readObjectValue(item.product, ['url_imagem', 'imagem_url', 'image_url']) ||
    readObjectValue(item.produto_data, ['url_imagem', 'imagem_url', 'image_url']);

  if (explicitUrl) {
    return String(explicitUrl);
  }

  return null;
}

function getItemQuantity(item: QuoteItemInput): unknown {
  return item.quantidade || item.quantity || item.qtd || item.quantidadeSolicitada || 1;
}

function renderItems(
  items: QuoteItemInput[],
  primaryImageUrls: ReadonlyMap<number, string>
): string {
  if (!items.length) {
    return `
      <tr>
        <td colspan="4" style="padding:14px 12px;font-size:14px;color:#6b7280;border-bottom:1px solid #e5e7eb;">
          Nenhum item detalhado foi enviado no payload.
        </td>
      </tr>
    `;
  }

  return items
    .map((item) => {
      const product = getItemProductName(item);
      const codeValue = getItemCode(item);
      const quantity = getItemQuantity(item);
      const imageUrl = getItemImageUrl(item, primaryImageUrls);

      return `
        <tr>
          <td width="88" style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:14px;color:#6b7280;vertical-align:middle;">
            ${
              imageUrl
                ? `<img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(product)}" width="72" height="72" style="display:block;width:72px;height:72px;object-fit:contain;border:1px solid #e5e7eb;border-radius:6px;background:#ffffff;" />`
                : '&mdash;'
            }
          </td>
          <td style="padding:12px;border-bottom:1px solid #e5e7eb;font-size:14px;color:#111827;">
            ${escapeHtml(codeValue || '-')}
          </td>
          <td style="padding:12px;border-bottom:1px solid #e5e7eb;font-size:14px;color:#111827;">
            <strong>${escapeHtml(product)}</strong>
          </td>
          <td align="right" style="padding:12px;border-bottom:1px solid #e5e7eb;font-size:14px;color:#1f2937;">
            ${escapeHtml(quantity)}
          </td>
        </tr>
      `;
    })
    .join('');
}

function renderObservation(obs?: string): string {
  if (!obs) return '';

  return `
    <div style="margin-top:26px;padding:16px;border-radius:10px;background:#f0faf5;border:1px solid #049e53;">
      <p style="margin:0 0 6px;font-size:11px;color:#049e53;text-transform:uppercase;letter-spacing:1px;font-weight:700;">
        Observacoes
      </p>
      <p style="margin:0;font-size:14px;color:#1f2937;line-height:1.6;white-space:pre-line;">${escapeHtml(obs)}</p>
    </div>
  `;
}

export class OrcamentoEmailService {
  private static async getPrimaryImageUrls(
    items: QuoteItemInput[]
  ): Promise<Map<number, string>> {
    const productIds = Array.from(
      new Set(
        items
          .map(getItemProductId)
          .filter((productId): productId is number => productId !== null)
      )
    );

    if (!productIds.length) {
      return new Map();
    }

    const placeholders = productIds.map(() => '?').join(', ');
    const rows = (await query(
      `
        SELECT id_produto, url_imagem
        FROM imagens_produtos
        WHERE id_produto IN (${placeholders})
          AND url_imagem IS NOT NULL
          AND url_imagem <> ''
        ORDER BY id_produto ASC, ordem_imagem ASC, id_imagem ASC
      `,
      productIds
    )) as ProductImageRow[];
    const primaryImageUrls = new Map<number, string>();

    for (const row of rows) {
      const productId = Number(row.id_produto);
      if (!primaryImageUrls.has(productId)) {
        primaryImageUrls.set(productId, row.url_imagem);
      }
    }

    return primaryImageUrls;
  }

  static hasQuoteItems(data: QuoteEmailInput): boolean {
    return getQuoteItems(data).length > 0;
  }

  static renderTemplate(
    data: QuoteEmailInput,
    quoteNumber?: number,
    primaryImageUrls: ReadonlyMap<number, string> = new Map()
  ): string {
    const items = getQuoteItems(data);
    const company = data.empresa || data.fantasia || '-';
    const address = [
      data.endereco,
      data.endereco_n,
      data.endereco_compl,
      data.bairro,
      data.cidade,
      data.uf,
      data.cep,
      data.pais,
    ]
      .filter(Boolean)
      .join(', ');

    return `<!DOCTYPE html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>Novo Orcamento Maggenta</title>
  </head>
  <body style="margin:0;padding:0;background:#f5f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1f2937;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f7;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="680" cellpadding="0" cellspacing="0" style="max-width:680px;width:100%;">
            <tr>
              <td style="background:#ec3694;border-radius:14px 14px 0 0;padding:26px 30px;">
                <p style="margin:0;color:#ffffff;opacity:0.88;font-size:12px;letter-spacing:1px;text-transform:uppercase;font-weight:700;">
                  Novo orcamento recebido pelo site
                </p>
                <h1 style="margin:8px 0 0;color:#ffffff;font-size:28px;font-weight:800;line-height:1.2;">
                  Maggenta Brindes ${quoteNumber ? `#${quoteNumber}` : ''}
                </h1>
                <p style="margin:8px 0 0;color:#ffffff;font-size:14px;opacity:0.9;">
                  <a href="https://www.maggenta.com.br" style="color:#ffffff !important;text-decoration:none;">https://www.maggenta.com.br</a>
                </p>
              </td>
            </tr>
            <tr>
              <td style="background:#ffffff;padding:30px;">
                <p style="margin:0 0 4px;font-size:11px;color:#ec4c9c;text-transform:uppercase;letter-spacing:1px;font-weight:700;">Cliente</p>
                <p style="margin:0 0 22px;font-size:20px;font-weight:800;color:#111827;">${escapeHtml(data.contato || data.fantasia || '-')}</p>

                <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;margin-bottom:28px;">
                  <tr>
                    <td style="padding:7px 14px 7px 0;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:.5px;font-weight:700;white-space:nowrap;vertical-align:top;width:1%;">Empresa</td>
                    <td style="padding:7px 0;font-size:14px;color:#1f2937;vertical-align:top;">${escapeHtml(company)}</td>
                  </tr>
                  <tr>
                    <td style="padding:7px 14px 7px 0;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:.5px;font-weight:700;white-space:nowrap;vertical-align:top;width:1%;">Email</td>
                    <td style="padding:7px 0;font-size:14px;color:#1f2937;vertical-align:top;">${escapeHtml(data.email || '-')}</td>
                  </tr>
                  <tr>
                    <td style="padding:7px 14px 7px 0;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:.5px;font-weight:700;white-space:nowrap;vertical-align:top;width:1%;">Telefone</td>
                    <td style="padding:7px 0;font-size:14px;color:#1f2937;vertical-align:top;">${escapeHtml(data.tel || '-')}</td>
                  </tr>
                  <tr>
                    <td style="padding:7px 14px 7px 0;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:.5px;font-weight:700;white-space:nowrap;vertical-align:top;width:1%;">Documento</td>
                    <td style="padding:7px 0;font-size:14px;color:#1f2937;vertical-align:top;">${escapeHtml(data.cnpj_cpf || data.documento || '-')}</td>
                  </tr>
                  <tr>
                    <td style="padding:7px 14px 7px 0;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:.5px;font-weight:700;white-space:nowrap;vertical-align:top;width:1%;">Data</td>
                    <td style="padding:7px 0;font-size:14px;color:#1f2937;vertical-align:top;">${formatDate(data.data_orcamento || new Date())}</td>
                  </tr>
                  <tr>
                    <td style="padding:7px 14px 7px 0;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:.5px;font-weight:700;white-space:nowrap;vertical-align:top;width:1%;">Endereco</td>
                    <td style="padding:7px 0;font-size:14px;color:#1f2937;vertical-align:top;">${escapeHtml(address || '-')}</td>
                  </tr>
                  <tr>
                    <td style="padding:7px 14px 7px 0;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:.5px;font-weight:700;white-space:nowrap;vertical-align:top;width:1%;">Entrega</td>
                    <td style="padding:7px 0;font-size:14px;color:#1f2937;vertical-align:top;">${escapeHtml(data.entrega || '-')}</td>
                  </tr>
                </table>

                <p style="margin:0 0 12px;font-size:11px;color:#ec4c9c;text-transform:uppercase;letter-spacing:1px;font-weight:700;">Produtos solicitados</p>

                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
                  <thead>
                    <tr style="background:#f9fafb;">
                      <th align="left" style="padding:10px 12px;font-size:11px;color:#6b7280;font-weight:700;text-transform:uppercase;letter-spacing:.5px;border-bottom:1px solid #e5e7eb;">Imagem</th>
                      <th align="left" style="padding:10px 12px;font-size:11px;color:#6b7280;font-weight:700;text-transform:uppercase;letter-spacing:.5px;border-bottom:1px solid #e5e7eb;">Codigo</th>
                      <th align="left" style="padding:10px 12px;font-size:11px;color:#6b7280;font-weight:700;text-transform:uppercase;letter-spacing:.5px;border-bottom:1px solid #e5e7eb;">Nome</th>
                      <th align="right" style="padding:10px 12px;font-size:11px;color:#6b7280;font-weight:700;text-transform:uppercase;letter-spacing:.5px;border-bottom:1px solid #e5e7eb;">Qtd</th>
                    </tr>
                  </thead>
                  <tbody>${renderItems(items, primaryImageUrls)}</tbody>
                </table>

                ${renderObservation(data.obs)}
              </td>
            </tr>
            <tr>
              <td style="background:#fafafa;border-radius:0 0 14px 14px;padding:22px 30px;text-align:center;">
                <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.6;">
                  <strong style="color:#6b7280;">Maggenta Brindes</strong> - Brindes Corporativos Personalizados<br />
                  Notificacao automatica - Acesse o painel admin para responder ao cliente
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
  }

  static async sendQuoteEmail(data: QuoteEmailInput, quoteNumber?: number): Promise<boolean> {
    const resendApiKey = process.env.RESEND_API_KEY?.trim();
    const fromEmail = process.env.RESEND_FROM_EMAIL?.trim();

    if (!resendApiKey || !fromEmail) {
      console.warn('[OrcamentoEmailService] Resend nao configurado para envio de orcamento');
      return false;
    }

    const primaryImageUrls = await this.getPrimaryImageUrls(getQuoteItems(data));
    const emailBody: Record<string, unknown> = {
      from: fromEmail,
      to: [fromEmail],
      subject: `Novo orcamento Maggenta ${quoteNumber ? ` #${quoteNumber}` : ''} - ${data.fantasia || data.contato || 'Site'}`,
      html: this.renderTemplate(data, quoteNumber, primaryImageUrls),
    };

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(emailBody),
    });

    if (!response.ok) {
      const result = (await response.json().catch(() => null)) as { message?: string } | null;
      throw new Error(result?.message || `Falha ao enviar email de orcamento: HTTP ${response.status}`);
    }

    return true;
  }
}
