const FAILURE_THRESHOLD = Number(process.env.SEARCH_CIRCUIT_BREAKER_FAILURES || 5);
const OPEN_MS = Number(process.env.SEARCH_CIRCUIT_BREAKER_OPEN_MS || 30_000);

export class SearchCircuitBreaker {
  private static failures = 0;
  private static openUntil = 0;

  static isOpen(): boolean {
    if (this.openUntil <= Date.now()) {
      if (this.openUntil) this.reset();
      return false;
    }
    return true;
  }

  static success(): void {
    this.reset();
  }

  static failure(error: unknown): void {
    const code = String((error as { code?: string })?.code || '');
    if (!['DB_QUERY_ERROR', 'DB_TOO_MANY_REQUESTS', 'DB_UNREACHABLE', 'SEARCH_QUERY_TIMEOUT', 'SEARCH_SATURATED'].includes(code)) return;
    this.failures += 1;
    if (this.failures >= FAILURE_THRESHOLD) this.openUntil = Date.now() + OPEN_MS;
  }

  static state(): 'closed' | 'open' {
    return this.isOpen() ? 'open' : 'closed';
  }

  private static reset(): void {
    this.failures = 0;
    this.openUntil = 0;
  }
}
