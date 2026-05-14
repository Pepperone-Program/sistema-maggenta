import { CatalogoProdutoModel } from '@models/CatalogoProduto';
import { DataPromocionalModel } from '@models/DataPromocional';
import type {
  CreateDataPromocionalDTO,
  DataPromocional,
  DataPromocionalProduto,
  UpdateDataPromocionalDTO,
  VincularDataPromocionalProdutoDTO,
} from '@/types/data-promocional';
import { throwError } from '@utils/helpers';

export class DataPromocionalService {
  private static parseCatalogQuery(query: {
    page?: number | string;
    limit?: number | string;
    subcategorias?: string;
    publicos_alvos?: string;
    datas_promocionais?: string;
    quantidade_minima_min?: string;
    quantidade_minima_max?: string;
  }) {
    const parseIds = (value?: string) =>
      String(value || '')
        .split(',')
        .map((item) => Number(item.trim()))
        .filter((id) => Number.isInteger(id) && id > 0);
    const toNumber = (value?: string) => {
      if (value === undefined || value === '') return undefined;
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : undefined;
    };

    return {
      page: Number(query.page || 1),
      limit: Number(query.limit || 100),
      subcategorias: parseIds(query.subcategorias),
      publicosAlvos: parseIds(query.publicos_alvos),
      datasPromocionais: parseIds(query.datas_promocionais),
      quantidadeMinimaMin: toNumber(query.quantidade_minima_min),
      quantidadeMinimaMax: toNumber(query.quantidade_minima_max),
    };
  }

  static async createDataPromocional(
    data: CreateDataPromocionalDTO
  ): Promise<DataPromocional> {
    if (data.id_data_promocional !== undefined) {
      const existentePorId = await DataPromocionalModel.findById(data.id_data_promocional);
      if (existentePorId) {
        throwError('DUPLICATE_DATA_PROMOCIONAL_ID', 'Data promocional com esse ID ja existe', 409);
      }
    }

    const existente = await DataPromocionalModel.findByName(data.data_promocional);
    if (existente) {
      throwError('DUPLICATE_DATA_PROMOCIONAL', 'Data promocional ja existe', 409);
    }

    const id = await DataPromocionalModel.create(data);
    const dataPromocional = await DataPromocionalModel.findById(id);

    if (!dataPromocional) {
      throwError('CREATE_FAILED', 'Falha ao criar data promocional', 500);
    }

    return dataPromocional as DataPromocional;
  }

  static async getDataPromocionalById(dataPromocionalId: number): Promise<DataPromocional> {
    const dataPromocional = await DataPromocionalModel.findById(dataPromocionalId);

    if (!dataPromocional) {
      throwError('DATA_PROMOCIONAL_NOT_FOUND', 'Data promocional nao encontrada', 404);
    }

    return dataPromocional as DataPromocional;
  }

  static async listDatasPromocionais(
    page: number = 1,
    limit: number = 10,
    search?: string,
    habilitado?: string
  ): Promise<{ items: DataPromocional[]; total: number; page: number; limit: number }> {
    const { items, total } = await DataPromocionalModel.findAll(
      page,
      limit,
      search,
      habilitado
    );

    return { items, total, page, limit };
  }

  static async updateDataPromocional(
    dataPromocionalId: number,
    data: UpdateDataPromocionalDTO
  ): Promise<DataPromocional> {
    const dataPromocional = await this.getDataPromocionalById(dataPromocionalId);

    if (
      data.data_promocional &&
      data.data_promocional !== dataPromocional.data_promocional
    ) {
      const existente = await DataPromocionalModel.findByName(data.data_promocional);
      if (existente && existente.id_data_promocional !== dataPromocionalId) {
        throwError('DUPLICATE_DATA_PROMOCIONAL', 'Data promocional ja existe', 409);
      }
    }

    await DataPromocionalModel.update(dataPromocionalId, data);
    const updated = await DataPromocionalModel.findById(dataPromocionalId);

    if (!updated) {
      throwError('UPDATE_FAILED', 'Falha ao atualizar data promocional', 500);
    }

    return updated as DataPromocional;
  }

  static async deleteDataPromocional(dataPromocionalId: number): Promise<void> {
    await this.getDataPromocionalById(dataPromocionalId);

    if (await DataPromocionalModel.hasProdutos(dataPromocionalId)) {
      throwError(
        'DATA_PROMOCIONAL_HAS_PRODUTOS',
        'Data promocional possui produtos vinculados',
        409
      );
    }

    const success = await DataPromocionalModel.delete(dataPromocionalId);
    if (!success) {
      throwError('DELETE_FAILED', 'Falha ao deletar data promocional', 500);
    }
  }

  static async vincularProduto(
    empresaId: number,
    dataPromocionalId: number,
    data: VincularDataPromocionalProdutoDTO
  ): Promise<DataPromocionalProduto> {
    await this.getDataPromocionalById(dataPromocionalId);

    if (!(await DataPromocionalModel.produtoExists(empresaId, data.id_produto))) {
      throwError('PRODUTO_NOT_FOUND', 'Produto nao encontrado', 404);
    }

    const existente = await DataPromocionalModel.findProdutoLink(
      dataPromocionalId,
      data.id_produto
    );

    if (existente) {
      return existente;
    }

    return DataPromocionalModel.addProduto(dataPromocionalId, data.id_produto);
  }

  static async desvincularProduto(
    dataPromocionalId: number,
    produtoId: number
  ): Promise<void> {
    await this.getDataPromocionalById(dataPromocionalId);
    const success = await DataPromocionalModel.removeProduto(dataPromocionalId, produtoId);

    if (!success) {
      throwError(
        'VINCULO_NOT_FOUND',
        'Vinculo entre data promocional e produto nao encontrado',
        404
      );
    }
  }

  static async listProdutos(
    dataPromocionalId: number,
    page: number = 1,
    limit: number = 10
  ): Promise<{ items: DataPromocionalProduto[]; total: number; page: number; limit: number }> {
    await this.getDataPromocionalById(dataPromocionalId);
    const { items, total } = await DataPromocionalModel.findProdutos(
      dataPromocionalId,
      page,
      limit
    );

    return { items, total, page, limit };
  }

  static async getCatalogoDataPromocional(
    empresaId: number,
    dataPromocionalId: number,
    query: {
      page?: number | string;
      limit?: number | string;
      subcategorias?: string;
      publicos_alvos?: string;
      datas_promocionais?: string;
      quantidade_minima_min?: string;
      quantidade_minima_max?: string;
    }
  ) {
    const dataPromocional = await this.getDataPromocionalById(dataPromocionalId);
    const filters = this.parseCatalogQuery(query);

    const [produtos, filtros] = await Promise.all([
      CatalogoProdutoModel.findRelatedProducts(
        empresaId,
        { table: 'aux_datas_promocionais_produtos', column: 'id_data_promocional' },
        dataPromocionalId,
        filters
      ),
      CatalogoProdutoModel.findRelatedFacets(
        empresaId,
        { table: 'aux_datas_promocionais_produtos', column: 'id_data_promocional' },
        dataPromocionalId
      ),
    ]);

    return {
      data_promocional: dataPromocional,
      filtros,
      ...produtos,
      totalPages: Math.ceil(produtos.total / produtos.limit),
    };
  }
}
