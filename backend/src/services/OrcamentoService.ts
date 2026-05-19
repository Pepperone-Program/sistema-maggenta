import { OrcamentoModel } from '@models/Orcamento';
import { OrcamentoItemModel } from '@models/OrcamentoItem';
import type { Orcamento, CreateOrcamentoDTO, UpdateOrcamentoDTO } from '@/types/orcamento';
import type { OrcamentoItem, CreateOrcamentoItemDTO } from '@/types/orcamento-item';
import { throwError } from '@utils/helpers';

export class OrcamentoService {
  static async createOrcamento(
    empresaId: number,
    data: CreateOrcamentoDTO
  ): Promise<Orcamento> {
    const id = await OrcamentoModel.create(empresaId, data);
    const orcamento = await OrcamentoModel.findById(empresaId, id);

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
