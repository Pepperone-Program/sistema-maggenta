import { ProdutoModel } from '@models/Produto';
import { SubcategoriaService } from '@services/CategoriaService';
import type { Produto, CreateProdutoDTO, UpdateProdutoDTO } from '@/types/produto';
import { throwError } from '@utils/helpers';
import ExcelJS from 'exceljs';
import { getConnection } from '@database/connection';
import { SearchDocumentService } from '@search/SearchDocumentService';
import { SEARCH_FLAGS } from '@search/config';

export class ProdutoService {
  static async gerarPlanilhaProdutosSite(empresaId: number): Promise<Buffer> {
    const produtos = await ProdutoModel.findAllForSpreadsheet(empresaId);
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Maggenta Admin';
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet('Produtos do site', {
      views: [{ state: 'frozen', ySplit: 1 }],
    });
    worksheet.columns = [
      { header: 'Código do Produto', key: 'codigo', width: 22 },
      { header: 'Produto', key: 'produto', width: 45 },
      { header: 'Descrição do Produto', key: 'descricao', width: 70 },
      { header: 'Valor Aproximado', key: 'valor_aproximado', width: 20 },
      { header: 'Cor', key: 'cor', width: 20 },
      { header: 'Quantidade Mínima', key: 'quantidade_minima', width: 20 },
      { header: 'URL da Imagem', key: 'url_imagem', width: 85 },
    ];

    for (const produto of produtos) {
      worksheet.addRow({
        codigo: produto.codigo || '',
        produto: produto.produto || '',
        descricao: produto.descricao || '',
        valor_aproximado: '',
        cor: '',
        quantidade_minima: produto.quantidade_minima || '',
        url_imagem: produto.url_imagem || '',
      });
    }

    const header = worksheet.getRow(1);
    header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF7C3AED' } };
    header.alignment = { vertical: 'middle' };
    header.height = 24;
    worksheet.autoFilter = { from: 'A1', to: 'G1' };
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber > 1) row.alignment = { vertical: 'top', wrapText: true };
    });

    const data = await workbook.xlsx.writeBuffer();
    return Buffer.from(data);
  }

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

    let id: number;
    let produto: Produto | null;
    if (SEARCH_FLAGS.writeSyncEnabled) {
      const connection = await getConnection();
      try {
        await connection.beginTransaction();
        id = await ProdutoModel.create(empresaId, data, connection);
        await SearchDocumentService.refreshProduct(empresaId, id, connection);
        produto = await ProdutoModel.findById(empresaId, id, connection);
        await connection.commit();
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    } else {
      id = await ProdutoModel.create(empresaId, data);
      produto = await ProdutoModel.findById(empresaId, id);
    }

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
    site?: string,
    categoriaId?: number,
    tipoProdutoId?: number,
    subcategoriaId?: number,
    order: 'ASC' | 'DESC' = 'DESC'
  ): Promise<{ items: Produto[]; total: number; page: number; limit: number }> {
    const { items, total } = await ProdutoModel.findAll(
      empresaId,
      page,
      limit,
      search,
      habilitado,
      site,
      categoriaId,
      tipoProdutoId,
      subcategoriaId,
      order
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

    let updated: Produto | null;
    if (SEARCH_FLAGS.writeSyncEnabled) {
      const connection = await getConnection();
      try {
        await connection.beginTransaction();
        await ProdutoModel.update(empresaId, produtoId, data, connection);
        await SearchDocumentService.refreshProduct(empresaId, produtoId, connection);
        updated = await ProdutoModel.findById(empresaId, produtoId, connection);
        await connection.commit();
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    } else {
      await ProdutoModel.update(empresaId, produtoId, data);
      updated = await ProdutoModel.findById(empresaId, produtoId);
    }

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

    let success: boolean;
    if (SEARCH_FLAGS.writeSyncEnabled) {
      const connection = await getConnection();
      try {
        await connection.beginTransaction();
        await SearchDocumentService.removeProduct(empresaId, produtoId, connection);
        success = await ProdutoModel.delete(empresaId, produtoId, connection);
        await connection.commit();
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    } else {
      success = await ProdutoModel.delete(empresaId, produtoId);
    }

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

  static async listSubcategoriasVinculadas(empresaId: number, produtoId: number) {
    const produto = await ProdutoModel.findById(empresaId, produtoId);

    if (!produto) {
      throwError('PRODUTO_NOT_FOUND', 'Produto nao encontrado', 404);
    }

    return ProdutoModel.findSubcategoryOptionsForProduct(empresaId, produtoId);
  }

  static async vincularSubcategoria(
    empresaId: number,
    produtoId: number,
    subcategoriaId: number
  ) {
    const produto = await ProdutoModel.findById(empresaId, produtoId);

    if (!produto) {
      throwError('PRODUTO_NOT_FOUND', 'Produto nao encontrado', 404);
    }

    return SubcategoriaService.vincularProduto(empresaId, subcategoriaId, {
      id_produto: produtoId,
    });
  }

  static async desvincularSubcategoria(
    empresaId: number,
    produtoId: number,
    subcategoriaId: number
  ): Promise<void> {
    const produto = await ProdutoModel.findById(empresaId, produtoId);

    if (!produto) {
      throwError('PRODUTO_NOT_FOUND', 'Produto nao encontrado', 404);
    }

    await SubcategoriaService.desvincularProduto(empresaId, subcategoriaId, produtoId);
  }

  static async desvincularSubcategoriaDireta(
    empresaId: number,
    produtoId: number,
    subcategoriaId: number
  ): Promise<void> {
    const success = await ProdutoModel.removeSubcategoryLink(
      empresaId,
      produtoId,
      subcategoriaId
    );

    if (!success) {
      throwError(
        'VINCULO_NOT_FOUND',
        'Vinculo entre subcategoria e produto nao encontrado',
        404
      );
    }
  }
}
