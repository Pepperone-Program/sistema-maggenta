import '../module-alias';
import assert from 'node:assert/strict';
import { validateGeneratedDescription } from '@services/generateAiDescriptionService';

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

console.log('generateAiDescriptionService tests passed');
