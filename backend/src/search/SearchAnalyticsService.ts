import { query } from '@database/connection';
import type { SearchIntent, SearchTiming } from '@/types/search';
import { SearchMetrics } from './SearchMetrics';

type SearchEvent = {
  searchId: string;
  empresaId: number;
  original: string;
  normalized: string;
  intent: SearchIntent;
  results: number;
  related: number;
  candidates: number;
  timing: SearchTiming;
  rankingVersion: string;
  mode: 'legacy' | 'shadow' | 'advanced';
};

const MAX_QUEUE = Number(process.env.SEARCH_ANALYTICS_QUEUE_LIMIT || 1000);
const BATCH_SIZE = Number(process.env.SEARCH_ANALYTICS_BATCH_SIZE || 50);
const FLUSH_MS = Number(process.env.SEARCH_ANALYTICS_FLUSH_MS || 1000);

export class SearchAnalyticsService {
  private static events: SearchEvent[] = [];
  private static timer: NodeJS.Timeout | null = null;
  private static purgeTimer: NodeJS.Timeout | null = null;
  private static flushing = false;

  static start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => void this.flush(), FLUSH_MS);
    this.timer.unref?.();
    this.purgeTimer = setInterval(() => {
      void this.purge(Number(process.env.SEARCH_ANALYTICS_RETENTION_DAYS || 180)).catch((error) => {
        console.warn('[SearchAnalytics] retention failed', { message: error instanceof Error ? error.message : String(error) });
      });
    }, 24 * 60 * 60 * 1000);
    this.purgeTimer.unref?.();
  }

  static stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    if (this.purgeTimer) clearInterval(this.purgeTimer);
    this.purgeTimer = null;
  }

  static enqueue(event: SearchEvent): void {
    if (this.events.length >= MAX_QUEUE) {
      console.warn('[SearchAnalytics] queue full; dropping search event');
      return;
    }
    this.events.push(event);
    SearchMetrics.gauge('product_search_analytics_queue_size', this.events.length);
    this.start();
  }

  static async flush(): Promise<void> {
    if (this.flushing || this.events.length === 0) return;
    this.flushing = true;
    const batch = this.events.splice(0, BATCH_SIZE);
    SearchMetrics.gauge('product_search_analytics_queue_size', this.events.length);
    try {
      const rows = batch.map(() => '(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').join(',');
      const values = batch.flatMap((event) => [
        event.searchId,
        event.empresaId,
        event.original,
        event.normalized,
        JSON.stringify(event.intent),
        event.results,
        event.related,
        event.candidates,
        event.timing.totalTimeMs,
        event.timing.parseTimeMs,
        event.timing.databaseTimeMs,
        event.timing.rankingTimeMs,
        event.rankingVersion,
        event.mode,
        event.results + event.related === 0 ? 1 : 0,
      ]);
      await query(
        `INSERT INTO search_events (
          search_id, id_empresa, query_original, query_normalized, parsed_intent,
          results_count, related_results_count, candidate_count, latency_ms,
          parse_time_ms, database_time_ms, ranking_time_ms, ranking_version,
          search_mode, zero_results
        ) VALUES ${rows}`,
        values
      );
    } catch (error) {
      console.warn('[SearchAnalytics] batch insert failed', {
        count: batch.length,
        message: error instanceof Error ? error.message : String(error),
      });
    } finally {
      this.flushing = false;
    }
  }

  static async drain(): Promise<void> {
    while (this.flushing) await new Promise((resolve) => setTimeout(resolve, 10));
    while (this.events.length > 0) await this.flush();
  }

  static async recordClick(empresaId: number, searchId: string, produtoId: number, position: number): Promise<void> {
    await query(
      `INSERT INTO search_click_events (id_empresa, search_id, id_produto, position)
       SELECT ?, ?, ?, ? FROM search_events
       WHERE id_empresa = ? AND search_id = ? LIMIT 1`,
      [empresaId, searchId, produtoId, position, empresaId, searchId]
    );
  }

  static async recordConversion(empresaId: number, searchId: string, orcamentoId: number, produtoId: number | null): Promise<void> {
    await query(
      `INSERT IGNORE INTO search_conversion_events (id_empresa, search_id, id_orcamento, id_produto)
       SELECT ?, ?, ?, ? FROM search_events
       WHERE id_empresa = ? AND search_id = ? LIMIT 1`,
      [empresaId, searchId, orcamentoId, produtoId || 0, empresaId, searchId]
    );
  }

  static async purge(retentionDays = 180): Promise<void> {
    const safeDays = Math.min(Math.max(Math.trunc(retentionDays), 1), 3650);
    await query(`DELETE FROM search_click_events WHERE clicked_at < NOW() - INTERVAL ${safeDays} DAY`);
    await query(`DELETE FROM search_conversion_events WHERE converted_at < NOW() - INTERVAL ${safeDays} DAY`);
    await query(`DELETE FROM search_events WHERE created_at < NOW() - INTERVAL ${safeDays} DAY`);
  }
}
