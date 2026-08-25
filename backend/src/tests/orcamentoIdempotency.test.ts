import assert from 'node:assert/strict';
import {
  quoteIdempotencyFingerprint,
  quoteItemFingerprint,
  sanitizeIdempotencyKey,
} from '@utils/orcamentoIdempotency';

const base = {
  email: ' Cliente@Example.com ',
  contato: 'Maria',
  tel: '(11) 99999-0000',
  data_orcamento: '2026-08-25',
};

assert.equal(
  quoteIdempotencyFingerprint(1, base).fingerprint,
  quoteIdempotencyFingerprint(1, { ...base, email: 'cliente@example.com' }).fingerprint,
  'normalizacao deve identificar retries equivalentes'
);
assert.notEqual(
  quoteIdempotencyFingerprint(1, base).fingerprint,
  quoteIdempotencyFingerprint(2, base).fingerprint,
  'a empresa deve fazer parte da identidade'
);
assert.equal(
  quoteIdempotencyFingerprint(1, base, 'checkout-123').fingerprint,
  quoteIdempotencyFingerprint(1, { ...base, contato: 'Outro' }, 'checkout-123').fingerprint,
  'uma chave explicita deve ser deterministica mesmo se o retry variar o payload'
);
assert.equal(sanitizeIdempotencyKey(' '.repeat(201)), null);

const item = {
  id_orcamento: 10,
  data_orcamento: '2026-08-25',
  id_produto: 20,
  codigo: 'ABC',
  produto: 'Produto',
  gravacao_cores: '0',
  quantidade: 100,
};
assert.equal(
  quoteItemFingerprint(1, 10, item),
  quoteItemFingerprint(1, 10, { ...item }),
  'o mesmo item deve produzir a mesma trava'
);
assert.notEqual(
  quoteItemFingerprint(1, 10, item),
  quoteItemFingerprint(1, 10, { ...item, quantidade: 200 }),
  'variacoes reais do item devem permanecer distintas'
);

console.log('orcamentoIdempotency: 6 verificacoes passaram');
