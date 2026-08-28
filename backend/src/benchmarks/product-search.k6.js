import http from 'k6/http';
import { check } from 'k6';

const baseUrl = __ENV.SEARCH_BASE_URL;
const tenantId = __ENV.SEARCH_EMPRESA_ID;
const token = __ENV.SEARCH_SITE_TOKEN;
const queries = ['bloco com pauta', 'garrafa parede dupla', 'garrafa térmica inox 500ml', 'mochila notebook 15.6"', 'A5', 'UV'];

export const options = {
  stages: [
    { duration: '1m', target: 50 }, { duration: '2m', target: 50 },
    { duration: '1m', target: 100 }, { duration: '2m', target: 100 },
    { duration: '1m', target: 250 }, { duration: '2m', target: 250 },
    { duration: '1m', target: 500 }, { duration: '2m', target: 500 },
    { duration: '1m', target: 1000 }, { duration: '2m', target: 1000 },
    { duration: '2m', target: 0 },
  ],
  thresholds: { http_req_failed: ['rate<0.01'], http_req_duration: ['p(95)<300', 'p(99)<800'] },
};

export default function () {
  if (!baseUrl || !tenantId) throw new Error('SEARCH_BASE_URL e SEARCH_EMPRESA_ID sao obrigatorios');
  const query = queries[Math.floor(Math.random() * queries.length)];
  const cacheMode = __ENV.SEARCH_CACHE_MODE || 'warm';
  const cacheBuster = cacheMode === 'cold' ? `&locale=pt-BR-${__VU}-${__ITER}` : '';
  const response = http.get(`${baseUrl}/api/v1/produtos/site/busca?empresaId=${tenantId}&q=${encodeURIComponent(query)}&limit=24${cacheBuster}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    tags: { cache_mode: cacheMode },
  });
  check(response, { 'status 200': (result) => result.status === 200, 'contract items': (result) => Boolean(result.json('data.items')) });
}

export function handleSummary(data) {
  return { 'search-benchmark-report.json': JSON.stringify({
    generatedAt: new Date().toISOString(),
    environment: { baseUrl, tenantId, cacheMode: __ENV.SEARCH_CACHE_MODE || 'warm', hardware: __ENV.SEARCH_HARDWARE || 'NOT_RECORDED', replicas: __ENV.SEARCH_REPLICAS || 'NOT_RECORDED', dataset: __ENV.SEARCH_DATASET || 'NOT_RECORDED' },
    metrics: data.metrics,
  }, null, 2) };
}
