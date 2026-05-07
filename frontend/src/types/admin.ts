export type FieldType = "text" | "number" | "email" | "date" | "select" | "textarea";

export type ResourceField = {
  name: string;
  label: string;
  type?: FieldType;
  required?: boolean;
  readonly?: boolean;
  options?: { label: string; value: string }[];
};

export type ResourceConfig = {
  title: string;
  description: string;
  endpoint: string;
  idField: string;
  searchPlaceholder: string;
  columns: ResourceField[];
  formFields: ResourceField[];
  defaultValues?: Record<string, string | number>;
  imageManager?: boolean;
};

export type ProdutoRanking = {
  id_produto: number;
  codigo: string | null;
  produto: string | null;
  total_qtde: number;
  total_registros: number;
};

export type EstatisticasResumo = {
  mais_orcados: ProdutoRanking[];
  melhores_do_dia: ProdutoRanking[];
  melhores_do_mes: ProdutoRanking[];
  melhores_do_ano: ProdutoRanking[];
};
