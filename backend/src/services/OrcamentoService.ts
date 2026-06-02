import { OrcamentoModel } from '@models/Orcamento';
import { OrcamentoItemModel } from '@models/OrcamentoItem';
import { OrcamentoEmailService } from '@services/OrcamentoEmailService';
import type { Orcamento, CreateOrcamentoDTO, UpdateOrcamentoDTO } from '@/types/orcamento';
import type { OrcamentoItem, CreateOrcamentoItemDTO } from '@/types/orcamento-item';
import { throwError } from '@utils/helpers';

export class OrcamentoService {
  private static readonly quoteNotificationTimers = new Map<number, NodeJS.Timeout>();
  private static readonly notifiedQuoteIds = new Set<number>();
  private static readonly quoteNotificationDelayMs = Number(
    process.env.ORCAMENTO_EMAIL_DEBOUNCE_MS || 10000
  );

  private static async notifyQuote(data: CreateOrcamentoDTO, quoteNumber?: number): Promise<boolean> {
    try {
      if (!OrcamentoEmailService.hasQuoteItems(data)) {
        console.warn('[OrcamentoService] Email de orcamento adiado: payload sem itens');
        return false;
      }

      await OrcamentoEmailService.sendQuoteEmail(data, quoteNumber);
      if (quoteNumber) {
        this.notifiedQuoteIds.add(quoteNumber);
      }

      return true;
    } catch (error) {
      console.error('[OrcamentoService] Falha ao enviar email de orcamento', error);
      return false;
    }
  }

  private static async notifyStoredQuote(empresaId: number, orcamentoId: number): Promise<void> {
    try {
      if (this.notifiedQuoteIds.has(orcamentoId)) return;

      const orcamento = await OrcamentoModel.findById(empresaId, orcamentoId);
      if (!orcamento) return;

      const itens = await OrcamentoItemModel.findByOrcamentoId(orcamentoId);
      if (!itens.length) return;

      await OrcamentoEmailService.sendQuoteEmail(
        {
          ...(orcamento as unknown as CreateOrcamentoDTO),
          itens: itens as unknown as Array<Record<string, unknown>>,
        },
        orcamentoId
      );
      this.notifiedQuoteIds.add(orcamentoId);
    } catch (error) {
      console.error('[OrcamentoService] Falha ao enviar email com itens do orcamento', error);
    }
  }

  private static scheduleStoredQuoteNotification(empresaId: number, orcamentoId: number): void {
    if (this.notifiedQuoteIds.has(orcamentoId)) return;

    const existingTimer = this.quoteNotificationTimers.get(orcamentoId);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    const timer = setTimeout(() => {
      this.quoteNotificationTimers.delete(orcamentoId);
      this.notifyStoredQuote(empresaId, orcamentoId).catch((error) => {
        console.error('[OrcamentoService] Falha ao agendar email de orcamento', error);
      });
    }, Math.max(this.quoteNotificationDelayMs, 0));

    timer.unref?.();
    this.quoteNotificationTimers.set(orcamentoId, timer);
  }

  static async createOrcamento(
    empresaId: number,
    data: CreateOrcamentoDTO
  ): Promise<Orcamento> {
    let id: number | undefined;
    let orcamento: Orcamento | null = null;

    try {
      const createdId = await OrcamentoModel.create(empresaId, data);
      id = createdId;
      orcamento = await OrcamentoModel.findById(empresaId, createdId);
    } catch (error) {
      await this.notifyQuote(data);
      throw error;
    }

    await this.notifyQuote(data, id);

    if (!orcamento) {
      throwError('CREATE_FAILED', 'Falha ao criar orçamento', 500);
    }

    return orcamento as Orcamento;
  }

  static async getOrcamentoById(
    empresaId: number,
    orcamentoId: number,
    includeItems: boolean = false
  ): Promise<Orcamento & { itens?: OrcamentoItem[] }> {
    const orcamento = await OrcamentoModel.findById(empresaId, orcamentoId);

    if (!orcamento) {
      throwError('ORCAMENTO_NOT_FOUND', 'Orçamento não encontrado', 404);
    }

    if (includeItems) {
      const itens = await OrcamentoItemModel.findByOrcamentoId(orcamentoId);
      return { ...(orcamento as Orcamento), itens };
    }

    return orcamento as Orcamento;
  }

  static async listOrcamentos(
    empresaId: number,
    page: number = 1,
    limit: number = 100,
    search?: string
  ): Promise<{ items: Orcamento[]; total: number; page: number; limit: number }> {
    const { items, total } = await OrcamentoModel.findAll(
      empresaId,
      page,
      limit,
      search
    );

    return {
      items,
      total,
      page,
      limit,
    };
  }

  static async updateOrcamento(
    empresaId: number,
    orcamentoId: number,
    data: UpdateOrcamentoDTO
  ): Promise<Orcamento> {
    const orcamento = await OrcamentoModel.findById(empresaId, orcamentoId);

    if (!orcamento) {
      throwError('ORCAMENTO_NOT_FOUND', 'Orçamento não encontrado', 404);
    }

    await OrcamentoModel.update(empresaId, orcamentoId, data);
    const updated = await OrcamentoModel.findById(empresaId, orcamentoId);

    if (!updated) {
      throwError('UPDATE_FAILED', 'Falha ao atualizar orçamento', 500);
    }

    return updated as Orcamento;
  }

  static async deleteOrcamento(
    empresaId: number,
    orcamentoId: number
  ): Promise<void> {
    const orcamento = await OrcamentoModel.findById(empresaId, orcamentoId);

    if (!orcamento) {
      throwError('ORCAMENTO_NOT_FOUND', 'Orçamento não encontrado', 404);
    }

    await OrcamentoItemModel.deleteByOrcamentoId(orcamentoId);
    const success = await OrcamentoModel.delete(empresaId, orcamentoId);

    if (!success) {
      throwError('DELETE_FAILED', 'Falha ao deletar orçamento', 500);
    }
  }

  static async addItemToOrcamento(
    empresaId: number,
    orcamentoId: number,
    data: CreateOrcamentoItemDTO
  ): Promise<OrcamentoItem> {
    const orcamento = await OrcamentoModel.findById(empresaId, orcamentoId);

    if (!orcamento) {
      throwError('ORCAMENTO_NOT_FOUND', 'Orçamento não encontrado', 404);
    }

    const itemId = await OrcamentoItemModel.create(data);
    const item = await OrcamentoItemModel.findById(itemId);

    if (!item) {
      throwError('CREATE_ITEM_FAILED', 'Falha ao adicionar item', 500);
    }

    this.scheduleStoredQuoteNotification(empresaId, orcamentoId);

    return item as OrcamentoItem;
  }

  static async removeItemFromOrcamento(itemId: number): Promise<void> {
    const item = await OrcamentoItemModel.findById(itemId);

    if (!item) {
      throwError('ITEM_NOT_FOUND', 'Item não encontrado', 404);
    }

    const success = await OrcamentoItemModel.delete(itemId);

    if (!success) {
      throwError('DELETE_ITEM_FAILED', 'Falha ao remover item', 500);
    }
  }
}
