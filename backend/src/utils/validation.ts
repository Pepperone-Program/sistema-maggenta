import Joi from 'joi';

export const productSchema = Joi.object({
  id_tipo_produto: Joi.number().required(),
  produto: Joi.string().max(255).required(),
  descricao: Joi.string().allow(null, ''),
  codigo: Joi.string().max(50).required(),
  id_tipo_gravacao_padrao: Joi.number().allow(null),
  altura: Joi.string().max(20).allow(null, ''),
  largura: Joi.string().max(20).allow(null, ''),
  profundidade: Joi.string().max(20).allow(null, ''),
  peso: Joi.string().max(20).allow(null, ''),
  caixa1: Joi.string().max(20).allow(null, ''),
  caixa2: Joi.string().max(20).allow(null, ''),
  caixa3: Joi.string().max(20).allow(null, ''),
  caixa4: Joi.string().max(20).allow(null, ''),
  caixa5: Joi.string().max(20).allow(null, ''),
  ncm: Joi.string().max(20).allow(null, ''),
  imagem: Joi.string().allow(null, ''),
  data_inicial: Joi.date().allow(null),
  data_final: Joi.date().allow(null),
  obs: Joi.string().allow(null, ''),
  site: Joi.string().valid('S', 'N').allow(null, '').default('N'),
  sugerir_sempre: Joi.string().valid('S', 'N').allow(null, '').default('N'),
  lancamento: Joi.string().valid('S', 'N').allow(null, '').default('N'),
  promocao: Joi.string().valid('S', 'N').allow(null, '').default('N'),
  premium: Joi.string().valid('S', 'N').allow(null, '').default('N'),
  marketplace: Joi.string().valid('S', 'N').allow(null, '').default('N'),
  video: Joi.string().allow(null, ''),
  habilitado: Joi.string().valid('S', 'N').allow(null, '').default('S'),
  cod_forn: Joi.string().max(50).allow(null, ''),
  quantidade_minima: Joi.string().max(20).allow(null, ''),
});

export const orcamentoSchema = Joi.object({
  id_cliente: Joi.string().allow(null),
  data_orcamento: Joi.date().required(),
  fantasia: Joi.string().max(255).required(),
  endereco: Joi.string().max(255).required(),
  endereco_n: Joi.string().max(20).allow(null, ''),
  endereco_compl: Joi.string().max(255).allow(null, ''),
  bairro: Joi.string().max(100).allow(null, ''),
  cep: Joi.string().max(20).allow(null, ''),
  cidade: Joi.string().max(100).required(),
  uf: Joi.string().max(2).required(),
  pais: Joi.string().max(100).allow(null, ''),
  tel: Joi.string().max(20).required(),
  tel2: Joi.string().max(20).allow(null, ''),
  site: Joi.string().allow(null, ''),
  email: Joi.string().email().required(),
  obs: Joi.string().allow(null, ''),
  contato: Joi.string().max(100).required(),
  nivel: Joi.string().allow(null, ''),
  entrega: Joi.string().allow(null, ''),
});

export const orcamentoItemSchema = Joi.object({
  id_orcamento: Joi.number().required(),
  data_orcamento: Joi.date().required(),
  id_produto: Joi.number().required(),
  codigo: Joi.string().max(50).required(),
  produto: Joi.string().max(255).required(),
  produto_cor: Joi.string().allow(null, ''),
  id_tipo_gravacao: Joi.string().allow(null, ''),
  gravacao_cores: Joi.string().required(),
  quantidade: Joi.number().positive().required(),
  preco_unitario: Joi.string().allow(null, ''),
  margem_lucro: Joi.string().allow(null, ''),
  preco_unitario_final: Joi.string().allow(null, ''),
});

export const usuarioSchema = Joi.object({
  usuario: Joi.string().max(100).required(),
  nome: Joi.string().max(100).required(),
  email: Joi.string().email().required(),
  senha: Joi.string().min(6).required(),
  ramal: Joi.string().max(20).allow(null, ''),
  tel: Joi.string().max(20).allow(null, ''),
  cel: Joi.string().max(20).allow(null, ''),
  endereco: Joi.string().max(255).allow(null, ''),
  endereco_n: Joi.string().max(20).allow(null, ''),
  endereco_compl: Joi.string().max(255).allow(null, ''),
  bairro: Joi.string().max(100).allow(null, ''),
  cep: Joi.string().max(20).allow(null, ''),
  cidade: Joi.string().max(100).allow(null, ''),
  uf: Joi.string().max(2).allow(null, ''),
  comissao: Joi.string().allow(null, '').default('0.00'),
  data_inicial: Joi.date().allow(null, ''),
  data_final: Joi.date().allow(null, ''),
  habilitado: Joi.string().valid('S', 'N').allow(null, '').default('S'),
});

export const categoriaSchema = Joi.object({
  id_categoria: Joi.number().integer().min(0).optional(),
  categoria: Joi.string().max(255).required(),
  descricao: Joi.string().allow(null, ''),
  icon: Joi.string().max(255).allow(null, ''),
  habilitado: Joi.string().valid('S', 'N').allow(null, '').default('S'),
  url_capa: Joi.string().allow(null, ''),
});

export const subcategoriaSchema = Joi.object({
  id_categoria: Joi.number().integer().min(0).required(),
  id_subcategoria: Joi.number().integer().min(0).optional(),
  subcategoria: Joi.string().max(255).required(),
  descricao: Joi.string().allow(null, ''),
  icon: Joi.string().max(255).allow(null, ''),
  habilitado: Joi.string().valid('S', 'N').allow(null, '').default('S'),
  ordem: Joi.number().integer().min(0).allow(null).default(0),
});

export const vincularProdutoSchema = Joi.object({
  id_produto: Joi.number().integer().positive().required(),
});

export const grupoPermissaoSchema = Joi.object({
  permissao: Joi.string().trim().min(1).max(100).required(),
});

export const grupoUsuarioSchema = Joi.object({
  id_usuario: Joi.number().integer().positive().required(),
});

export const publicoAlvoSchema = Joi.object({
  id_publico_alvo: Joi.number().integer().positive().optional(),
  publico_alvo: Joi.string().max(255).required(),
  descricao: Joi.string().allow(null, ''),
  ordem: Joi.number().integer().min(0).allow(null).default(0),
  habilitado: Joi.string().valid('S', 'N').allow(null, '').default('S'),
});

export const dataPromocionalSchema = Joi.object({
  id_data_promocional: Joi.number().integer().positive().optional(),
  data_promocional: Joi.string().max(255).required(),
  data: Joi.string().max(20).allow(null, ''),
  descricao: Joi.string().allow(null, ''),
  ordem: Joi.number().integer().min(0).allow(null).default(0),
  habilitado: Joi.string().valid('S', 'N').allow(null, '').default('S'),
});

export const bannerSchema = Joi.object({
  id_banner: Joi.number().integer().positive().optional(),
  tipo: Joi.string()
    .valid('home_mega', 'home_grande', 'banner_medio', 'mega_banner')
    .required(),
  titulo: Joi.string().max(255).allow(null, ''),
  url: Joi.string().max(500).allow(null, ''),
  id_tipo_produto: Joi.number().integer().min(0).allow(null).default(0),
  data_inicial: Joi.date().allow(null, ''),
  data_final: Joi.date().allow(null, ''),
  ordem: Joi.number().integer().min(0).allow(null).default(0),
  habilitado: Joi.string().valid('S', 'N').allow(null, '').default('S'),
  cliques: Joi.number().integer().min(0).allow(null),
  url_banner: Joi.string().max(500).allow(null, ''),
});

export const clienteSchema = Joi.object({
  id_cliente: Joi.number().integer().positive().optional(),
  pessoa: Joi.string().valid('F', 'J').allow(null, '').default('J'),
  cnpj_cpf: Joi.string().max(30).allow(null, ''),
  ie_rg: Joi.string().max(30).allow(null, ''),
  razao_social: Joi.string().max(255).allow(null, ''),
  fantasia: Joi.string().max(255).required(),
  endereco: Joi.string().max(255).allow(null, ''),
  endereco_n: Joi.string().max(20).allow(null, ''),
  endereco_compl: Joi.string().max(255).allow(null, ''),
  bairro: Joi.string().max(100).allow(null, ''),
  cep: Joi.string().max(20).allow(null, ''),
  cidade: Joi.string().max(100).allow(null, ''),
  uf: Joi.string().max(2).allow(null, ''),
  pais: Joi.string().max(100).allow(null, '').default('BRASIL'),
  tel: Joi.string().max(30).allow(null, ''),
  tel2: Joi.string().max(30).allow(null, ''),
  tel3: Joi.string().max(30).allow(null, ''),
  fax: Joi.string().max(30).allow(null, ''),
  site: Joi.string().max(255).allow(null, ''),
  email: Joi.string().email().allow(null, ''),
  logotipo: Joi.string().allow(null, ''),
  obs: Joi.string().allow(null, ''),
  consumidor_final: Joi.string().allow(null, ''),
  cadastro_site: Joi.string().allow(null, ''),
  id_transportadora: Joi.number().integer().min(0).allow(null),
  id_vendedor: Joi.number().integer().min(0).allow(null),
  id_captacao: Joi.number().integer().min(0).allow(null),
  habilitado: Joi.string().valid('S', 'N').allow(null, '').default('S'),
  ultima_venda: Joi.date().allow(null, ''),
});

export const clienteContatoSchema = Joi.object({
  contato_email: Joi.string().email().max(255).required(),
  contato_nome: Joi.string().max(255).allow(null, ''),
  contato_depto: Joi.string().max(100).allow(null, ''),
  contato_cargo: Joi.string().max(100).allow(null, ''),
  contato_tel: Joi.string().max(30).allow(null, ''),
  contato_celular: Joi.string().max(30).allow(null, ''),
  contato_nascimento: Joi.date().allow(null, ''),
  contato_obs: Joi.string().allow(null, ''),
  habilitado: Joi.string().valid('S', 'N').allow(null, '').default('S'),
});

export const loginSchema = Joi.object({
  usuario: Joi.string().max(100).required(),
  senha: Joi.string().required(),
  id_empresa: Joi.number().integer().positive().optional(),
});
