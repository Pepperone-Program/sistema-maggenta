import { OrcamentoModel } from '@models/Orcamento';
import { OrcamentoNotificationService } from '@services/OrcamentoNotificationService';

const toPositiveInt = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

export class OrcamentoEmailScheduler {
  private static timer: NodeJS.Timeout | null = null;
  private static running = false;
  private static cursor = 0;
  private static readonly intervalMs = toPositiveInt(
    process.env.ORCAMENTO_EMAIL_CRON_INTERVAL_MS,
    10 * 60 * 1000
  );
  private static readonly batchSize = Math.min(
    toPositiveInt(process.env.ORCAMENTO_EMAIL_CRON_BATCH_SIZE, 25),
    100
  );

  static start(): void {
    if (this.timer) return;

    this.run().catch((error) => {
      console.error('[OrcamentoEmailScheduler] Falha na execucao inicial', error);
    });

    this.timer = setInterval(() => {
      this.run().catch((error) => {
        console.error('[OrcamentoEmailScheduler] Falha na execucao agendada', error);
      });
    }, this.intervalMs);
    this.timer.unref?.();

    console.log(
      `[OrcamentoEmailScheduler] Ativo a cada ${Math.round(this.intervalMs / 60000)} minuto(s), lote ${this.batchSize}`
    );
  }

  static stop(): void {
    if (!this.timer) return;
    clearInterval(this.timer);
    this.timer = null;
  }

  static async run(): Promise<void> {
    if (this.running) {
      console.warn('[OrcamentoEmailScheduler] Execucao ignorada: job anterior ainda ativo');
      return;
    }

    this.running = true;
    const startedAt = Date.now();
    let sent = 0;
    let pendingCount = 0;

    try {
      let pending = await OrcamentoModel.findPendingEmails(this.cursor, this.batchSize);

      if (!pending.length && this.cursor > 0) {
        this.cursor = 0;
        pending = await OrcamentoModel.findPendingEmails(this.cursor, this.batchSize);
      }

      for (const quote of pending) {
        this.cursor = quote.id_orcamento;
        try {
          const success = await OrcamentoNotificationService.sendStoredQuote(
            quote.id_empresa,
            quote.id_orcamento
          );
          success ? sent += 1 : pendingCount += 1;
        } catch (error) {
          pendingCount += 1;
          console.error(
            `[OrcamentoEmailScheduler] Falha no orcamento ${quote.id_orcamento}`,
            error
          );
        }
      }

      if (pending.length) {
        console.log(
          `[OrcamentoEmailScheduler] Concluido em ${Date.now() - startedAt}ms: ${sent} enviado(s), ${pendingCount} pendente(s)`
        );
      }
    } finally {
      this.running = false;
    }
  }
}
