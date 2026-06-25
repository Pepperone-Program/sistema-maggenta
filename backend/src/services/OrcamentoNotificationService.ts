import { getConnection } from '@database/connection';
import { OrcamentoEmailService } from '@services/OrcamentoEmailService';
import type { CreateOrcamentoDTO, Orcamento } from '@/types/orcamento';
import type { OrcamentoItem } from '@/types/orcamento-item';

type QuoteWithItems = CreateOrcamentoDTO & {
  itens: Array<Record<string, unknown>>;
};

export class OrcamentoNotificationService {
  private static lockName(empresaId: number, orcamentoId: number): string {
    return `orcamento-email:${empresaId}:${orcamentoId}`;
  }

  static async sendStoredQuote(
    empresaId: number,
    orcamentoId: number,
    fallbackData?: CreateOrcamentoDTO
  ): Promise<boolean> {
    const connection = await getConnection();
    const lockName = this.lockName(empresaId, orcamentoId);
    let acquiredLock = false;

    try {
      const [lockRows] = await connection.execute(
        'SELECT GET_LOCK(?, 0) AS acquired',
        [lockName]
      );
      acquiredLock = Number((lockRows as Array<{ acquired: number }>)[0]?.acquired) === 1;

      if (!acquiredLock) {
        return false;
      }

      const [quoteRows] = await connection.execute(
        `
          SELECT *
          FROM orcamentos
          WHERE id_empresa = ? AND id_orcamento = ?
          LIMIT 1
        `,
        [empresaId, orcamentoId]
      );
      const quote = (quoteRows as Orcamento[])[0];

      if (!quote || quote.enviado === 'S') {
        return quote?.enviado === 'S';
      }

      const payload = await this.buildPayload(connection, quote, fallbackData);
      if (!payload || !OrcamentoEmailService.hasQuoteItems(payload)) {
        return false;
      }

      try {
        const sent = await OrcamentoEmailService.sendQuoteEmail(payload, orcamentoId);
        if (!sent) {
          await this.updateEmailStatus(connection, empresaId, orcamentoId, 'N');
          return false;
        }

        await this.updateEmailStatus(connection, empresaId, orcamentoId, 'S');
        return true;
      } catch (error) {
        await this.updateEmailStatus(connection, empresaId, orcamentoId, 'N').catch(
          (statusError) => {
            console.error(
              `[OrcamentoNotificationService] Falha ao marcar orcamento ${orcamentoId} como nao enviado`,
              statusError
            );
          }
        );
        throw error;
      }
    } finally {
      if (acquiredLock) {
        await connection.execute('SELECT RELEASE_LOCK(?)', [lockName]).catch((error) => {
          console.error(
            `[OrcamentoNotificationService] Falha ao liberar lock do orcamento ${orcamentoId}`,
            error
          );
        });
      }
      connection.release();
    }
  }

  private static async buildPayload(
    connection: Awaited<ReturnType<typeof getConnection>>,
    quote: Orcamento,
    fallbackData?: CreateOrcamentoDTO
  ): Promise<QuoteWithItems | null> {
    if (fallbackData && OrcamentoEmailService.hasQuoteItems(fallbackData)) {
      return fallbackData as QuoteWithItems;
    }

    const [itemRows] = await connection.execute(
      `
        SELECT *
        FROM orcamentos_itens
        WHERE id_orcamento = ?
        ORDER BY id_item ASC
      `,
      [quote.id_orcamento]
    );
    const items = itemRows as OrcamentoItem[];

    if (!items.length) {
      return null;
    }

    return {
      ...(quote as unknown as CreateOrcamentoDTO),
      itens: items as unknown as Array<Record<string, unknown>>,
    };
  }

  private static async updateEmailStatus(
    connection: Awaited<ReturnType<typeof getConnection>>,
    empresaId: number,
    orcamentoId: number,
    status: 'S' | 'N'
  ): Promise<void> {
    await connection.execute(
      `
        UPDATE orcamentos
        SET enviado = ?
        WHERE id_empresa = ? AND id_orcamento = ?
      `,
      [status, empresaId, orcamentoId]
    );
  }
}
