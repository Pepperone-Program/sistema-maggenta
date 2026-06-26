import { CacheService } from '@services/CacheService';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

const toHour = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 && parsed <= 23 ? parsed : fallback;
};

const nextUtcHourDelay = (targetHourUtc: number): number => {
  const now = new Date();
  const next = new Date(now);
  next.setUTCHours(targetHourUtc, 0, 0, 0);

  if (next.getTime() <= now.getTime()) {
    next.setUTCDate(next.getUTCDate() + 1);
  }

  return next.getTime() - now.getTime();
};

export class CacheInvalidationScheduler {
  private static timer: NodeJS.Timeout | null = null;
  private static running = false;
  private static dailyHourUtc = 6;

  static start(): void {
    if (this.timer) return;

    this.dailyHourUtc = toHour(process.env.CACHE_DAILY_INVALIDATION_HOUR_UTC, 6);
    this.scheduleNext();
    console.log(
      `[CacheInvalidationScheduler] Ativo diariamente as ${String(this.dailyHourUtc).padStart(2, '0')}:00 UTC`
    );
  }

  static stop(): void {
    if (!this.timer) return;
    clearTimeout(this.timer);
    this.timer = null;
  }

  private static scheduleNext(): void {
    this.timer = setTimeout(() => {
      this.run()
        .catch((error) => {
          console.error('[CacheInvalidationScheduler] Falha ao invalidar cache diario', error);
        })
        .finally(() => {
          this.timer = null;
          this.scheduleNext();
        });
    }, Math.min(nextUtcHourDelay(this.dailyHourUtc), ONE_DAY_MS));

    this.timer.unref?.();
  }

  private static async run(): Promise<void> {
    if (this.running) {
      console.warn('[CacheInvalidationScheduler] Execucao ignorada: job anterior ainda ativo');
      return;
    }

    this.running = true;
    const startedAt = Date.now();

    try {
      await CacheService.invalidateNamespaces(CacheService.productContentNamespaces);
      console.log(
        `[CacheInvalidationScheduler] Cache diario invalidado em ${Date.now() - startedAt}ms: ${CacheService.productContentNamespaces.join(', ')}`
      );
    } finally {
      this.running = false;
    }
  }
}
