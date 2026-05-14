import { CategoriaModel, SubcategoriaModel } from '@models/Categoria';
import { uploadToSupabaseStorage } from '@services/SupabaseStorageService';
import type {
  Categoria,
  CategoriaProduto,
  CreateCategoriaDTO,
  CreateSubcategoriaDTO,
  Subcategoria,
  SubcategoriaProduto,
  UpdateCategoriaDTO,
  UpdateSubcategoriaDTO,
  VincularProdutoDTO,
} from '@/types/categoria';
import { throwError } from '@utils/helpers';
import sharp from 'sharp';

export class CategoriaService {
  static async createCategoria(
    empresaId: number,
    data: CreateCategoriaDTO
  ): Promise<Categoria> {
    if (data.id_categoria !== undefined) {
      const existentePorId = await CategoriaModel.findById(empresaId, data.id_categoria);
      if (existentePorId) {
        throwError('DUPLICATE_CATEGORIA_ID', 'Categoria com esse ID ja existe', 409);
      }
    }

    const existente = await CategoriaModel.findByName(empresaId, data.categoria);
    if (existente) {
      throwError('DUPLICATE_CATEGORIA', 'Categoria ja existe', 409);
    }

    const id = await CategoriaModel.create(empresaId, data);
    const categoria = await CategoriaModel.findById(empresaId, id);

    if (!categoria) {
      throwError('CREATE_FAILED', 'Falha ao criar categoria', 500);
    }

    return categoria as Categoria;
  }

  static async getCategoriaById(
    empresaId: number,
    categoriaId: number
  ): Promise<Categoria> {
    const categoria = await CategoriaModel.findById(empresaId, categoriaId);

    if (!categoria) {
      throwError('CATEGORIA_NOT_FOUND', 'Categoria nao encontrada', 404);
    }

    return categoria as Categoria;
  }

  static async listCategorias(
    empresaId: number,
    page: number = 1,
    limit: number = 10,
    search?: string,
    habilitado?: string
  ): Promise<{ items: Categoria[]; total: number; page: number; limit: number }> {
    const { items, total } = await CategoriaModel.findAll(
      empresaId,
      page,
      limit,
      search,
      habilitado
    );

    return { items, total, page, limit };
  }

  static async updateCategoria(
    empresaId: number,
    categoriaId: number,
    data: UpdateCategoriaDTO
  ): Promise<Categoria> {
    const categoria = await this.getCategoriaById(empresaId, categoriaId);

    if (data.categoria && data.categoria !== categoria.categoria) {
      const existente = await CategoriaModel.findByName(empresaId, data.categoria);
      if (existente && existente.id_categoria !== categoriaId) {
        throwError('DUPLICATE_CATEGORIA', 'Categoria ja existe', 409);
      }
    }

    await CategoriaModel.update(empresaId, categoriaId, data);
    const updated = await CategoriaModel.findById(empresaId, categoriaId);

    if (!updated) {
      throwError('UPDATE_FAILED', 'Falha ao atualizar categoria', 500);
    }

    return updated as Categoria;
  }

  static async deleteCategoria(empresaId: number, categoriaId: number): Promise<void> {
    await this.getCategoriaById(empresaId, categoriaId);

    if (await CategoriaModel.hasSubcategorias(empresaId, categoriaId)) {
      throwError(
        'CATEGORIA_HAS_SUBCATEGORIAS',
        'Categoria possui subcategorias vinculadas',
        409
      );
    }

    if (await CategoriaModel.hasProdutos(empresaId, categoriaId)) {
      throwError('CATEGORIA_HAS_PRODUTOS', 'Categoria possui produtos vinculados', 409);
    }

    const success = await CategoriaModel.delete(empresaId, categoriaId);
    if (!success) {
      throwError('DELETE_FAILED', 'Falha ao deletar categoria', 500);
    }
  }

  static async vincularProduto(
    empresaId: number,
    categoriaId: number,
    data: VincularProdutoDTO
  ): Promise<CategoriaProduto> {
    await this.getCategoriaById(empresaId, categoriaId);

    if (!(await CategoriaModel.produtoExists(empresaId, data.id_produto))) {
      throwError('PRODUTO_NOT_FOUND', 'Produto nao encontrado', 404);
    }

    const existente = await CategoriaModel.findProdutoLink(
      empresaId,
      categoriaId,
      data.id_produto
    );

    if (existente) {
      return existente;
    }

    return CategoriaModel.addProduto(empresaId, categoriaId, data.id_produto);
  }

  static async desvincularProduto(
    empresaId: number,
    categoriaId: number,
    produtoId: number
  ): Promise<void> {
    await this.getCategoriaById(empresaId, categoriaId);
    const success = await CategoriaModel.removeProduto(empresaId, categoriaId, produtoId);

    if (!success) {
      throwError('VINCULO_NOT_FOUND', 'Vinculo entre categoria e produto nao encontrado', 404);
    }
  }

  static async listProdutos(
    empresaId: number,
    categoriaId: number,
    page: number = 1,
    limit: number = 10
  ): Promise<{ items: CategoriaProduto[]; total: number; page: number; limit: number }> {
    await this.getCategoriaById(empresaId, categoriaId);
    const { items, total } = await CategoriaModel.findProdutos(
      empresaId,
      categoriaId,
      page,
      limit
    );

    return { items, total, page, limit };
  }

  static async uploadCapa(
    empresaId: number,
    categoriaId: number,
    file: Express.Multer.File
  ): Promise<Categoria> {
    await this.getCategoriaById(empresaId, categoriaId);
    if (!file) {
      throwError('NO_IMAGE', 'Envie uma imagem para a categoria', 400);
    }

    const buffer = await sharp(file.buffer)
      .rotate()
      .resize({ width: 1800, withoutEnlargement: true })
      .jpeg({ quality: 90, mozjpeg: true })
      .toBuffer();
    const bucket = process.env.CATEGORIA_IMAGES_SUPABASE_BUCKET || 'imagem_empresa';
    const publicUrl = await uploadToSupabaseStorage({
      bucket,
      key: `categorias/${categoriaId}-${Date.now()}.jpg`,
      body: buffer,
      contentType: 'image/jpeg',
    });

    return this.updateCategoria(empresaId, categoriaId, { url_capa: publicUrl });
  }

  static async getCatalogoCategoria(
    empresaId: number,
    categoriaId: number,
    query: {
      page?: number | string;
      limit?: number | string;
      subcategorias?: string;
      publicos_alvos?: string;
      quantidade_minima_min?: string;
      quantidade_minima_max?: string;
    }
  ) {
    const categoria = await this.getCategoriaById(empresaId, categoriaId);
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

    const produtos = await CategoriaModel.findCatalogProducts(empresaId, categoriaId, {
      page: Number(query.page || 1),
      limit: Number(query.limit || 100),
      subcategorias: parseIds(query.subcategorias),
      publicosAlvos: parseIds(query.publicos_alvos),
      quantidadeMinimaMin: toNumber(query.quantidade_minima_min),
      quantidadeMinimaMax: toNumber(query.quantidade_minima_max),
    });
    const filtros = await CategoriaModel.findCatalogFacets(empresaId, categoriaId);

    return {
      categoria,
      filtros,
      ...produtos,
      totalPages: Math.ceil(produtos.total / produtos.limit),
    };
  }
}

export class SubcategoriaService {
  static async createSubcategoria(
    empresaId: number,
    data: CreateSubcategoriaDTO
  ): Promise<Subcategoria> {
    await CategoriaService.getCategoriaById(empresaId, data.id_categoria);

    if (data.id_subcategoria !== undefined) {
      const existentePorId = await SubcategoriaModel.findById(
        empresaId,
        data.id_subcategoria
      );
      if (existentePorId) {
        throwError('DUPLICATE_SUBCATEGORIA_ID', 'Subcategoria com esse ID ja existe', 409);
      }
    }

    const existente = await SubcategoriaModel.findByName(
      empresaId,
      data.id_categoria,
      data.subcategoria
    );
    if (existente) {
      throwError('DUPLICATE_SUBCATEGORIA', 'Subcategoria ja existe nessa categoria', 409);
    }

    const id = await SubcategoriaModel.create(empresaId, data);
    const subcategoria = await SubcategoriaModel.findById(empresaId, id);

    if (!subcategoria) {
      throwError('CREATE_FAILED', 'Falha ao criar subcategoria', 500);
    }

    return subcategoria as Subcategoria;
  }

  static async getSubcategoriaById(
    empresaId: number,
    subcategoriaId: number
  ): Promise<Subcategoria> {
    const subcategoria = await SubcategoriaModel.findById(empresaId, subcategoriaId);

    if (!subcategoria) {
      throwError('SUBCATEGORIA_NOT_FOUND', 'Subcategoria nao encontrada', 404);
    }

    return subcategoria as Subcategoria;
  }

  static async listSubcategorias(
    empresaId: number,
    page: number = 1,
    limit: number = 10,
    search?: string,
    categoriaId?: number,
    habilitado?: string
  ): Promise<{ items: Subcategoria[]; total: number; page: number; limit: number }> {
    if (categoriaId) {
      await CategoriaService.getCategoriaById(empresaId, categoriaId);
    }

    const { items, total } = await SubcategoriaModel.findAll(
      empresaId,
      page,
      limit,
      search,
      categoriaId,
      habilitado
    );

    return { items, total, page, limit };
  }

  static async updateSubcategoria(
    empresaId: number,
    subcategoriaId: number,
    data: UpdateSubcategoriaDTO
  ): Promise<Subcategoria> {
    const subcategoria = await this.getSubcategoriaById(empresaId, subcategoriaId);
    const categoriaId = data.id_categoria ?? subcategoria.id_categoria;

    if (data.id_categoria !== undefined) {
      await CategoriaService.getCategoriaById(empresaId, data.id_categoria);
    }

    if (data.subcategoria && data.subcategoria !== subcategoria.subcategoria) {
      const existente = await SubcategoriaModel.findByName(
        empresaId,
        categoriaId,
        data.subcategoria
      );
      if (existente && existente.id_subcategoria !== subcategoriaId) {
        throwError(
          'DUPLICATE_SUBCATEGORIA',
          'Subcategoria ja existe nessa categoria',
          409
        );
      }
    }

    await SubcategoriaModel.update(empresaId, subcategoriaId, data);
    const updated = await SubcategoriaModel.findById(empresaId, subcategoriaId);

    if (!updated) {
      throwError('UPDATE_FAILED', 'Falha ao atualizar subcategoria', 500);
    }

    return updated as Subcategoria;
  }

  static async deleteSubcategoria(empresaId: number, subcategoriaId: number): Promise<void> {
    await this.getSubcategoriaById(empresaId, subcategoriaId);

    if (await SubcategoriaModel.hasProdutos(empresaId, subcategoriaId)) {
      throwError(
        'SUBCATEGORIA_HAS_PRODUTOS',
        'Subcategoria possui produtos vinculados',
        409
      );
    }

    const success = await SubcategoriaModel.delete(empresaId, subcategoriaId);
    if (!success) {
      throwError('DELETE_FAILED', 'Falha ao deletar subcategoria', 500);
    }
  }

  static async vincularProduto(
    empresaId: number,
    subcategoriaId: number,
    data: VincularProdutoDTO
  ): Promise<SubcategoriaProduto> {
    await this.getSubcategoriaById(empresaId, subcategoriaId);

    if (!(await CategoriaModel.produtoExists(empresaId, data.id_produto))) {
      throwError('PRODUTO_NOT_FOUND', 'Produto nao encontrado', 404);
    }

    const existente = await SubcategoriaModel.findProdutoLink(
      empresaId,
      subcategoriaId,
      data.id_produto
    );

    if (existente) {
      return existente;
    }

    return SubcategoriaModel.addProduto(empresaId, subcategoriaId, data.id_produto);
  }

  static async desvincularProduto(
    empresaId: number,
    subcategoriaId: number,
    produtoId: number
  ): Promise<void> {
    await this.getSubcategoriaById(empresaId, subcategoriaId);
    const success = await SubcategoriaModel.removeProduto(
      empresaId,
      subcategoriaId,
      produtoId
    );

    if (!success) {
      throwError(
        'VINCULO_NOT_FOUND',
        'Vinculo entre subcategoria e produto nao encontrado',
        404
      );
    }
  }

  static async listProdutos(
    empresaId: number,
    subcategoriaId: number,
    page: number = 1,
    limit: number = 10
  ): Promise<{ items: SubcategoriaProduto[]; total: number; page: number; limit: number }> {
    await this.getSubcategoriaById(empresaId, subcategoriaId);
    const { items, total } = await SubcategoriaModel.findProdutos(
      empresaId,
      subcategoriaId,
      page,
      limit
    );

    return { items, total, page, limit };
  }
}
