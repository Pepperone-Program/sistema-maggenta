export type HabilitadoFlag = 'S' | 'N';

export interface DataPromocional {
  id_data_promocional: number;
  data_promocional: string;
  data: string | null;
  descricao: string | null;
  ordem: number | null;
  habilitado: HabilitadoFlag;
}

export interface DataPromocionalProduto {
  id_data_promocional: number;
  id_produto: number;
  codigo?: string;
  produto?: string;
  habilitado?: HabilitadoFlag;
  vinculado?: boolean;
}

export interface CreateDataPromocionalDTO {
  id_data_promocional?: number;
  data_promocional: string;
  data?: string | null;
  descricao?: string | null;
  ordem?: number | null;
  habilitado?: HabilitadoFlag;
}

export type UpdateDataPromocionalDTO = Partial<CreateDataPromocionalDTO>;

export interface VincularDataPromocionalProdutoDTO {
  id_produto: number;
}
