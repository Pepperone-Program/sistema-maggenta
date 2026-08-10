export type HabilitadoFlag = 'S' | 'N';

export interface PublicoAlvo {
  id_publico_alvo: number;
  publico_alvo: string;
  descricao: string | null;
  ordem: number | null;
  habilitado: HabilitadoFlag;
}

export interface PublicoAlvoProduto {
  id_publico_alvo: number;
  id_produto: number;
  codigo?: string;
  produto?: string;
  habilitado?: HabilitadoFlag;
  vinculado?: boolean;
}

export interface CreatePublicoAlvoDTO {
  id_publico_alvo?: number;
  publico_alvo: string;
  descricao?: string | null;
  ordem?: number | null;
  habilitado?: HabilitadoFlag;
}

export type UpdatePublicoAlvoDTO = Partial<CreatePublicoAlvoDTO>;

export interface VincularPublicoAlvoProdutoDTO {
  id_produto: number;
}
