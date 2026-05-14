export type HabilitadoFlag = 'S' | 'N';

export interface Categoria {
  id_empresa: number;
  id_categoria: number;
  categoria: string;
  descricao: string | null;
  icon: string | null;
  habilitado: HabilitadoFlag;
  url_capa: string | null;
}

export interface Subcategoria {
  id_empresa: number;
  id_categoria: number;
  id_subcategoria: number;
  subcategoria: string;
  descricao: string | null;
  icon: string | null;
  habilitado: HabilitadoFlag;
  ordem: number | null;
}

export interface CategoriaProduto {
  id_empresa: number;
  id_categoria: number;
  id_produto: number;
}

export interface SubcategoriaProduto {
  id_empresa: number;
  id_subcategoria: number;
  id_produto: number;
}

export interface CreateCategoriaDTO {
  id_categoria?: number;
  categoria: string;
  descricao?: string | null;
  icon?: string | null;
  habilitado?: HabilitadoFlag;
  url_capa?: string | null;
}

export type UpdateCategoriaDTO = Partial<CreateCategoriaDTO>;

export interface CreateSubcategoriaDTO {
  id_categoria: number;
  id_subcategoria?: number;
  subcategoria: string;
  descricao?: string | null;
  icon?: string | null;
  habilitado?: HabilitadoFlag;
  ordem?: number | null;
}

export type UpdateSubcategoriaDTO = Partial<CreateSubcategoriaDTO>;

export interface VincularProdutoDTO {
  id_produto: number;
}
