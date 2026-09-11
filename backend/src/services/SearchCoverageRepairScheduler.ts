import { SearchCoverageRepairService } from '@search/SearchCoverageRepairService';

const toPositiveInt = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

export class SearchCoverageRepairScheduler {
  private static timer: NodeJS.Timeout | null = null;
  private static running = false;
  private static readonly intervalMs = toPositiveInt(
    process.env.SEARCH_COVERAGE_REPAIR_INTERVAL_MS,
    60 * 1000,
  );

  static start(): void {
    if (this.timer || process.env.SEARCH_COVERAGE_REPAIR_ENABLED === 'false') return;

    void this.run();
    this.timer = setInterval(() => void this.run(), this.intervalMs);
    this.timer.unref?.();
    console.log(
      `[SearchCoverageRepairScheduler] Ativo a cada ${Math.round(this.intervalMs / 1000)} segundo(s)`,
    );
  }

  static stop(): void {
    if (!this.timer) return;
    clearInterval(this.timer);
    this.timer = null;
  }

  static async run(): Promise<void> {
    if (this.running) return;
    this.running = true;
    const empresaId = toPositiveInt(
      process.env.SEARCH_PUBLIC_DEFAULT_EMPRESA_ID || process.env.SITE_API_EMPRESA_ID,
      1,
    );

    try {
      const result = await SearchCoverageRepairService.repair(empresaId);
      if (result.repaired > 0) {
        console.log(
          `[SearchCoverageRepairScheduler] Busca reparada: empresa=${empresaId}, produtos=${result.repaired}`,
        );
      }
    } catch (error) {
      console.error(
        '[SearchCoverageRepairScheduler] Falha ao verificar/reparar cobertura',
        error instanceof Error ? error.message : String(error),
      );
    } finally {
      this.running = false;
    }
  }
}
