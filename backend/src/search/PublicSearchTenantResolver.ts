import type { AuthenticatedRequest } from '@middleware/auth';

const configuredDefaultTenant = (): number => {
  const configured = process.env.SEARCH_PUBLIC_DEFAULT_EMPRESA_ID || process.env.SITE_API_EMPRESA_ID;
  if (!configured && process.env.NODE_ENV === 'production') {
    throw Object.assign(new Error('SEARCH_PUBLIC_DEFAULT_EMPRESA_ID nao configurado'), {
      code: 'PUBLIC_SEARCH_TENANT_NOT_CONFIGURED', statusCode: 503,
    });
  }
  const value = Number(configured || 1);
  if (!Number.isInteger(value) || value <= 0) {
    throw Object.assign(new Error('Tenant publico padrao nao configurado'), {
      code: 'PUBLIC_SEARCH_TENANT_NOT_CONFIGURED',
      statusCode: 503,
    });
  }
  return value;
};

export class PublicSearchTenantResolver {
  static resolve(req: AuthenticatedRequest): number {
    const requested = req.query.empresaId === undefined ? null : Number(req.query.empresaId);
    if (requested !== null && (!Number.isInteger(requested) || requested <= 0)) {
      throw Object.assign(new Error('empresaId invalido'), { code: 'INVALID_TENANT', statusCode: 422 });
    }
    if (req.user) {
      if (requested !== null && requested !== req.user.id_empresa) {
        throw Object.assign(new Error('O tenant informado nao corresponde ao token'), {
          code: 'TENANT_MISMATCH',
          statusCode: 403,
        });
      }
      return req.user.id_empresa;
    }
    const defaultTenant = configuredDefaultTenant();
    if (requested !== null && requested !== defaultTenant) {
      throw Object.assign(new Error('Busca anonima permitida apenas para o tenant publico padrao'), {
        code: 'TENANT_MISMATCH',
        statusCode: 403,
      });
    }
    return defaultTenant;
  }
}
