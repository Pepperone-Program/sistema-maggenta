import type { RowDataPacket } from 'mysql2/promise';
import { getConnection } from '@database/connection';
import { SearchDictionaryService } from './SearchDictionaryService';
import { SearchDocumentService } from './SearchDocumentService';

export type SearchCoverageRepairResult = {
  empresaId: number;
  repaired: number;
  productIds: number[];
  alreadyRunning: boolean;
};

const inFlight = new Map<number, Promise<SearchCoverageRepairResult>>();

export class SearchCoverageRepairService {
  static repair(empresaId: number): Promise<SearchCoverageRepairResult> {
    if (!Number.isInteger(empresaId) || empresaId <= 0) {
      return Promise.reject(
        Object.assign(new Error('Empresa invalida para reparar a busca'), {
          code: 'INVALID_EMPRESA_ID',
          statusCode: 422,
        }),
      );
    }

    const activeRepair = inFlight.get(empresaId);
    if (activeRepair) return activeRepair;

    const repair = this.run(empresaId).finally(() => {
      inFlight.delete(empresaId);
    });
    inFlight.set(empresaId, repair);
    return repair;
  }

  private static async run(empresaId: number): Promise<SearchCoverageRepairResult> {
    const connection = await getConnection();
    const lockName = `maggenta_search_coverage_${empresaId}`;
    let locked = false;

    try {
      const [lockRows] = await connection.execute<Array<RowDataPacket & { acquired: number }>>(
        'SELECT GET_LOCK(?, 0) AS acquired',
        [lockName],
      );
      locked = Number(lockRows[0]?.acquired) === 1;
      if (!locked) {
        return { empresaId, repaired: 0, productIds: [], alreadyRunning: true };
      }

      const [missingRows] = await connection.execute<Array<RowDataPacket & { id_produto: number }>>(
        `SELECT p.id_produto
         FROM produtos p
         LEFT JOIN product_search_documents d
           ON d.id_empresa = p.id_empresa AND d.id_produto = p.id_produto
         WHERE p.id_empresa = ?
           AND p.site = 'S'
           AND p.habilitado = 'S'
           AND (d.id_produto IS NULL OR d.site <> 'S' OR d.habilitado <> 'S')
         ORDER BY p.id_produto ASC`,
        [empresaId],
      );
      const productIds = missingRows.map((row) => Number(row.id_produto));

      for (const produtoId of productIds) {
        await SearchDocumentService.refreshProduct(empresaId, produtoId, null, false);
      }
      if (productIds.length) {
        await SearchDocumentService.incrementCatalogVersion(empresaId);
      }

      SearchDictionaryService.invalidate(empresaId);
      await SearchDictionaryService.assertCatalogReady(empresaId);

      return { empresaId, repaired: productIds.length, productIds, alreadyRunning: false };
    } finally {
      if (locked) {
        await connection.execute('SELECT RELEASE_LOCK(?)', [lockName]).catch(() => undefined);
      }
      connection.release();
    }
  }
}
