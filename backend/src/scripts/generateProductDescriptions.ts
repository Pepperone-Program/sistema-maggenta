import '../module-alias';
import { closeDatabasePool } from '@database/connection';
import { GenerateAiDescriptionService } from '@services/generateAiDescriptionService';

function positiveArgument(name: string): number | undefined {
  const prefix = `--${name}=`;
  const raw = process.argv.slice(2).find((argument) => argument.startsWith(prefix))?.slice(prefix.length);
  if (!raw) return undefined;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`O argumento --${name} deve ser um número inteiro positivo`);
  }
  return parsed;
}

async function main(): Promise<void> {
  const empresaId = positiveArgument('empresa') || Number(process.env.AI_DESCRIPTION_EMPRESA_ID || 1);
  const limit = positiveArgument('limit');
  const startAfterId = positiveArgument('start-after') || 0;

  if (!Number.isInteger(empresaId) || empresaId <= 0) {
    throw new Error('Informe uma empresa válida com --empresa=ID ou AI_DESCRIPTION_EMPRESA_ID');
  }

  console.log('[descricoes:ia] Iniciando geração', {
    empresaId,
    concorrencia: 5,
    limit: limit || 'todos',
    iniciarDepoisDoId: startAfterId,
  });

  const summary = await GenerateAiDescriptionService.generateAllProducts({
    empresaId,
    concurrency: 5,
    limit,
    startAfterId,
    onProgress(completed, total, item) {
      const status = item.success ? 'OK' : 'ERRO';
      const detail = item.success
        ? item.result?.titulo
        : item.error;
      console.log(`[descricoes:ia] ${completed}/${total} | produto=${item.id_produto} | ${status} | ${detail || ''}`);
    },
  });

  console.log('[descricoes:ia] Finalizado', {
    total: summary.total,
    sucesso: summary.success,
    falhas: summary.failed,
    inicio: summary.started_at,
    fim: summary.finished_at,
  });

  if (summary.failed > 0) {
    console.error('[descricoes:ia] Produtos com falha:', summary.items
      .filter((item) => !item.success)
      .map((item) => ({ id_produto: item.id_produto, erro: item.error })));
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
