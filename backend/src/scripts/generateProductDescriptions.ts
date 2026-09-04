import '../module-alias';
import { closeDatabasePool } from '@database/connection';
import {
  GenerateAiDescriptionService,
  MAX_BATCH_CONCURRENCY,
} from '@services/generateAiDescriptionService';

function argument(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.slice(2).find((value) => value.startsWith(prefix))?.slice(prefix.length);
}

function positiveArgument(name: string): number | undefined {
  const raw = argument(name);
  if (!raw) return undefined;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`O argumento --${name} deve ser um número inteiro positivo`);
  }
  return parsed;
}

function durationText(milliseconds: number): string {
  const totalSeconds = Math.ceil(milliseconds / 1_000);
  const hours = Math.floor(totalSeconds / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;
  return [hours ? `${hours}h` : '', minutes ? `${minutes}m` : '', seconds ? `${seconds}s` : '']
    .filter(Boolean)
    .join('');
}

async function main(): Promise<void> {
  const empresaId = positiveArgument('empresa') || Number(process.env.AI_DESCRIPTION_EMPRESA_ID || 1);
  const limit = positiveArgument('limit');
  const concurrency = positiveArgument('concurrency') || MAX_BATCH_CONCURRENCY;
  const startAfterId = positiveArgument('start-after') || 0;
  const maxWaitHours = positiveArgument('max-wait-hours')
    || Number(process.env.AI_DESCRIPTION_BATCH_MAX_WAIT_HOURS || 168);
  const notModifiedSinceRaw = argument('not-modified-since');
  const notModifiedSince = notModifiedSinceRaw ? new Date(notModifiedSinceRaw) : undefined;

  if (!Number.isInteger(empresaId) || empresaId <= 0) {
    throw new Error('Informe uma empresa válida com --empresa=ID ou AI_DESCRIPTION_EMPRESA_ID');
  }
  if (!Number.isInteger(maxWaitHours) || maxWaitHours <= 0) {
    throw new Error('O argumento --max-wait-hours deve ser um número inteiro positivo');
  }
  if (concurrency > MAX_BATCH_CONCURRENCY) {
    throw new Error(`O argumento --concurrency deve ser no máximo ${MAX_BATCH_CONCURRENCY}`);
  }
  if (notModifiedSince && Number.isNaN(notModifiedSince.getTime())) {
    throw new Error('O argumento --not-modified-since deve ser uma data ISO válida');
  }

  console.log('[descricoes:ia] Iniciando geração', {
    inicio: new Date().toISOString(),
    empresaId,
    concorrencia: concurrency,
    provedorPrincipal: 'DeepSeek',
    gemini: process.env.AI_DESCRIPTION_MODEL || 'gemini-3.1-flash-lite',
    geminiRpm: Number(process.env.AI_DESCRIPTION_GEMINI_RPM || 15),
    deepSeekFallback: [
      process.env.AI_DESCRIPTION_DEEPSEEK_MODEL || 'deepseek-v4-pro',
      process.env.AI_DESCRIPTION_DEEPSEEK_FALLBACK_MODEL || 'deepseek-v4-flash',
    ],
    groqFallback: [
      process.env.AI_DESCRIPTION_GROQ_TEXT_MODEL || 'openai/gpt-oss-120b',
      process.env.AI_DESCRIPTION_GROQ_FAST_MODEL || 'openai/gpt-oss-20b',
      process.env.AI_DESCRIPTION_GROQ_MODEL || 'qwen/qwen3.8-27b',
      process.env.AI_DESCRIPTION_GROQ_FALLBACK_MODEL || 'qwen/qwen3.6-27b',
    ],
    groqRpm: Number(process.env.AI_DESCRIPTION_GROQ_RPM || 30),
    limit: limit || 'todos',
    iniciarDepoisDoId: startAfterId,
    naoModificadosDesde: notModifiedSince?.toISOString() || 'desativado',
    esperaMaximaPorProduto: `${maxWaitHours}h`,
  });

  const summary = await GenerateAiDescriptionService.generateAllProducts({
    empresaId,
    concurrency,
    limit,
    startAfterId,
    notModifiedSince,
    maxRetryWaitMs: maxWaitHours * 60 * 60_000,
    onRetry(produtoId, attempt, delayMs, error) {
      const reason = error.replace(/\s+/g, ' ').slice(0, 240);
      console.log(`[descricoes:ia] RETRY | produto=${produtoId} | tentativa=${attempt} | em=${durationText(delayMs)} | ${reason}`);
    },
    onProgress(completed, total, item) {
      const status = item.success ? 'OK' : 'ERRO';
      const detail = item.success
        ? `${item.result?.provedor}/${item.result?.modelo} | ${item.result?.titulo}`
        : item.error;
      console.log(`[descricoes:ia] ${completed}/${total} | produto=${item.id_produto} | tentativas=${item.attempts || 1} | ${status} | ${detail || ''}`);
    },
  });

  console.log('[descricoes:ia] Finalizado', {
    total: summary.total,
    sucesso: summary.success,
    falhas: summary.failed,
    retries: summary.retries,
    inicio: summary.started_at,
    fim: summary.finished_at,
    provedores: summary.items.reduce<Record<string, number>>((counts, item) => {
      const provider = item.result?.provedor;
      if (provider) counts[provider] = (counts[provider] || 0) + 1;
      return counts;
    }, {}),
  });

  if (summary.failed > 0) {
    console.error('[descricoes:ia] Produtos com falha:', summary.items
      .filter((item) => !item.success)
      .map((item) => ({ id_produto: item.id_produto, tentativas: item.attempts, erro: item.error })));
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error('[descricoes:ia] Falha fatal:', error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDatabasePool();
  });
