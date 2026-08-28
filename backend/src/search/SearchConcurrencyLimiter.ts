import { SearchMetrics } from './SearchMetrics';

const poolLimit = Number(process.env.DB_CONNECTION_LIMIT || 30);
const configured = Number(process.env.SEARCH_MAX_CONCURRENT || Math.max(1, Math.floor(poolLimit / 4)));
const maximum = Number.isInteger(configured) && configured > 0 ? configured : 1;

export class SearchConcurrencyLimiter {
  private static active = 0;

  static async run<T>(operation: () => Promise<T>): Promise<T> {
    if (this.active >= maximum) {
      SearchMetrics.increment('product_search_saturation_rejections_total');
      throw Object.assign(new Error('Capacidade de busca temporariamente saturada'), { code: 'SEARCH_SATURATED', statusCode: 503 });
    }
    this.active += 1;
    SearchMetrics.gauge('product_search_in_flight', this.active);
    try {
      return await operation();
    } finally {
      this.active -= 1;
      SearchMetrics.gauge('product_search_in_flight', this.active);
    }
  }
}
