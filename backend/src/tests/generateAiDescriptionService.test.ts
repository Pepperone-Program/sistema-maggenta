import '../module-alias';
import assert from 'node:assert/strict';
import {
  AI_DESCRIPTION_PROMPT,
  parseRetryDurationMs,
  validateGeneratedDescription,
} from '@services/generateAiDescriptionService';

assert.match(AI_DESCRIPTION_PROMPT, /A Caneca Cristal de 400ml/);
assert.match(AI_DESCRIPTION_PROMPT, /somente referência de estilo/i);
assert.match(AI_DESCRIPTION_PROMPT, /só podem ser usadas quando forem sustentadas/i);

const valid = validateGeneratedDescription({
  titulo: 'Garrafa Térmica Inox 750ml Personalizada',
  descricao: 'Garrafa térmica em inox com capacidade de 750ml, indicada para ações de endomarketing, eventos corporativos e presentes para clientes e colaboradores.',
});

assert.equal(valid.titulo, 'Garrafa Térmica Inox 750ml Personalizada');
assert.ok(valid.descricao.length <= 800);

assert.throws(
  () => validateGeneratedDescription({
    titulo: 'Garrafa Térmica Inox 750ml',
    descricao: valid.descricao,
  }),
  (error: unknown) => (error as { code?: string }).code === 'AI_INVALID_TITLE'
);

assert.throws(
  () => validateGeneratedDescription({
    titulo: valid.titulo,
    descricao: 'A'.repeat(801),
  }),
  (error: unknown) => (error as { code?: string }).code === 'AI_INVALID_DESCRIPTION'
);

const exactLimit = validateGeneratedDescription({
  titulo: 'Caderno A5 com Pauta Personalizado',
  descricao: 'A'.repeat(800),
});
assert.equal(Array.from(exactLimit.descricao).length, 800);

assert.equal(parseRetryDurationMs('49.561140959s'), 49_561.140959);
assert.equal(parseRetryDurationMs('1m4.368s'), 64_368);
assert.equal(parseRetryDurationMs('38m52.8s'), 2_332_800);
assert.equal(parseRetryDurationMs('348.624198ms'), 348.624198);
assert.equal(parseRetryDurationMs('inválido'), null);

console.log('generateAiDescriptionService tests passed');
