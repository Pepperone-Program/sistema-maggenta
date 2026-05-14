import { TipoProdutoModel } from '@models/TipoProduto';
import { throwError } from '@utils/helpers';

export class TipoProdutoService {
  static async listTiposProdutos(
    empresaId: number,
    page: number = 1,
    limit: number = 100,
    filters: { search?: string; habilitado?: string } = {}
  ) {
    const result = await TipoProdutoModel.findAll(empresaId, page, limit, filters);
    return {
      ...result,
      totalPages: Math.ceil(result.total / result.limit),
    };
  }

  static async getCatalogoTipoProduto(
    empresaId: number,
    tipoProdutoId: number,
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
    const tipoProduto = await TipoProdutoModel.findById(empresaId, tipoProdutoId);
    if (!tipoProduto) {
      throwError('TIPO_PRODUTO_NOT_FOUND', 'Tipo de produto nao encontrado', 404);
    }

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

    const produtos = await TipoProdutoModel.findCatalogProducts(empresaId, tipoProdutoId, {
      page: Number(query.page || 1),
      limit: Number(query.limit || 100),
      subcategorias: parseIds(query.subcategorias),
      publicosAlvos: parseIds(query.publicos_alvos),
      datasPromocionais: parseIds(query.datas_promocionais),
      quantidadeMinimaMin: toNumber(query.quantidade_minima_min),
      quantidadeMinimaMax: toNumber(query.quantidade_minima_max),
    });
    const filtros = await TipoProdutoModel.findCatalogFacets(empresaId, tipoProdutoId);

    return {
      tipo_produto: tipoProduto,
      filtros,
      ...produtos,
      totalPages: Math.ceil(produtos.total / produtos.limit),
    };
  }
}
