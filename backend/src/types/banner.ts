export type HabilitadoFlag = 'S' | 'N';

export type BannerTipo = 'home_mega' | 'home_grande' | 'banner_medio' | 'mega_banner';

export interface Banner {
  id_empresa: number;
  id_banner: number;
  tipo: BannerTipo | string;
  titulo: string | null;
  url: string | null;
  id_tipo_produto: number | null;
  data_inicial: string | Date | null;
  data_final: string | Date | null;
  ordem: number | null;
  habilitado: HabilitadoFlag;
  cliques: number | null;
  url_banner: string | null;
  tamanho_tela: string | null;
}

export type BannersByTipo = Record<string, Banner[]>;

export interface CreateBannerDTO {
  id_banner?: number;
  tipo: BannerTipo;
  titulo?: string | null;
  url?: string | null;
  id_tipo_produto?: number | null;
  data_inicial?: string | null;
  data_final?: string | null;
  ordem?: number | null;
  habilitado?: HabilitadoFlag;
  cliques?: number | null;
  url_banner?: string | null;
  tamanho_tela?: string | null;
}

export type UpdateBannerDTO = Partial<CreateBannerDTO>;
