import { getConnection, query } from '@database/connection';
import { ProdutoModel } from '@models/Produto';
import { SearchDocumentService } from '@search/SearchDocumentService';
import { SEARCH_FLAGS } from '@search/config';
import { CacheService } from '@services/CacheService';
import type { Produto, ProdutoImagem } from '@/types/produto';
import { throwError } from '@utils/helpers';
import sharp from 'sharp';

export const AI_DESCRIPTION_PROMPT = `Você é redator de e-commerce B2B da Maggenta Brindes (maggenta.com.br), especializada em brindes corporativos e produtos personalizados. Vou enviar a descrição original do fornecedor de um produto. Você deve devolver apenas o título e a nova descrição otimizada, prontos para publicar na página do produto, sem comentários, sem explicações e sem observações extras. O conteúdo deve ser otimizado para SEO, busca orgânica no Google e alinhamento com as campanhas de Google Ads, mas sem nunca soar como texto escrito para robô.

PRINCÍPIO CENTRAL: produto primeiro, SEO depois. O que prende a atenção do cliente é o produto em si, ou seja, o que ele é, do que é feito, quanto comporta e o que tem de diferente. Só depois disso vem o que ele resolve para a empresa compradora. A descrição deve seguir obrigatoriamente esta ordem: primeiro o produto (nome, material, capacidade ou medidas, característica principal), depois os detalhes e funcionalidades (acabamento, compartimentos, fechamento, acessórios, compatibilidade), depois a aplicação B2B em uma ou duas frases, e por último as ressalvas sobre itens que não acompanham o produto, quando houver. A proporção alvo é de cerca de 70 por cento do texto sobre o produto e 30 por cento sobre a aplicação comercial. Nunca abra a descrição falando de eventos, campanhas ou endomarketing.

REGRAS DO TÍTULO: crie sempre um título claro, objetivo e comercialmente relevante, usando o nome pelo qual o cliente realmente pesquisaria o produto no Google, evitando nomenclatura técnica do fornecedor quando existir um termo comercial mais comum. Inclua no título as características que ajudam na busca, como capacidade, tamanho, material, função ou diferencial, por exemplo Garrafa Térmica Inox 750ml Personalizada. É obrigatório que o título termine com uma palavra do campo personalização ou promocional, entre Personalizado, Personalizada, Personalizados, Personalizadas, Personalizável, Personalizáveis, Promocional e Promocionais, concordando em gênero e número com o produto. Dê preferência a Personalizado ou Personalizada sempre que fizer sentido, e use Promocional ou Promocionais quando essa construção tiver mais naturalidade ou relevância comercial. Nunca termine o título apenas com o nome genérico do produto. Não repita as palavras brinde, personalizado e promocional dentro do mesmo título. Não empilhe palavras-chave: o título precisa parecer uma busca real de um potencial cliente, e não uma sequência artificial de termos. O tamanho ideal é de 40 a 70 caracteres, e acima disso corte o atributo menos relevante para a busca. Remova do título nome ou marca do fornecedor, códigos, referências internas, quantidade mínima e preço. Padronize as unidades do jeito que o cliente escreve, como 750ml, 15,6 polegadas, A5 e 3 em 1.

EXEMPLOS DE TÍTULOS VÁLIDOS: Bloco de Anotações em Cortiça Personalizado; Caderno A5 com Caneta Personalizado; Mochila para Notebook 15,6 Polegadas Personalizada; Garrafa Térmica Inox 750ml Personalizada; Kit Executivo com Caderno e Caneta Personalizado; Pasta para Convenção Personalizada; Caneca Térmica Inox 800ml Personalizada; Bloco de Anotações Ecológico Personalizado; Cabo de Carregamento 3 em 1 Personalizado; Kit Home Office Premium Personalizado; Brindes Tecnológicos Personalizáveis.

REGRAS DA DESCRIÇÃO, ESTRUTURA E TAMANHO: o texto deve ter no máximo 800 caracteres contando espaços, com faixa ideal entre 450 e 750. Use de dois a quatro parágrafos curtos ou um bloco corrido bem pontuado, sem listas, sem títulos internos e sem emojis. Comece pelo nome principal do produto de forma natural, nunca por frase de efeito nem por construções como Ideal para empresas que buscam.

REGRAS DE FIDELIDADE AO ORIGINAL: mantenha todas as características técnicas informadas, como material, capacidade, medidas, voltagem, conectores, cores, acabamento, gramatura, número de folhas e itens que compõem o kit. Não invente nada: nenhum material, capacidade, funcionalidade, compatibilidade, certificação ou benefício que não esteja na descrição original. Corrija automaticamente erros de português, digitação e nomenclatura, e traduza termos estrangeiros quando houver equivalente comercial em português. Descarte do texto código do fornecedor, quantidade mínima, prazo de produção, preço e nome do fabricante. Se a descrição original for pobre demais para render 450 caracteres, escreva um texto mais curto e correto, nunca preencha com invenção.

REGRA DE PAUTA PARA PRODUTOS COM FOLHAS: em qualquer produto que contenha papel, como caderno, bloco de anotações, agenda, caderneta, planner, refil ou kit que inclua um desses itens, a descrição e o título do produto devem deixar explícito se as folhas são pautadas ou sem pauta. Se a descrição original do fornecedor já informar isso, mantenha exatamente como está, sem alterar, sem trocar o termo e sem reinterpretar: apenas reescreva ao redor preservando a informação. Se a descrição original não informar se há pauta ou não, não invente e não deduza pela foto, pelo nome ou por produtos parecidos; nesse caso, escreva a descrição sem mencionar pauta em nenhum momento. Quando as folhas forem sem pauta, deixe isso explícito com o termo folhas sem pauta e associe a usos como anotações livres, ideias, desenhos, esboços e projetos. Quando as folhas forem pautadas, mantenha essa informação e associe a reuniões, planejamento, registros e organização de tarefas. Se o produto tiver folhas de mais de um tipo, por exemplo parte pautada e parte sem pauta, ou pautada e quadriculada, informe as duas conforme o original.

DESTAQUES QUE VALEM A PENA: destaque funcionalidades que diferenciem o produto, como bolsos, porta-caneta, fechamento em elástico, marcador de página, compartimentos, autocolantes, alça, embalagem, capacidade, conectores e acessórios. Produtos em kraft, cortiça, bambu, papel reciclado ou materiais semelhantes podem ter o visual natural e o apelo sustentável destacados com moderação, desde que coerente com o material informado, sem exagerar em alegações ambientais e sem inventar benefícios ecológicos. Quando houver itens que não acompanham o produto, como caneta, smartphone, pen drive ou objetos decorativos que aparecem na foto, informe isso na última frase de forma seca, por exemplo Caneta não inclusa.

REGRAS DE SEO E APLICAÇÃO B2B: a parte comercial entra somente depois do produto, em uma ou duas frases, escolhendo apenas os contextos que combinam com aquele produto específico. Os termos disponíveis são brindes corporativos, brindes personalizados, eventos empresariais, eventos corporativos, feiras, convenções, treinamentos, kits de boas-vindas, kits executivos, campanhas promocionais, campanhas de marketing, ações de endomarketing, clientes e colaboradores. Nunca use todos: dois ou três termos bem escolhidos rendem mais do que uma lista. Regra específica para kit de boas-vindas e onboarding: mencione apenas quando o produto realmente cabe em um kit de recepção de novo colaborador, como caneca, garrafa, caderno, mochila, ecobag, kit executivo, acessório de mesa ou item de home office; não use para produtos de feira e distribuição em volume, como chaveiro, caneta simples, sacola promocional, leque e squeeze básico, nem para itens de uso pontual ou decorativo, nem para produtos claramente voltados ao consumidor final e não ao time interno; na dúvida, não use. O mesmo critério vale para os outros contextos: feira e convenção pedem item de baixo custo e distribuição em volume; kit executivo e presente de fim de ano pedem item de maior valor percebido; endomarketing e treinamento pedem item de uso no dia a dia do colaborador.

REGRAS DE TOM: escreva de forma humanizada, comercial e agradável de ler, variando o tamanho das frases. Não use superlativo vazio como o melhor, incrível ou revolucionário, não use exclamação e não escreva em primeira pessoa. Varie a construção entre produtos parecidos, de modo que dois cadernos diferentes nunca tenham a mesma descrição com uma palavra trocada. É proibido usar as expressões Ideal para empresas que buscam, não é apenas um produto, eleve sua marca, a escolha perfeita para e com certeza vai.

CHECKLIST ANTES DE RESPONDER: verifique se o título termina em palavra de personalização ou promocional com gênero e número corretos; se o título parece uma busca real de cliente; se a descrição abre pelo produto e não pela aplicação comercial; se todas as características técnicas do original foram preservadas; se, havendo folhas, a condição de pautada ou sem pauta foi mantida igual ao original quando já informada, ou omitida quando o original não informa; se nenhuma informação foi inventada, removendo o que for invenção; se a descrição tem no máximo 800 caracteres; se os contextos B2B citados fazem sentido para este produto, inclusive kit de boas-vindas; e se os itens não inclusos foram informados no final.

FORMATO DA RESPOSTA: responda exatamente no formato abaixo, sem nenhum texto adicional antes ou depois.

Título:
[título otimizado]

Descrição:
[descrição otimizada, com no máximo 800 caracteres]

Se a descrição original vier com mais de um produto ou com variações, trate como um único produto principal e cite as variações dentro da descrição. Aguarde a descrição original do fornecedor e responda apenas no formato acima.`;

const GEMINI_API_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
const DEEPSEEK_API_URL = 'https://api.deepseek.com/chat/completions';
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const DEFAULT_GEMINI_MODEL = 'gemini-3.1-flash-lite';
const DEFAULT_DEEPSEEK_MODEL = 'deepseek-v4-pro';
const DEFAULT_DEEPSEEK_FALLBACK_MODEL = 'deepseek-v4-flash';
const DEFAULT_GROQ_MODEL = 'qwen/qwen3.8-27b';
const DEFAULT_GROQ_FALLBACK_MODEL = 'qwen/qwen3.6-27b';
const DEFAULT_GROQ_TEXT_MODEL = 'openai/gpt-oss-120b';
const DEFAULT_GROQ_FAST_MODEL = 'openai/gpt-oss-20b';
const DEFAULT_GEMINI_RPM = 15;
const DEFAULT_GROQ_RPM = 30;
const DEFAULT_MAX_IMAGES = 3;
const DEFAULT_TIMEOUT_MS = 90_000;
const DEFAULT_GEMINI_MAX_RETRIES = 2;
const DEFAULT_DEEPSEEK_MAX_RETRIES = 2;
const DEFAULT_GROQ_MAX_RETRIES = 4;
const DEFAULT_GEMINI_COOLDOWN_MS = 30_000;
const DEFAULT_DEEPSEEK_COOLDOWN_MS = 60_000;
const DEFAULT_GROQ_COOLDOWN_MS = 60_000;
const DEFAULT_GEMINI_QUOTA_COOLDOWN_MS = 60 * 60_000;
const DEFAULT_BATCH_MAX_WAIT_HOURS = 168;
const DEFAULT_BATCH_RETRY_MIN_MS = 60_000;
const DEFAULT_BATCH_RETRY_MAX_MS = 60 * 60_000;
const DEFAULT_MAX_OUTPUT_TOKENS = 1_024;
export const MAX_BATCH_CONCURRENCY = 10;
const MAX_PROVIDER_RETRY_DELAY_MS = 24 * 60 * 60_000;
const MAX_SOURCE_TEXT_LENGTH = 6_000;
const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
const TITLE_ENDING = /\b(personalizado|personalizada|personalizados|personalizadas|personalizável|personalizáveis|promocional|promocionais)[.!]?$/iu;

type GeminiResponse = {
  error?: {
    code?: number;
    status?: string;
    message?: string;
    details?: Array<Record<string, unknown>>;
  } | null;
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
    finishReason?: string;
    finishMessage?: string;
  }>;
  promptFeedback?: {
    blockReason?: string;
    blockReasonMessage?: string;
  };
  responseId?: string;
  modelVersion?: string;
};

type GroqResponse = {
  id?: string;
  model?: string;
  error?: { message?: string; type?: string; code?: string } | null;
  choices?: Array<{
    finish_reason?: string;
    message?: { content?: string | null; refusal?: string | null };
  }>;
};

type DeepSeekResponse = GroqResponse;

type GeminiInlineImage = {
  mimeType: 'image/jpeg';
  data: string;
};

type GeneratedFields = {
  titulo: string;
  descricao: string;
};

type AiProvider = 'gemini' | 'deepseek' | 'groq';

type ProviderGeneration = {
  fields: GeneratedFields;
  responseId: string | null;
  model: string;
  provider: AiProvider;
  imagesUsed: number;
};

export type GeneratedProductDescription = {
  id_produto: number;
  codigo: string;
  titulo_anterior: string;
  descricao_anterior: string;
  titulo: string;
  descricao: string;
  imagens_consideradas: number;
  provedor: AiProvider;
  modelo: string;
  response_id: string | null;
};

export type ProductDescriptionBatchItem = {
  id_produto: number;
  success: boolean;
  attempts?: number;
  result?: GeneratedProductDescription;
  error?: string;
};

export type ProductDescriptionBatchSummary = {
  total: number;
  success: number;
  failed: number;
  retries: number;
  started_at: string;
  finished_at: string;
  items: ProductDescriptionBatchItem[];
};

type GenerateAllOptions = {
  empresaId: number;
  concurrency?: number;
  limit?: number;
  startAfterId?: number;
  notModifiedSince?: Date;
  maxRetryWaitMs?: number;
  onProgress?: (completed: number, total: number, item: ProductDescriptionBatchItem) => void;
  onRetry?: (produtoId: number, attempt: number, delayMs: number, error: string) => void;
};

type RequestError = Error & {
  code?: string;
  statusCode?: number;
  retryable?: boolean;
  providerStatus?: number;
  retryAfterMs?: number;
};

class FixedIntervalRateLimiter {
  private tail: Promise<void> = Promise.resolve();
  private nextRequestAt = 0;

  constructor(private readonly requestsPerMinute: number) {}

  async acquire(): Promise<void> {
    const intervalMs = Math.ceil(60_000 / this.requestsPerMinute) + 50;
    const ticket = this.tail.then(async () => {
      const delayMs = Math.max(0, this.nextRequestAt - Date.now());
      if (delayMs > 0) await wait(delayMs);
      this.nextRequestAt = Date.now() + intervalMs;
    });
    this.tail = ticket.catch(() => undefined);
    await ticket;
  }
}

let geminiLimiter: FixedIntervalRateLimiter | null = null;
let geminiLimiterRpm = 0;
let groqLimiter: FixedIntervalRateLimiter | null = null;
let groqLimiterRpm = 0;
let geminiUnavailableUntil = 0;
let deepSeekDisabledReason: string | null = null;
const deepSeekUnavailableUntil = new Map<string, number>();
const groqUnavailableUntil = new Map<string, number>();

function envPositiveInteger(name: string, fallback: number): number {
  const parsed = Number(process.env[name]);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function cleanText(value: unknown, maxLength = MAX_SOURCE_TEXT_LENGTH): string {
  return String(value ?? '')
    .replace(/\u0000/g, '')
    .replace(/\r\n?/g, '\n')
    .trim()
    .slice(0, maxLength);
}

function characterCount(value: string): number {
  return Array.from(value).length;
}

export function validateGeneratedDescription(value: unknown): GeneratedFields {
  if (!value || typeof value !== 'object') {
    throwError('AI_INVALID_OUTPUT', 'A IA não retornou título e descrição válidos', 502);
  }

  const candidate = value as Record<string, unknown>;
  const titulo = cleanText(candidate.titulo, 180).replace(/\s+/g, ' ');
  const descricao = cleanText(candidate.descricao, 1_000).replace(/\s+/g, ' ');

  if (titulo.length < 8 || characterCount(titulo) > 150) {
    throwError('AI_INVALID_TITLE', 'A IA retornou um título fora do tamanho permitido', 502);
  }
  if (!TITLE_ENDING.test(titulo)) {
    throwError('AI_INVALID_TITLE', 'O título gerado não termina com o termo promocional obrigatório', 502);
  }
  if (descricao.length < 40 || characterCount(descricao) > 800) {
    throwError('AI_INVALID_DESCRIPTION', 'A IA retornou uma descrição fora do limite de 800 caracteres', 502);
  }

  return { titulo, descricao };
}

function dimensionsText(product: Produto): string {
  const fields: Array<[string, unknown]> = [
    ['Altura', product.altura],
    ['Largura', product.largura],
    ['Profundidade', product.profundidade],
    ['Peso', product.peso],
    ['Quantidade mínima', product.quantidade_minima],
  ];

  return fields
    .map(([label, value]) => [label, cleanText(value, 120)] as const)
    .filter(([, value]) => value.length > 0)
    .map(([label, value]) => `${label}: ${value}`)
    .join('\n') || 'Nenhuma medida informada';
}

function productInputText(product: Produto): string {
  return [
    'DADOS DO PRODUTO (fonte factual principal)',
    `ID interno: ${product.id_produto}`,
    `Código: ${cleanText(product.codigo, 200) || 'Não informado'}`,
    `Nome atual: ${cleanText(product.produto) || 'Não informado'}`,
    `Descrição atual/fornecedor: ${cleanText(product.descricao) || 'Não informada'}`,
    `Observações: ${cleanText(product.obs) || 'Não informadas'}`,
    'Medidas e dados objetivos:',
    dimensionsText(product),
    '',
    'Crie um título e uma descrição fiéis a esses dados. As imagens anexadas são apoio visual, não fonte para inferências técnicas.',
  ].join('\n');
}

export function parseRetryDurationMs(value: unknown): number | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  const parts = Array.from(normalized.matchAll(/(\d+(?:\.\d+)?)(ms|h|m|s)/gi));
  if (!parts.length || parts.map((part) => part[0]).join('').toLowerCase() !== normalized.toLowerCase()) {
    return null;
  }
  return parts.reduce((total, part) => {
    const amount = Number(part[1]);
    const multiplier = part[2].toLowerCase() === 'h'
      ? 60 * 60_000
      : part[2].toLowerCase() === 'm'
        ? 60_000
        : part[2].toLowerCase() === 's'
          ? 1_000
          : 1;
    return total + amount * multiplier;
  }, 0);
}

function retryDelayMs(
  attempt: number,
  retryAfterHeader?: string | null,
  providerMessage?: string,
  details?: Array<Record<string, unknown>>
): number {
  const retryAfterSeconds = Number(retryAfterHeader);
  if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0) {
    return Math.min(Math.ceil(retryAfterSeconds * 1_000) + 100, MAX_PROVIDER_RETRY_DELAY_MS);
  }

  if (retryAfterHeader) {
    const retryAt = Date.parse(retryAfterHeader);
    if (Number.isFinite(retryAt) && retryAt > Date.now()) {
      return Math.min(retryAt - Date.now() + 100, MAX_PROVIDER_RETRY_DELAY_MS);
    }
  }

  for (const detail of details || []) {
    const duration = parseRetryDurationMs(detail.retryDelay);
    if (duration && duration > 0) return Math.min(Math.ceil(duration) + 100, MAX_PROVIDER_RETRY_DELAY_MS);
  }

  const messageDelay = providerMessage?.match(/(?:retry|try again)\s+in\s+((?:\d+(?:\.\d+)?(?:ms|h|m|s))+)/i);
  if (messageDelay) {
    const duration = parseRetryDurationMs(messageDelay[1]);
    if (duration && duration > 0) return Math.min(Math.ceil(duration) + 100, MAX_PROVIDER_RETRY_DELAY_MS);
  }

  return Math.min(750 * (2 ** attempt) + Math.floor(Math.random() * 250), 8_000);
}

async function wait(ms: number): Promise<void> {
  await new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function limiterFor(provider: AiProvider): FixedIntervalRateLimiter {
  if (provider === 'gemini') {
    const rpm = Math.min(envPositiveInteger('AI_DESCRIPTION_GEMINI_RPM', DEFAULT_GEMINI_RPM), 10_000);
    if (!geminiLimiter || geminiLimiterRpm !== rpm) {
      geminiLimiter = new FixedIntervalRateLimiter(rpm);
      geminiLimiterRpm = rpm;
    }
    return geminiLimiter;
  }

  const rpm = Math.min(envPositiveInteger('AI_DESCRIPTION_GROQ_RPM', DEFAULT_GROQ_RPM), 10_000);
  if (!groqLimiter || groqLimiterRpm !== rpm) {
    groqLimiter = new FixedIntervalRateLimiter(rpm);
    groqLimiterRpm = rpm;
  }
  return groqLimiter;
}

function parseJsonOutput(text: string): unknown {
  const normalized = text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '');
  return JSON.parse(normalized);
}

function imageUrls(images: ProdutoImagem[]): string[] {
  const maxImages = Math.min(envPositiveInteger('AI_DESCRIPTION_MAX_IMAGES', DEFAULT_MAX_IMAGES), 5);
  return Array.from(new Set(images
    .map((image) => cleanText(image.url_imagem, 2_000))
    .filter((url) => /^https?:\/\//i.test(url))))
    .slice(0, maxImages);
}

function allowedImageHosts(): Set<string> {
  const configured = (process.env.AI_DESCRIPTION_ALLOWED_IMAGE_HOSTS || '')
    .split(',')
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean);
  const supabaseUrl = process.env.SUPABASE_URL?.trim() || 'https://kabftbmncilygvpcyazc.supabase.co';
  try {
    configured.push(new URL(supabaseUrl).hostname.toLowerCase());
  } catch {
    // A configuração inválida será tratada pelo fluxo de armazenamento; imagens ficam limitadas à lista explícita.
  }
  return new Set(configured);
}

async function prepareInlineImage(url: string): Promise<GeminiInlineImage | null> {
  try {
    const parsedUrl = new URL(url);
    if (parsedUrl.protocol !== 'https:' || !allowedImageHosts().has(parsedUrl.hostname.toLowerCase())) {
      return null;
    }
    const response = await fetch(parsedUrl, {
      redirect: 'error',
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) return null;

    const declaredSize = Number(response.headers.get('content-length'));
    if (Number.isFinite(declaredSize) && declaredSize > MAX_IMAGE_BYTES) return null;

    const bytes = Buffer.from(await response.arrayBuffer());
    if (!bytes.length || bytes.length > MAX_IMAGE_BYTES) return null;

    const normalized = await sharp(bytes)
      .rotate()
      .resize({ width: 1_024, height: 1_024, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 82, mozjpeg: true })
      .toBuffer();

    return { mimeType: 'image/jpeg', data: normalized.toString('base64') };
  } catch {
    return null;
  }
}

async function prepareImages(images: ProdutoImagem[]): Promise<GeminiInlineImage[]> {
  const prepared = await Promise.all(imageUrls(images).map(prepareInlineImage));
  return prepared.filter((value): value is GeminiInlineImage => Boolean(value));
}

function responseOutputText(response: GeminiResponse): string {
  const candidate = response.candidates?.[0];
  if (!candidate) {
    const reason = response.promptFeedback?.blockReasonMessage
      || response.promptFeedback?.blockReason;
    if (reason) {
      return throwError('AI_REFUSED', `O Gemini bloqueou a geração: ${reason}`, 422);
    }
    return throwError('AI_EMPTY_OUTPUT', 'O Gemini não retornou candidatos', 502);
  }

  if (candidate.finishReason && candidate.finishReason !== 'STOP') {
    const blocked = [
      'SAFETY',
      'RECITATION',
      'LANGUAGE',
      'BLOCKLIST',
      'PROHIBITED_CONTENT',
      'SPII',
      'IMAGE_SAFETY',
      'IMAGE_PROHIBITED_CONTENT',
      'IMAGE_RECITATION',
      'ESCALATION',
    ].includes(candidate.finishReason);
    const error = requestError(
      candidate.finishMessage || `O Gemini encerrou a geração com ${candidate.finishReason}`,
      blocked ? 422 : 502,
      blocked ? 'AI_REFUSED' : 'AI_INCOMPLETE_RESPONSE',
      !blocked
    );
    throw error;
  }

  const text = (candidate.content?.parts || [])
    .map((part) => part.text || '')
    .join('')
    .trim();
  if (text) return text;

  return throwError(
    'AI_EMPTY_OUTPUT',
    'O Gemini não retornou conteúdo textual',
    502
  );
}

function groqOutputText(response: GroqResponse): string {
  const choice = response.choices?.[0];
  const refusal = choice?.message?.refusal?.trim();
  if (refusal) {
    throw requestError(`O Groq recusou a geração: ${refusal}`, 422, 'AI_REFUSED', false);
  }
  if (!choice) {
    throw requestError('O Groq não retornou alternativas', 502, 'AI_EMPTY_OUTPUT', true);
  }
  if (choice.finish_reason && choice.finish_reason !== 'stop') {
    const blocked = choice.finish_reason === 'content_filter';
    throw requestError(
      `O Groq encerrou a geração com ${choice.finish_reason}`,
      blocked ? 422 : 502,
      blocked ? 'AI_REFUSED' : 'AI_INCOMPLETE_RESPONSE',
      !blocked
    );
  }
  const content = choice.message?.content?.trim();
  if (content) return content;
  throw requestError('O Groq não retornou conteúdo textual', 502, 'AI_EMPTY_OUTPUT', true);
}

function deepSeekOutputText(response: DeepSeekResponse): string {
  const choice = response.choices?.[0];
  const refusal = choice?.message?.refusal?.trim();
  if (refusal) {
    throw requestError(`O DeepSeek recusou a geração: ${refusal}`, 422, 'AI_REFUSED', false);
  }
  if (!choice) {
    throw requestError('O DeepSeek não retornou alternativas', 502, 'AI_EMPTY_OUTPUT', true);
  }
  if (choice.finish_reason && choice.finish_reason !== 'stop') {
    const blocked = choice.finish_reason === 'content_filter';
    throw requestError(
      `O DeepSeek encerrou a geração com ${choice.finish_reason}`,
      blocked ? 422 : 502,
      blocked ? 'AI_REFUSED' : 'AI_INCOMPLETE_RESPONSE',
      !blocked
    );
  }
  const content = choice.message?.content?.trim();
  if (content) return content;
  throw requestError('O DeepSeek não retornou conteúdo textual', 502, 'AI_EMPTY_OUTPUT', true);
}

function requestError(
  message: string,
  statusCode: number,
  code: string,
  retryable: boolean,
  providerStatus?: number,
  retryAfterMs?: number
): RequestError {
  const error = new Error(message) as RequestError;
  error.statusCode = statusCode;
  error.code = code;
  error.retryable = retryable;
  error.providerStatus = providerStatus;
  error.retryAfterMs = retryAfterMs;
  return error;
}

async function callGemini(product: Produto, images: GeminiInlineImage[]): Promise<ProviderGeneration> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    return throwError('AI_CONFIG_ERROR', 'GEMINI_API_KEY não configurada no backend', 500);
  }

  if (geminiUnavailableUntil > Date.now()) {
    throw requestError(
      `Gemini em espera até ${new Date(geminiUnavailableUntil).toISOString()} após exceder a cota`,
      503,
      'AI_PROVIDER_COOLDOWN',
      false,
      429,
      geminiUnavailableUntil - Date.now()
    );
  }

  const model = process.env.AI_DESCRIPTION_MODEL?.trim() || DEFAULT_GEMINI_MODEL;
  const maxRetries = Math.min(
    envPositiveInteger(
      'AI_DESCRIPTION_GEMINI_MAX_RETRIES',
      envPositiveInteger('AI_DESCRIPTION_MAX_RETRIES', DEFAULT_GEMINI_MAX_RETRIES)
    ),
    5
  );
  const timeoutMs = Math.min(envPositiveInteger('AI_DESCRIPTION_REQUEST_TIMEOUT_MS', DEFAULT_TIMEOUT_MS), 180_000);
  const parts: Array<Record<string, unknown>> = [
    { text: productInputText(product) },
    ...images.map((image) => ({ inlineData: image })),
  ];
  const responseJsonSchema = {
    type: 'object',
    additionalProperties: false,
    properties: {
      titulo: {
        type: 'string',
        description: 'Título comercial em português, com no máximo 150 caracteres e terminado por um termo de personalização ou promocional.',
      },
      descricao: {
        type: 'string',
        description: 'Descrição comercial fiel aos dados fornecidos, em português e com no máximo 800 caracteres.',
      },
    },
    required: ['titulo', 'descricao'],
  };

  const body = {
    systemInstruction: { parts: [{ text: AI_DESCRIPTION_PROMPT }] },
    contents: [{ role: 'user', parts }],
    generationConfig: {
      maxOutputTokens: 4_096,
      temperature: 0.35,
      responseMimeType: 'application/json',
      responseJsonSchema,
    },
  };

  let lastError: unknown;
  for (let attempt = 0; attempt < maxRetries; attempt += 1) {
    try {
      await limiterFor('gemini').acquire();
      if (geminiUnavailableUntil > Date.now()) {
        throw requestError(
          'Gemini temporariamente em espera após exceder a cota',
          503,
          'AI_PROVIDER_COOLDOWN',
          false,
          429,
          geminiUnavailableUntil - Date.now()
        );
      }
      const response = await fetch(`${GEMINI_API_BASE_URL}/${encodeURIComponent(model)}:generateContent`, {
        method: 'POST',
        headers: {
          'x-goog-api-key': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      });

      const payload = await response.json().catch(() => null) as GeminiResponse | null;
      if (!response.ok || !payload) {
        const message = payload?.error?.message || `Gemini retornou HTTP ${response.status}`;
        const retryable = response.status === 408 || response.status === 409 || response.status === 429 || response.status >= 500;
        const providerDelayMs = retryDelayMs(
          attempt,
          response.headers.get('retry-after'),
          message,
          payload?.error?.details
        );
        if (response.status === 429) {
          const quotaLimit = Number(message.match(/limit:\s*(\d+)/i)?.[1]);
          const looksLikeDailyQuota = /generate_content_free_tier_requests/i.test(message)
            && Number.isFinite(quotaLimit)
            && quotaLimit >= 100;
          geminiUnavailableUntil = Date.now() + Math.max(
            providerDelayMs,
            looksLikeDailyQuota
              ? envPositiveInteger('AI_DESCRIPTION_GEMINI_QUOTA_COOLDOWN_MS', DEFAULT_GEMINI_QUOTA_COOLDOWN_MS)
              : envPositiveInteger('AI_DESCRIPTION_GEMINI_COOLDOWN_MS', DEFAULT_GEMINI_COOLDOWN_MS)
          );
        }
        const retryWithinGemini = retryable && response.status !== 429;
        const error = requestError(
          message,
          retryable ? 503 : 502,
          payload?.error?.status || 'AI_PROVIDER_ERROR',
          retryWithinGemini,
          response.status,
          providerDelayMs
        );
        if (!retryWithinGemini || attempt + 1 >= maxRetries) throw error;
        await wait(providerDelayMs);
        continue;
      }

      const fields = validateGeneratedDescription(parseJsonOutput(responseOutputText(payload)));
      return {
        fields,
        responseId: payload.responseId || null,
        model: payload.modelVersion || model,
        provider: 'gemini',
        imagesUsed: images.length,
      };
    } catch (error) {
      lastError = error;
      const knownError = error as RequestError;
      const retryable = knownError.retryable === true
        || knownError.name === 'TimeoutError'
        || knownError.name === 'SyntaxError'
        || knownError.code?.startsWith('AI_INVALID') === true
        || knownError.code === 'AI_EMPTY_OUTPUT';
      if (!retryable || attempt + 1 >= maxRetries) break;
      await wait(knownError.retryAfterMs || retryDelayMs(attempt));
    }
  }

  const error = lastError as RequestError;
  if (error?.providerStatus === 429) {
    geminiUnavailableUntil = Math.max(
      geminiUnavailableUntil,
      Date.now() + Math.max(
        error.retryAfterMs || 0,
        envPositiveInteger('AI_DESCRIPTION_GEMINI_COOLDOWN_MS', DEFAULT_GEMINI_COOLDOWN_MS)
      )
    );
    error.retryAfterMs = Math.max(error.retryAfterMs || 0, geminiUnavailableUntil - Date.now());
  }
  if (error?.code && error?.statusCode) throw error;
  if (error?.name === 'TimeoutError') {
    return throwError('AI_TIMEOUT', 'A geração excedeu o tempo limite após novas tentativas', 504);
  }
  return throwError('AI_GENERATION_FAILED', error?.message || 'Falha ao gerar descrição com IA', 502);
}

async function callDeepSeek(product: Produto): Promise<ProviderGeneration> {
  const apiKey = process.env.DEEPSEEK_API_KEY?.trim();
  if (!apiKey) {
    return throwError('AI_CONFIG_ERROR', 'DEEPSEEK_API_KEY não configurada no backend', 500);
  }
  if (deepSeekDisabledReason) {
    throw requestError(
      `DeepSeek desativado neste processo: ${deepSeekDisabledReason}`,
      502,
      'AI_PROVIDER_DISABLED',
      false
    );
  }

  const models = [
    process.env.AI_DESCRIPTION_DEEPSEEK_MODEL?.trim() || DEFAULT_DEEPSEEK_MODEL,
    process.env.AI_DESCRIPTION_DEEPSEEK_FALLBACK_MODEL?.trim() || DEFAULT_DEEPSEEK_FALLBACK_MODEL,
  ].filter((model, index, entries) => entries.indexOf(model) === index);
  const maxRetries = Math.min(
    envPositiveInteger('AI_DESCRIPTION_DEEPSEEK_MAX_RETRIES', DEFAULT_DEEPSEEK_MAX_RETRIES),
    4
  );
  const timeoutMs = Math.min(envPositiveInteger('AI_DESCRIPTION_REQUEST_TIMEOUT_MS', DEFAULT_TIMEOUT_MS), 180_000);
  const maxOutputTokens = Math.min(envPositiveInteger('AI_DESCRIPTION_MAX_OUTPUT_TOKENS', DEFAULT_MAX_OUTPUT_TOKENS), 4_096);
  const textInput = `${productInputText(product)}\n\nRetorne obrigatoriamente um objeto json válido neste formato exato: {"titulo":"...","descricao":"..."}. Não inclua outras chaves nem texto fora do json.`;

  let lastError: unknown;
  for (let attempt = 0; attempt < maxRetries; attempt += 1) {
    try {
      const now = Date.now();
      const model = Array.from({ length: models.length }, (_, offset) => models[(attempt + offset) % models.length])
        .find((candidate) => (deepSeekUnavailableUntil.get(candidate) || 0) <= now);
      if (!model) {
        const nextAvailableAt = Math.min(...models.map((candidate) => deepSeekUnavailableUntil.get(candidate) || now));
        throw requestError(
          'Todos os modelos DeepSeek estão temporariamente em espera',
          503,
          'AI_PROVIDER_COOLDOWN',
          false,
          429,
          Math.max(nextAvailableAt - now, 500)
        );
      }

      const response = await fetch(DEEPSEEK_API_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: AI_DESCRIPTION_PROMPT },
            { role: 'user', content: textInput },
          ],
          thinking: { type: 'disabled' },
          temperature: 0.35,
          max_tokens: maxOutputTokens,
          response_format: { type: 'json_object' },
          stream: false,
        }),
        signal: AbortSignal.timeout(timeoutMs),
      });
      const payload = await response.json().catch(() => null) as DeepSeekResponse | null;
      if (!response.ok || !payload) {
        const message = payload?.error?.message || `DeepSeek retornou HTTP ${response.status}`;
        if ([401, 402, 403].includes(response.status)) {
          deepSeekDisabledReason = message;
        }
        const retryable = response.status === 408
          || response.status === 409
          || response.status === 429
          || response.status >= 500;
        const tryNextModel = response.status === 400 || response.status === 404 || retryable;
        const providerDelayMs = retryDelayMs(attempt, response.headers.get('retry-after'), message);
        if (tryNextModel) {
          deepSeekUnavailableUntil.set(
            model,
            Date.now() + Math.max(
              providerDelayMs,
              envPositiveInteger('AI_DESCRIPTION_DEEPSEEK_COOLDOWN_MS', DEFAULT_DEEPSEEK_COOLDOWN_MS)
            )
          );
        }
        const error = requestError(
          message,
          retryable ? 503 : 502,
          payload?.error?.code || payload?.error?.type || 'AI_PROVIDER_ERROR',
          retryable,
          response.status,
          providerDelayMs
        );
        if (!tryNextModel || attempt + 1 >= maxRetries) throw error;
        continue;
      }

      return {
        fields: validateGeneratedDescription(parseJsonOutput(deepSeekOutputText(payload))),
        responseId: payload.id || null,
        model: payload.model || model,
        provider: 'deepseek',
        imagesUsed: 0,
      };
    } catch (error) {
      lastError = error;
      const knownError = error as RequestError;
      const retryable = knownError.retryable === true
        || knownError.name === 'TimeoutError'
        || knownError.name === 'SyntaxError'
        || knownError.code?.startsWith('AI_INVALID') === true
        || knownError.code === 'AI_EMPTY_OUTPUT';
      if (!retryable || attempt + 1 >= maxRetries) break;
      await wait(knownError.retryAfterMs || retryDelayMs(attempt));
    }
  }

  const error = lastError as RequestError;
  const now = Date.now();
  const nextModelAvailability = models
    .map((model) => (deepSeekUnavailableUntil.get(model) || 0) - now)
    .filter((delay) => delay > 0);
  if (error && nextModelAvailability.length) {
    error.retryAfterMs = Math.min(...nextModelAvailability);
  }
  if (error?.code && error?.statusCode) throw error;
  if (error?.name === 'TimeoutError') {
    return throwError('AI_TIMEOUT', 'A geração pelo DeepSeek excedeu o tempo limite após novas tentativas', 504);
  }
  return throwError('AI_GENERATION_FAILED', error?.message || 'Falha ao gerar descrição pelo DeepSeek', 502);
}

async function callGroq(product: Produto, images: GeminiInlineImage[]): Promise<ProviderGeneration> {
  const apiKey = process.env.GROQ_API_KEY?.trim();
  if (!apiKey) {
    return throwError('AI_CONFIG_ERROR', 'GROQ_API_KEY não configurada no backend', 500);
  }

  const models = [
    { model: process.env.AI_DESCRIPTION_GROQ_TEXT_MODEL?.trim() || DEFAULT_GROQ_TEXT_MODEL, vision: false },
    { model: process.env.AI_DESCRIPTION_GROQ_FAST_MODEL?.trim() || DEFAULT_GROQ_FAST_MODEL, vision: false },
    { model: process.env.AI_DESCRIPTION_GROQ_MODEL?.trim() || DEFAULT_GROQ_MODEL, vision: true },
    { model: process.env.AI_DESCRIPTION_GROQ_FALLBACK_MODEL?.trim() || DEFAULT_GROQ_FALLBACK_MODEL, vision: true },
  ].filter((entry, index, entries) => entries.findIndex((candidate) => candidate.model === entry.model) === index);
  const maxRetries = Math.min(
    envPositiveInteger(
      'AI_DESCRIPTION_GROQ_MAX_RETRIES',
      envPositiveInteger('AI_DESCRIPTION_MAX_RETRIES', DEFAULT_GROQ_MAX_RETRIES)
    ),
    5
  );
  const timeoutMs = Math.min(envPositiveInteger('AI_DESCRIPTION_REQUEST_TIMEOUT_MS', DEFAULT_TIMEOUT_MS), 180_000);
  const maxOutputTokens = Math.min(envPositiveInteger('AI_DESCRIPTION_MAX_OUTPUT_TOKENS', DEFAULT_MAX_OUTPUT_TOKENS), 4_096);
  const maxGroqImages = Math.min(envPositiveInteger('AI_DESCRIPTION_GROQ_MAX_IMAGES', 1), 3);
  const textInput = `${productInputText(product)}\n\nRetorne obrigatoriamente um objeto JSON válido com somente as chaves "titulo" e "descricao".`;
  const multimodalContent: Array<Record<string, unknown>> = [
    {
      type: 'text',
      text: textInput,
    },
    ...images.slice(0, maxGroqImages).map((image) => ({
      type: 'image_url',
      image_url: { url: `data:${image.mimeType};base64,${image.data}` },
    })),
  ];
  const responseSchema = {
    type: 'object',
    additionalProperties: false,
    properties: {
      titulo: { type: 'string' },
      descricao: { type: 'string' },
    },
    required: ['titulo', 'descricao'],
  };

  let lastError: unknown;
  for (let attempt = 0; attempt < maxRetries; attempt += 1) {
    try {
      await limiterFor('groq').acquire();
      const now = Date.now();
      const modelOption = Array.from({ length: models.length }, (_, offset) => models[(attempt + offset) % models.length])
        .find((entry) => (groqUnavailableUntil.get(entry.model) || 0) <= now);
      if (!modelOption) {
        const nextAvailableAt = Math.min(...models.map((entry) => groqUnavailableUntil.get(entry.model) || now));
        throw requestError(
          'Todos os modelos Groq estão temporariamente em espera',
          503,
          'AI_PROVIDER_COOLDOWN',
          false,
          429,
          Math.max(nextAvailableAt - now, 500)
        );
      }
      const body = {
        model: modelOption.model,
        messages: [
          { role: 'system', content: AI_DESCRIPTION_PROMPT },
          { role: 'user', content: modelOption.vision ? multimodalContent : textInput },
        ],
        temperature: 0.35,
        max_completion_tokens: maxOutputTokens,
        reasoning_effort: modelOption.vision ? 'none' : 'low',
        response_format: modelOption.vision
          ? { type: 'json_object' }
          : {
            type: 'json_schema',
            json_schema: {
              name: 'product_description',
              strict: true,
              schema: responseSchema,
            },
          },
        stream: false,
      };
      const response = await fetch(GROQ_API_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      });
      const payload = await response.json().catch(() => null) as GroqResponse | null;
      if (!response.ok || !payload) {
        const message = payload?.error?.message || `Groq retornou HTTP ${response.status}`;
        const retryable = response.status === 400
          || response.status === 404
          || response.status === 408
          || response.status === 409
          || response.status === 422
          || response.status === 429
          || response.status >= 500;
        const providerDelayMs = retryDelayMs(attempt, response.headers.get('retry-after'), message);
        if (retryable) {
          groqUnavailableUntil.set(
            modelOption.model,
            Date.now() + Math.max(
              providerDelayMs,
              envPositiveInteger('AI_DESCRIPTION_GROQ_COOLDOWN_MS', DEFAULT_GROQ_COOLDOWN_MS)
            )
          );
        }
        const error = requestError(
          message,
          retryable ? 503 : 502,
          payload?.error?.code || payload?.error?.type || 'AI_PROVIDER_ERROR',
          retryable,
          response.status,
          providerDelayMs
        );
        if (!retryable || attempt + 1 >= maxRetries) throw error;
        continue;
      }

      return {
        fields: validateGeneratedDescription(parseJsonOutput(groqOutputText(payload))),
        responseId: payload.id || null,
        model: payload.model || modelOption.model,
        provider: 'groq',
        imagesUsed: modelOption.vision ? Math.min(images.length, maxGroqImages) : 0,
      };
    } catch (error) {
      lastError = error;
      const knownError = error as RequestError;
      const retryable = knownError.retryable === true
        || knownError.name === 'TimeoutError'
        || knownError.name === 'SyntaxError'
        || knownError.code?.startsWith('AI_INVALID') === true
        || knownError.code === 'AI_EMPTY_OUTPUT';
      if (!retryable || attempt + 1 >= maxRetries) break;
      await wait(knownError.retryAfterMs || retryDelayMs(attempt));
    }
  }

  const error = lastError as RequestError;
  const now = Date.now();
  const nextModelAvailability = models
    .map((entry) => (groqUnavailableUntil.get(entry.model) || 0) - now)
    .filter((delay) => delay > 0);
  if (error && nextModelAvailability.length) {
    error.retryAfterMs = Math.min(...nextModelAvailability);
  }
  if (error?.code && error?.statusCode) throw error;
  if (error?.name === 'TimeoutError') {
    return throwError('AI_TIMEOUT', 'A geração pelo Groq excedeu o tempo limite após novas tentativas', 504);
  }
  return throwError('AI_GENERATION_FAILED', error?.message || 'Falha ao gerar descrição pelo Groq', 502);
}

function isTransientAiError(error: unknown): boolean {
  const knownError = error as RequestError;
  return knownError?.retryable === true
    || knownError?.providerStatus === 408
    || knownError?.providerStatus === 409
    || knownError?.providerStatus === 429
    || (typeof knownError?.providerStatus === 'number' && knownError.providerStatus >= 500)
    || [
      'AI_PROVIDER_COOLDOWN',
      'AI_TIMEOUT',
      'AI_GENERATION_FAILED',
      'AI_EMPTY_OUTPUT',
      'AI_INCOMPLETE_RESPONSE',
      'RESOURCE_EXHAUSTED',
      'rate_limit_exceeded',
    ].includes(knownError?.code || '');
}

function errorRetryAfterMs(error: unknown): number | null {
  const delay = (error as RequestError)?.retryAfterMs;
  return typeof delay === 'number' && Number.isFinite(delay) && delay > 0 ? delay : null;
}

async function generateWithFallback(product: Produto, images: GeminiInlineImage[]): Promise<ProviderGeneration> {
  const providers: Array<{
    name: string;
    enabled: boolean;
    generate: () => Promise<ProviderGeneration>;
  }> = [
    {
      name: 'DeepSeek',
      enabled: Boolean(process.env.DEEPSEEK_API_KEY?.trim()),
      generate: () => callDeepSeek(product),
    },
    {
      name: 'Gemini',
      enabled: Boolean(process.env.GEMINI_API_KEY?.trim()),
      generate: () => callGemini(product, images),
    },
    {
      name: 'Groq',
      enabled: Boolean(process.env.GROQ_API_KEY?.trim()),
      generate: () => callGroq(product, images),
    },
  ];
  const enabledProviders = providers.filter((provider) => provider.enabled);
  if (!enabledProviders.length) {
    return throwError(
      'AI_CONFIG_ERROR',
      'Configure GEMINI_API_KEY, DEEPSEEK_API_KEY ou GROQ_API_KEY no backend',
      500
    );
  }

  const failures: Array<{ name: string; error: unknown }> = [];
  for (const provider of enabledProviders) {
    try {
      return await provider.generate();
    } catch (error) {
      failures.push({ name: provider.name, error });
    }
  }

  const retryable = failures.some(({ error }) => isTransientAiError(error));
  const retryDelays = failures
    .map(({ error }) => errorRetryAfterMs(error))
    .filter((delay): delay is number => delay !== null);
  const details = failures
    .map(({ name, error }) => `${name}: ${error instanceof Error ? error.message : String(error)}`)
    .join('. ');
  throw requestError(
    `Todos os provedores falharam. ${details}`,
    retryable ? 503 : 502,
    'AI_ALL_PROVIDERS_FAILED',
    retryable,
    undefined,
    retryDelays.length ? Math.min(...retryDelays) : DEFAULT_BATCH_RETRY_MIN_MS
  );
}

async function persistIfUnchanged(
  empresaId: number,
  original: Produto,
  generated: GeneratedFields
): Promise<void> {
  const connection = await getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.execute(
      `SELECT produto, descricao FROM produtos
       WHERE id_empresa = ? AND id_produto = ? FOR UPDATE`,
      [empresaId, original.id_produto]
    );
    const current = (rows as Array<{ produto: string; descricao: string | null }>)[0];
    if (!current) {
      throwError('PRODUTO_NOT_FOUND', 'Produto não encontrado', 404);
    }
    if (current.produto !== original.produto || (current.descricao || '') !== (original.descricao || '')) {
      throwError(
        'PRODUCT_CHANGED_DURING_GENERATION',
        'O produto foi editado durante a geração. Recarregue os dados e tente novamente.',
        409
      );
    }

    await connection.execute(
      `UPDATE produtos
       SET produto = ?, descricao = ?, data_modificacao = NOW()
       WHERE id_empresa = ? AND id_produto = ?`,
      [generated.titulo, generated.descricao, empresaId, original.id_produto]
    );

    if (SEARCH_FLAGS.writeSyncEnabled) {
      await SearchDocumentService.refreshProduct(empresaId, original.id_produto, connection);
    }
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export class GenerateAiDescriptionService {
  static async generateForProduct(empresaId: number, produtoId: number): Promise<GeneratedProductDescription> {
    if (!Number.isInteger(empresaId) || empresaId <= 0 || !Number.isInteger(produtoId) || produtoId <= 0) {
      throwError('INVALID_PRODUCT', 'Empresa e produto devem ser identificadores válidos', 400);
    }

    const product = await ProdutoModel.findById(empresaId, produtoId);
    if (!product) return throwError('PRODUTO_NOT_FOUND', 'Produto não encontrado', 404);

    const images = await ProdutoModel.findImagesByProductId(produtoId);
    const preparedImages = await prepareImages(images);
    const generated = await generateWithFallback(product, preparedImages);
    await persistIfUnchanged(empresaId, product, generated.fields);

    return {
      id_produto: product.id_produto,
      codigo: product.codigo,
      titulo_anterior: product.produto,
      descricao_anterior: product.descricao || '',
      titulo: generated.fields.titulo,
      descricao: generated.fields.descricao,
      imagens_consideradas: generated.imagesUsed,
      provedor: generated.provider,
      modelo: generated.model,
      response_id: generated.responseId,
    };
  }

  static async listProductIds(
    empresaId: number,
    limit?: number,
    startAfterId = 0,
    notModifiedSince?: Date
  ): Promise<number[]> {
    if (!Number.isInteger(empresaId) || empresaId <= 0) {
      throwError('INVALID_COMPANY', 'Empresa inválida', 400);
    }

    const safeLimit = limit && Number.isInteger(limit) && limit > 0 ? Math.min(limit, 100_000) : undefined;
    if (notModifiedSince && Number.isNaN(notModifiedSince.getTime())) {
      throwError('INVALID_DATE', 'A data para filtrar produtos já processados é inválida', 400);
    }
    const params: Array<number | Date> = [empresaId, startAfterId];
    const modificationFilter = notModifiedSince
      ? ' AND (data_modificacao IS NULL OR data_modificacao < ?)'
      : '';
    if (notModifiedSince) params.push(notModifiedSince);
    if (safeLimit) params.push(safeLimit);
    const rows = await query(
      `SELECT id_produto FROM produtos
       WHERE id_empresa = ? AND id_produto > ?${modificationFilter}
       ORDER BY id_produto ASC${safeLimit ? ' LIMIT ?' : ''}`,
      params
    ) as Array<{ id_produto: number }>;
    return rows.map((row) => Number(row.id_produto));
  }

  static async generateAllProducts(options: GenerateAllOptions): Promise<ProductDescriptionBatchSummary> {
    const concurrency = Math.min(
      Math.max(options.concurrency || MAX_BATCH_CONCURRENCY, 1),
      MAX_BATCH_CONCURRENCY
    );
    const productIds = await this.listProductIds(
      options.empresaId,
      options.limit,
      options.startAfterId || 0,
      options.notModifiedSince
    );
    const startedAt = new Date().toISOString();
    const items: ProductDescriptionBatchItem[] = new Array(productIds.length);
    const maxRetryWaitMs = Math.min(
      options.maxRetryWaitMs
        || envPositiveInteger('AI_DESCRIPTION_BATCH_MAX_WAIT_HOURS', DEFAULT_BATCH_MAX_WAIT_HOURS) * 60 * 60_000,
      30 * 24 * 60 * 60_000
    );
    const minimumRetryMs = Math.min(
      envPositiveInteger('AI_DESCRIPTION_BATCH_RETRY_MIN_MS', DEFAULT_BATCH_RETRY_MIN_MS),
      60 * 60_000
    );
    const maximumRetryMs = Math.min(
      envPositiveInteger('AI_DESCRIPTION_BATCH_RETRY_MAX_MS', DEFAULT_BATCH_RETRY_MAX_MS),
      24 * 60 * 60_000
    );
    let nextIndex = 0;
    let completed = 0;
    let totalRetries = 0;

    const worker = async (): Promise<void> => {
      while (true) {
        const index = nextIndex;
        nextIndex += 1;
        if (index >= productIds.length) return;

        const produtoId = productIds[index];
        const retryDeadline = Date.now() + maxRetryWaitMs;
        let attempts = 0;
        let item: ProductDescriptionBatchItem | null = null;
        while (!item) {
          attempts += 1;
          try {
            const result = await this.generateForProduct(options.empresaId, produtoId);
            item = { id_produto: produtoId, success: true, result, attempts };
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            const remainingWaitMs = retryDeadline - Date.now();
            if (!isTransientAiError(error) || remainingWaitMs <= 0) {
              item = { id_produto: produtoId, success: false, error: errorMessage, attempts };
              break;
            }

            const requestedDelayMs = errorRetryAfterMs(error) || minimumRetryMs;
            const delayMs = Math.min(
              Math.max(requestedDelayMs, minimumRetryMs),
              maximumRetryMs,
              remainingWaitMs
            );
            totalRetries += 1;
            options.onRetry?.(produtoId, attempts + 1, delayMs, errorMessage);
            await wait(delayMs);
          }
        }

        items[index] = item;
        completed += 1;
        options.onProgress?.(completed, productIds.length, item);
      }
    };

    await Promise.all(Array.from({ length: Math.min(concurrency, productIds.length) }, worker));
    await CacheService.invalidateNamespaces(CacheService.productContentNamespaces);
    const success = items.filter((item) => item.success).length;
    return {
      total: items.length,
      success,
      failed: items.length - success,
      retries: totalRetries,
      started_at: startedAt,
      finished_at: new Date().toISOString(),
      items,
    };
  }
}
