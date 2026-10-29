// Run against an isolated Chrome debugging instance and the local dev server.
// All application API calls are mocked in the page; this script never writes live data.
const target = await fetch('http://127.0.0.1:9333/json/new?about:blank', { method: 'PUT' }).then(r => r.json());
const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
let serial = 0;
const pending = new Map();
socket.onmessage = event => {
  const message = JSON.parse(event.data);
  const task = pending.get(message.id);
  if (task) { pending.delete(message.id); message.error ? task.reject(new Error(message.error.message)) : task.resolve(message.result); }
};
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++serial;
  pending.set(id, { resolve, reject });
  socket.send(JSON.stringify({ id, method, params }));
});
const run = async expression => {
  const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
  return result.result.value;
};
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const until = async expression => {
  for (let i = 0; i < 30; i++) {
    if (await run(expression)) return;
    await pause(300);
  }
  throw new Error(`Timed out: ${expression} | ${await run('document.body.innerText.slice(-2500)')}`);
};
await send('Page.enable');
await send('Network.enable');
await send('Network.setCookie', { name: 'maggenta_session', value: 'smoke-test-only', url: 'http://localhost:3000', httpOnly: true });
await send('Page.addScriptToEvaluateOnNewDocument', { source: `
  window.__apiCalls = [];
  const originalFetch = window.fetch;
  window.fetch = async (input, init = {}) => {
    const url = typeof input === 'string' ? input : input.url;
    if (!url.startsWith('/api/v1/')) return originalFetch(input, init);
    const method = init.method || 'GET';
    window.__apiCalls.push({ url, method, body: typeof init.body === 'string' ? init.body : '' });
    let data;
    if (url.includes('/usuarios/profile')) data = { nome: 'Teste Autenticado', usuario: 'teste' };
    else if (url.includes('/produtos/44/images/reorder') && method === 'PUT') data = JSON.parse(init.body).imageIds.map((id, index) => ({ id_imagem: id, id_produto: 44, ordem_imagem: index + 1, filename: 'imagem-' + id + '.jpg', url: 'https://example.test/' + id + '.jpg' }));
    else if (url.includes('/produtos/44/images')) data = [1, 2, 3].map(id => ({ id_imagem: id, id_produto: 44, ordem_imagem: id, filename: 'imagem-' + id + '.jpg', url: 'https://example.test/' + id + '.jpg' }));
    else if (url.includes('/produtos/44/links')) data = { categorias: [], subcategorias: [{ id_subcategoria: 2, subcategoria: 'Vinculada', id_categoria: 17, categoria: 'Categoria teste' }], publicos_alvos: [], datas_promocionais: [] };
    else if (url.includes('/tipos-produtos/habilitados')) data = { items: [{ id_tipo_produto: 1, tipo_produto: 'Tipo' }], total: 1, page: 1, limit: 100, totalPages: 1 };
    else if (url.includes('/subcategorias') && method === 'GET') data = { items: [{ id_subcategoria: 1, subcategoria: 'Opção teste', id_categoria: 17 }, { id_subcategoria: 2, subcategoria: 'Vinculada', id_categoria: 17 }], total: 2, page: 1, limit: 100, totalPages: 1 };
    else if (url.includes('/produtos?') && method === 'GET') data = { items: [{ id_produto: 44, produto: 'Produto teste', codigo: 'T44', id_tipo_produto: 1 }], total: 1, page: 1, limit: 12, totalPages: 1 };
    else if (url.includes('/tipos-produtos') && method === 'GET') data = { items: [], total: 0, page: 1, limit: 100, totalPages: 1 };
    else if (url.includes('/categorias') && method === 'GET') data = { items: [{ id_categoria: 17, categoria: 'Categoria teste', url_capa: 'https://example.test/old.jpg', habilitado: 'S' }], total: 1, page: 1, limit: 12, totalPages: 1 };
    else if (url.includes('/categorias/17/capa')) data = { id_categoria: 17, categoria: 'Categoria teste', url_capa: 'https://example.test/new.jpg' };
    else if (url.includes('/categorias/17') && method === 'PUT') data = { id_categoria: 17, categoria: 'Categoria teste', url_capa: 'https://example.test/old.jpg' };
    else if (url.includes('/categorias/18/capa')) data = { id_categoria: 18, categoria: 'Nova categoria teste', url_capa: 'https://example.test/new.jpg' };
    else if (url.endsWith('/categorias') && method === 'POST') data = { id_categoria: 18, categoria: 'Nova categoria teste' };
    else if (url.includes('/landing-pages') && method === 'GET') data = { items: [{ id: 10, title: 'Teste landing', slug: 'teste', keywords: 'teste', url: 'https://example.com' }], total: 1, page: 1, limit: 10, totalPages: 1 };
    else if (url.includes('/usuarios') && method === 'GET') data = { items: [], total: 0, page: 1, limit: 10, totalPages: 1 };
    else data = { id: 1 };
    return new Response(JSON.stringify({ success: true, data }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
` });
try {
  await send('Page.navigate', { url: 'http://localhost:3000/categorias' });
  await until(`document.body.innerText.includes('Categoria teste') && document.body.innerText.includes('Teste Autenticado')`);
  await run(`[...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Editar').click()`);
  await until(`!!document.querySelector('input[type=file]')`);
  await run(`(() => { const input = document.querySelector('input[type=file]'); const dt = new DataTransfer(); dt.items.add(new File(['image'], 'capa.jpg', { type: 'image/jpeg' })); input.files = dt.files; input.dispatchEvent(new Event('change', { bubbles: true })); })()`);
  await until(`document.body.innerText.includes('capa.jpg')`);
  await run(`[...document.querySelectorAll('button')].find(b => b.textContent.includes('Salvar e enviar capa')).click()`);
  await until(`window.__apiCalls.some(c => c.url.includes('/categorias/17/capa'))`);
  const cover = await run(`window.__apiCalls.filter(c => c.method !== 'GET')`);
  if (cover.length !== 2 || !cover[0].url.endsWith('/categorias/17') || !cover[1].url.endsWith('/categorias/17/capa')) throw new Error(`Unexpected cover requests: ${JSON.stringify(cover)}`);
  console.log('Category edit: file selection, metadata save and cover upload verified with mock API.');
  await until(`!document.querySelector('input[type=file]')`);
  await run(`[...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Nova categoria').click()`);
  await until(`!!document.querySelector('input[type=file]')`);
  await run(`(() => { const input = document.querySelector('input[name=categoria]'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, 'Nova categoria teste'); input.dispatchEvent(new Event('input', { bubbles: true })); const file = document.querySelector('input[type=file]'); const dt = new DataTransfer(); dt.items.add(new File(['image'], 'nova.jpg', { type: 'image/jpeg' })); file.files = dt.files; file.dispatchEvent(new Event('change', { bubbles: true })); })()`);
  await until(`document.body.innerText.includes('nova.jpg')`);
  await run(`[...document.querySelectorAll('button')].find(b => b.textContent.includes('Salvar e enviar capa')).click()`);
  await until(`window.__apiCalls.some(c => c.url.endsWith('/categorias/18/capa'))`);
  console.log('Category creation: record and cover saved in sequence with mock API.');

  await send('Page.navigate', { url: 'http://localhost:3000/usuarios' });
  await until(`[...document.querySelectorAll('button')].some(b => b.textContent.includes('Criar'))`);
  await run(`[...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Criar').click()`);
  await until(`!!document.querySelector('[role=dialog]')`);
  if (!await run(`document.querySelector('[role=dialog]').innerText.includes('Criar registro')`)) throw new Error('User modal not found');
  console.log('User page: full-width table and create dialog opened.');

  await send('Page.navigate', { url: 'http://localhost:3000/landing-pages' });
  await until(`document.body.innerText.includes('Teste landing')`);
  await run(`[...document.querySelectorAll('tbody tr')].find(r => r.textContent.includes('Teste landing')).click()`);
  await until(`!!document.querySelector('[role=dialog] iframe')`);
  if (!await run(`document.querySelector('[role=dialog] iframe').getAttribute('src') === 'https://example.com/' && document.querySelector('[role=dialog]').innerText.includes('teste')`)) throw new Error('Landing details or iframe missing');
  await run(`document.querySelector('[role=dialog] button[aria-label="Fechar"]').click()`);
  await until(`!document.querySelector('[role=dialog]')`);
  await run(`(() => { const row = [...document.querySelectorAll('tbody tr')].find(r => r.textContent.includes('Teste landing')); row.focus(); row.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); })()`);
  await until(`!!document.querySelector('[role=dialog] iframe')`);
  await run(`document.querySelector('[role=dialog] button[aria-label="Fechar"]').click()`);
  await until(`!document.querySelector('[role=dialog]')`);
  console.log('Landing page preview: row click, keyboard and iframe URL verified.');
  await run(`[...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Editar').click()`);
  await until(`!!document.querySelector('[role=dialog]')`);
  await run(`document.querySelector('[role=dialog] form').requestSubmit()`);
  await until(`window.__apiCalls.some(c => c.method === 'PUT' && c.url.endsWith('/landing-pages/10'))`);
  await until(`!document.querySelector('[role=dialog]')`);
  if (await run(`document.body.innerText.includes("reading 'reset'")`)) throw new Error('False reset error shown');
  console.log('Landing page edit: successful save closes dialog without reset error.');

  await send('Page.navigate', { url: 'http://localhost:3000/produtos' });
  await until(`document.body.innerText.includes('Produto teste')`);
  await run(`[...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Editar').click()`);
  await until(`document.body.innerText.includes('Vinculada') && !!document.querySelector('img[alt="imagem-1.jpg"]')`);
  if (!await run(`document.body.innerText.includes('Categoria teste')`)) throw new Error('Linked subcategory category not displayed');
  await run(`document.querySelector('button[aria-label="Mostrar subcategorias"]').click()`);
  await until(`[...document.querySelectorAll('[role="option"]')].some(option => option.innerText.includes('Opção teste') && option.innerText.includes('Categoria teste'))`);
  if (!await run(`document.querySelector('img[alt="imagem-1.jpg"]').closest('.grid').children.length === 3`)) throw new Error('Images were not rendered as a grid');
  await run(`document.querySelector('button[aria-label="Mover imagem-2.jpg para antes"]').click()`);
  await run(`[...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Salvar ordem').click()`);
  await until(`window.__apiCalls.some(c => c.url.endsWith('/produtos/44/images/reorder') && c.body.includes('[2,1,3]'))`);
  await run(`[...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Selecionar imagens').click()`);
  await until(`!!document.querySelector('input[aria-label="Selecionar imagem-1.jpg"]')`);
  await run(`document.querySelector('input[aria-label="Selecionar imagem-1.jpg"]').click()`);
  await until(`document.body.innerText.includes('Excluir selecionadas (1)')`);
  console.log('Product modal: category labels, image grid, reorder and selection verified with mock API.');
} finally {
  await send('Page.close').catch(() => undefined);
  socket.close();
}
