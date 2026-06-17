import { ProdutoModel } from '@models/Produto';
import type { Produto, CreateProdutoDTO, UpdateProdutoDTO } from '@/types/produto';
import { throwError } from '@utils/helpers';

type SiteSearchResult =
  | {
      match_exato_codigo: true;
      id_produto: number;
      codigo: string;
    }
  | {
      match_exato_codigo: false;
      items: Produto[];
      total: number;
      page: number;
      limit: number;
    };

export class ProdutoService {
  private static async attachImages<T extends Produto>(produtos: T[]): Promise<T[]> {
    const imagesByProduct = await ProdutoModel.findImagesByProductIds(
      produtos.map((produto) => Number(produto.id_produto))
    );

    return produtos.map((produto) => ({
      ...produto,
      imagens: imagesByProduct.get(Number(produto.id_produto)) || [],
    }));
  }

  private static async attachCategories<T extends Produto>(
    empresaId: number,
    produtos: T[]
  ): Promise<T[]> {
    const categoriesByProduct = await ProdutoModel.findCategoriesByProductIds(
      empresaId,
      produtos.map((produto) => Number(produto.id_produto))
    );

    return produtos.map((produto) => {
      const categorias = categoriesByProduct.get(Number(produto.id_produto)) || [];
      const primeiraCategoria = categorias[0] || null;

      return {
        ...produto,
        id_categoria: primeiraCategoria?.id_categoria || null,
        categoria: primeiraCategoria?.categoria || null,
        categorias,
      };
    });
  }

  static async createProduto(
    empresaId: number,
    data: CreateProdutoDTO
  ): Promise<Produto> {
    const existente = await ProdutoModel.searchByCodigo(empresaId, data.codigo);
    if (existente) {
      throwError('DUPLICATE_CODIGO', 'Produto com esse código já existe', 409);
    }

    const id = await ProdutoModel.create(empresaId, data);
    const produto = await ProdutoModel.findById(empresaId, id);

    if (!produto) {
      throwError('CREATE_FAILED', 'Falha ao criar produto', 500);
    }

    return produto as Produto;
  }

  static async getProdutoById(
    empresaId: number,
    produtoId: number
  ): Promise<Produto> {
    const produto = await ProdutoModel.findByIdForSite(empresaId, produtoId);

    if (!produto) {
      throwError('PRODUTO_NOT_FOUND', 'Produto não encontrado', 404);
    }

    const [produtoComImagens] = await this.attachImages([produto as Produto]);
    const [produtoComCategorias] = await this.attachCategories(empresaId, [produtoComImagens]);
    return produtoComCategorias;
  }

  static async listProdutos(
    empresaId: number,
    page: number = 1,
    limit: number = 100,
    search?: string,
    habilitado?: string,
    site?: string
  ): Promise<{ items: Produto[]; total: number; page: number; limit: number }> {
    const { items, total } = await ProdutoModel.findAll(
      empresaId,
      page,
      limit,
      search,
      habilitado,
      site
    );

    const itemsWithImages = await this.attachImages(items);
    const itemsWithCategories = await this.attachCategories(empresaId, itemsWithImages);

    return {
      items: itemsWithCategories,
      total,
      page,
      limit,
    };
  }

  static async listProdutosSite(
    empresaId: number,
    page: number = 1,
    limit: number = 100,
    search?: string
  ): Promise<{ items: Produto[]; total: number; page: number; limit: number }> {
    const { items, total } = await ProdutoModel.findAllForSite(
      empresaId,
      page,
      limit,
      search
    );
    const itemsWithImages = await this.attachImages(items);

    return {
      items: itemsWithImages,
      total,
      page,
      limit,
    };
  }

  static async searchProdutosSite(
    empresaId: number,
    term: string,
    page: number = 1,
    limit: number = 100
  ): Promise<SiteSearchResult> {
    const normalizedTerm = term.trim();
    if (!normalizedTerm) {
      throwError('INVALID_SEARCH', 'Informe o termo de busca em q', 400);
    }

    const exactCodeMatch =
      (await ProdutoModel.searchByCodigoForSite(empresaId, normalizedTerm)) ||
      (!normalizedTerm.toUpperCase().startsWith('')
        ? await ProdutoModel.searchByCodigoForSite(empresaId, `${normalizedTerm}`)
        : null);
    if (exactCodeMatch) {
      return {
        match_exato_codigo: true,
        id_produto: exactCodeMatch.id_produto,
        codigo: exactCodeMatch.codigo,
      };
    }

    let { items, total } = await ProdutoModel.searchForSite(
      empresaId,
      normalizedTerm,
      page,
      limit
    );

    if (total === 0) {
      const codeSearchResult = await ProdutoModel.searchByCodigoLikeForSite(
        empresaId,
        normalizedTerm,
        page,
        limit
      );

      items = codeSearchResult.items;
      total = codeSearchResult.total;
    }

    const itemsWithImages = await this.attachImages(items);

    return {
      match_exato_codigo: false,
      items: itemsWithImages,
      total,
      page,
      limit,
    };
  }

  static async updateProduto(
    empresaId: number,
    produtoId: number,
    data: UpdateProdutoDTO
  ): Promise<Produto> {
    const produto = await ProdutoModel.findById(empresaId, produtoId);

    if (!produto) {
      throwError('PRODUTO_NOT_FOUND', 'Produto não encontrado', 404);
    }

    if (data.codigo && data.codigo !== produto?.codigo) {
      const existente = await ProdutoModel.searchByCodigo(
        empresaId,
        data.codigo
      );
      if (existente) {
        throwError('DUPLICATE_CODIGO', 'Código de produto já existe', 409);
      }
    }

    await ProdutoModel.update(empresaId, produtoId, data);
    const updated = await ProdutoModel.findById(empresaId, produtoId);

    if (!updated) {
      throwError('UPDATE_FAILED', 'Falha ao atualizar produto', 500);
    }

    return updated as Produto;
  }

  static async deleteProduto(
    empresaId: number,
    produtoId: number
  ): Promise<void> {
    const produto = await ProdutoModel.findById(empresaId, produtoId);

    if (!produto) {
      throwError('PRODUTO_NOT_FOUND', 'Produto não encontrado', 404);
    }

    const success = await ProdutoModel.delete(empresaId, produtoId);

    if (!success) {
      throwError('DELETE_FAILED', 'Falha ao deletar produto', 500);
    }
  }

  static async getProdutoLinks(empresaId: number, produtoId: number) {
    const produto = await ProdutoModel.findById(empresaId, produtoId);

    if (!produto) {
      throwError('PRODUTO_NOT_FOUND', 'Produto nÃ£o encontrado', 404);
    }

    return ProdutoModel.findProductLinks(produtoId);
  }
}
