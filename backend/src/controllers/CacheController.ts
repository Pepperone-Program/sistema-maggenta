import { Response } from 'express';
import { AuthenticatedRequest } from '@middleware/auth';
import { CacheService } from '@services/CacheService';
import { errorResponse, successResponse } from '@utils/response';

const allowedNamespaces = new Set([
  'categorias',
  'banners',
  'tipos-produtos',
  'datas-promocionais',
  'publicos-alvos',
]);

const normalizeNamespace = (namespace: string): string => namespace.trim().toLowerCase();

export class CacheController {
  static async invalidate(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const rawNamespaces: string[] = Array.isArray(req.body?.namespaces)
        ? req.body.namespaces.map((namespace: unknown) => String(namespace))
        : [req.body?.namespace || req.params.namespace]
            .filter(Boolean)
            .map((namespace: unknown) => String(namespace));

      const namespaces = Array.from(
        new Set(rawNamespaces.map((namespace: string) => normalizeNamespace(namespace)))
      );

      if (namespaces.length === 0) {
        errorResponse(
          res,
          'CACHE_NAMESPACE_REQUIRED',
          'Informe namespace ou namespaces para invalidar',
          400
        );
        return;
      }

      const invalidNamespaces = namespaces.filter((namespace) => !allowedNamespaces.has(namespace));
      if (invalidNamespaces.length > 0) {
        errorResponse(
          res,
          'INVALID_CACHE_NAMESPACE',
          `Namespaces invalidos: ${invalidNamespaces.join(', ')}`,
          400,
          { allowed: Array.from(allowedNamespaces) }
        );
        return;
      }

      await Promise.all(namespaces.map((namespace) => CacheService.invalidateNamespace(namespace)));

      successResponse(res, {
        invalidated: namespaces,
        prefix: 'site-pep',
      }, 'Cache invalidado com sucesso');
    } catch (error) {
      const err = error as any;
      errorResponse(res, err.code || 'ERROR', err.message, err.statusCode || 500);
    }
  }

  static async invalidateAll(_req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const namespaces = Array.from(allowedNamespaces);
      await Promise.all(namespaces.map((namespace) => CacheService.invalidateNamespace(namespace)));

      successResponse(res, {
        invalidated: namespaces,
        prefix: 'site-pep',
      }, 'Todos os caches conhecidos foram invalidados com sucesso');
    } catch (error) {
      const err = error as any;
      errorResponse(res, err.code || 'ERROR', err.message, err.statusCode || 500);
    }
  }
}
