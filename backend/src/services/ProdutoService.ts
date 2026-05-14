import { ProdutoModel } from '@models/Produto';
import type { Produto, CreateProdutoDTO, UpdateProdutoDTO } from '@/types/produto';
import { throwError } from '@utils/helpers';

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

    const [produtoComImagens] = await this.attachImages([produto as Produto]);
    return produtoComImagens;
  }

  static async getProdutoById(
    empresaId: number,
    produtoId: number
  ): Promise<Produto> {
    const produto = await ProdutoModel.findById(empresaId, produtoId);

    if (!produto) {
      throwError('PRODUTO_NOT_FOUND', 'Produto não encontrado', 404);
    }

    const [produtoComImagens] = await this.attachImages([produto as Produto]);
    return produtoComImagens;
  }

  static async listProdutos(
    empresaId: number,
    page: number = 1,
    limit: number = 10,
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

    return {
      items: itemsWithImages,
      total,
      page,
      limit,
    };
  }

  static async listProdutosSite(
    empresaId: number,
    page: number = 1,
    limit: number = 10,
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
    limit: number = 10
  ): Promise<{ items: Produto[]; total: number; page: number; limit: number }> {
    const normalizedTerm = term.trim();
    if (!normalizedTerm) {
      throwError('INVALID_SEARCH', 'Informe o termo de busca em q', 400);
    }

    const { items, total } = await ProdutoModel.searchForSite(
      empresaId,
      normalizedTerm,
      page,
      limit
    );
    const itemsWithImages = await this.attachImages(items);

    return {
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

    const [produtoComImagens] = await this.attachImages([updated as Produto]);
    return produtoComImagens;
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
