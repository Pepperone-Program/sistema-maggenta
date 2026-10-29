import assert from 'node:assert/strict';
import { saveCategoryWithCover } from '../src/components/admin/category-save';

async function main() {
  const file = new File(['image'], 'cover.jpg', { type: 'image/jpeg' });
  let savedId: number | null = null;
  const calls: string[] = [];
  const result = await saveCategoryWithCover({
    id: null, cover: file,
    save: async id => { calls.push(`save:${id}`); return { id_categoria: 23, url_capa: '' }; },
    onPersisted: id => { savedId = id; calls.push(`persist:${id}`); },
    upload: async (id, selected) => { calls.push(`upload:${id}:${selected.name}`); return { id_categoria: id, url_capa: 'https://example.com/cover.jpg' }; },
  });
  assert.equal(result.url_capa, 'https://example.com/cover.jpg');
  assert.deepEqual(calls, ['save:null', 'persist:23', 'upload:23:cover.jpg']);
  await assert.rejects(saveCategoryWithCover({
    id: null, cover: file,
    save: async () => ({ id_categoria: 42 }),
    onPersisted: id => { savedId = id; },
    upload: async () => { throw new Error('storage unavailable'); },
  }), /dados da categoria foram salvos.*storage unavailable/);
  assert.equal(savedId, 42, 'retry must update the existing record');
  let retriedId: number | null = null;
  await saveCategoryWithCover({
    id: savedId, cover: file,
    save: async id => { retriedId = id; return { id_categoria: id || undefined }; },
    onPersisted: () => undefined,
    upload: async id => ({ id_categoria: id, url_capa: 'https://example.com/cover.jpg' }),
  });
  assert.equal(retriedId, 42);
  await assert.rejects(saveCategoryWithCover({
    id: 42, cover: file,
    save: async () => ({ id_categoria: 42 }), onPersisted: () => undefined,
    upload: async () => ({ id_categoria: 42, url_capa: '' }),
  }), /retornou a URL/);
  console.log('Category cover save, failure and retry verified.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });

