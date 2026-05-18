import { CategoriaModel } from '@models/Categoria';
import { ProdutoModel } from '@models/Produto';
import { TipoProdutoModel } from '@models/TipoProduto';
import type { Produto, CreateProdutoDTO, UpdateProdutoDTO } from '@/types/produto';
import { throwError } from '@utils/helpers';

type SearchDestination =
  | {
      tipo: 'categoria';
      id_categoria: number;
      categoria: string;
      posicao_palavra: number;
      url_sugerida: string;
    }
  | {
      tipo: 'tipo_produto';
      id_tipo_produto: number;
      tipo_produto: string;
      posicao_palavra: number;
      url_sugerida: string;
    }
  | null;

type SiteSearchResult = {
  items: Produto[];
  total: number;
  page: number;
  limit: number;
  destino_busca: SearchDestination;
  busca: {
    termo: string;
    regra: string;
  };
};

const normalizeText = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const wordPosition = (label: string, term: string): number => {
  const normalizedTerm = normalizeText(term);
  const words = normalizeText(label)
    .split(/[^a-z0-9]+/i)
    .filter(Boolean);

  const index = words.findIndex(
    (word) => word === normalizedTerm || word.startsWith(normalizedTerm)
  );

  return index >= 0 ? index + 1 : Number.MAX_SAFE_INTEGER;
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

    const [produtoComImagens] = await this.attachImages([produto as Produto]);
    const [produtoComCategorias] = await this.attachCategories(empresaId, [produtoComImagens]);
    return produtoComCategorias;
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
    const [produtoComCategorias] = await this.attachCategories(empresaId, [produtoComImagens]);
    return produtoComCategorias;
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
  ): Promise<SiteSearchResult> {
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
    const [itemsWithImages, destinoBusca] = await Promise.all([
      this.attachImages(items),
      this.findSearchDestination(empresaId, normalizedTerm),
    ]);

    return {
      items: itemsWithImages,
      total,
      page,
      limit,
      destino_busca: destinoBusca,
      busca: {
        termo: normalizedTerm,
        regra:
          'A busca de produtos continua igual. Para Enter sem selecionar sugestao, use destino_busca: primeiro categoria com o termo em qualquer palavra; se nao achar, tipo_produto.',
      },
    };
  }

  private static async findSearchDestination(
    empresaId: number,
    term: string
  ): Promise<SearchDestination> {
    const categorias = await CategoriaModel.findSearchCandidates(empresaId, term);
    const categoriaMatches = categorias
      .map((categoria) => ({
        categoria,
        posicao: wordPosition(categoria.categoria, term),
      }))
      .filter((item) => item.posicao !== Number.MAX_SAFE_INTEGER)
      .sort((a, b) => a.posicao - b.posicao || a.categoria.categoria.localeCompare(b.categoria.categoria));

    const categoriaMatch = categoriaMatches[0];
    if (categoriaMatch) {
      return {
        tipo: 'categoria',
        id_categoria: categoriaMatch.categoria.id_categoria,
        categoria: categoriaMatch.categoria.categoria,
        posicao_palavra: categoriaMatch.posicao,
        url_sugerida: `/categorias/${categoriaMatch.categoria.id_categoria}`,
      };
    }

    const tiposProdutos = await TipoProdutoModel.findSearchCandidates(empresaId, term);
    const tipoMatches = tiposProdutos
      .map((tipoProduto) => ({
        tipoProduto,
        posicao: wordPosition(String(tipoProduto.tipo_produto || ''), term),
      }))
      .filter((item) => item.posicao !== Number.MAX_SAFE_INTEGER)
      .sort((a, b) =>
        a.posicao - b.posicao ||
        String(a.tipoProduto.tipo_produto).localeCompare(String(b.tipoProduto.tipo_produto))
      );

    const tipoMatch = tipoMatches[0];
    if (!tipoMatch) {
      return null;
    }

    return {
      tipo: 'tipo_produto',
      id_tipo_produto: Number(tipoMatch.tipoProduto.id_tipo_produto),
      tipo_produto: String(tipoMatch.tipoProduto.tipo_produto),
      posicao_palavra: tipoMatch.posicao,
      url_sugerida: `/tipos-produtos/${tipoMatch.tipoProduto.id_tipo_produto}`,
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
    const [produtoComCategorias] = await this.attachCategories(empresaId, [produtoComImagens]);
    return produtoComCategorias;
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
