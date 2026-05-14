export interface Produto {
  id_empresa: number;
  id_produto: number;
  id_tipo_produto: number;
  produto: string;
  descricao: string;
  codigo: string;
  id_tipo_gravacao_padrao: number;
  altura: string;
  largura: string;
  profundidade: string;
  peso: string;
  caixa1: string;
  caixa2: string;
  caixa3: string;
  caixa4: string;
  caixa5: string;
  ncm: string;
  imagem: string | null;
  data_inclusao: string;
  data_inicial: string;
  data_final: string;
  data_modificacao: string;
  obs: string;
  site: string;
  sugerir_sempre: string;
  lancamento: string;
  promocao: string;
  premium: string;
  marketplace: string;
  video: string;
  habilitado: string;
  cod_forn: string | null;
  quantidade_minima: string | null;
  imagens?: ProdutoImagem[];
}

export interface ProdutoImagem {
  id_imagem: number;
  id_produto: number;
  url_imagem: string;
  ordem_imagem: number;
  created_at: string;
}

export interface CreateProdutoDTO {
  id_tipo_produto: number;
  produto: string;
  descricao: string;
  codigo: string;
  id_tipo_gravacao_padrao?: number;
  altura?: string;
  largura?: string;
  profundidade?: string;
  peso?: string;
  caixa1?: string;
  caixa2?: string;
  caixa3?: string;
  caixa4?: string;
  caixa5?: string;
  ncm?: string;
  imagem?: string;
  data_inicial?: string;
  data_final?: string;
  obs?: string;
  site?: string;
  sugerir_sempre?: string;
  lancamento?: string;
  promocao?: string;
  premium?: string;
  marketplace?: string;
  video?: string;
  habilitado?: string;
  cod_forn?: string;
  quantidade_minima?: string;
}

export type UpdateProdutoDTO = Partial<CreateProdutoDTO>;
