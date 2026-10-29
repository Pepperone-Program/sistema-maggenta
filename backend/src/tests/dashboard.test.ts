import assert from 'node:assert/strict';

// Substitute the database module before loading the model: no live connection.
const connectionPath = require.resolve('../database/connection');
const calls: Array<{ sql: string; values: unknown[] }> = [];
require.cache[connectionPath] = {
  id: connectionPath, filename: connectionPath, loaded: true,
  exports: { query: async (sql: string, values: unknown[] = []) => {
    calls.push({ sql, values });
    if (sql.includes('CURRENT_DATE')) return [{ hoje: '2026-01-15' }];
    if (sql.includes('COUNT(DISTINCT o.id_orcamento)')) return [{ id_categoria: 4, categoria: 'Canecas', total: '2' }];
    if (sql.includes('COUNT(DISTINCT p.id_produto)')) return [{ id_categoria: 4, categoria: 'Canecas', total: '5' }];
    return [{ dia: '2026-01-01', total: '3' }];
  } },
} as NodeModule;

const { DashboardModel, dashboardDays } = require('../models/Dashboard') as typeof import('../models/Dashboard');

async function run() {
  const leap = dashboardDays('2024-03-01', [{ dia: '2024-02-29', total: 2 }]);
  assert.equal(leap.length, 30);
  assert.deepEqual(leap[28], { dia: '2024-02-29', total: 2 });
  assert.deepEqual(leap[29], { dia: '2024-03-01', total: 0 });
  const result = await DashboardModel.summary(17);
  assert.equal(result.categorias_orcamentos[0].total, 2);
  assert.equal(result.categorias_produtos[0].total, 5);
  assert.deepEqual(result.orcamentos_por_dia[0], { dia: '2025-12-17', total: 0 });
  assert.equal(result.orcamentos_por_dia.find(row => row.dia === '2026-01-01')?.total, 3);
  assert.deepEqual(calls[3].values, [17, '2025-12-17', '2026-01-16']);
  for (const call of calls.slice(1, 3)) {
    assert.deepEqual(call.values, [17, 17, 17]);
    assert.match(call.sql, /UNION/);
    assert.match(call.sql, /p.id_empresa = /);
    assert.match(call.sql, /c.id_empresa = /);
  }
  console.log('Dashboard: intervalos, dias sem dados, normalização e escopo das consultas verificados.');
}
run().catch(error => { console.error(error); process.exitCode = 1; });
