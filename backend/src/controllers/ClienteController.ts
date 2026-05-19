import { Response } from 'express';
import { AuthenticatedRequest } from '@middleware/auth';
import { ClienteService } from '@services/ClienteService';
import { errorResponse, paginatedResponse, successResponse } from '@utils/response';

const getEmpresaId = (req: AuthenticatedRequest): number => req.user?.id_empresa || 1;
const getPage = (req: AuthenticatedRequest): number =>
  parseInt((req.query.page as string) || '1', 10);
const getLimit = (req: AuthenticatedRequest): number =>
  parseInt((req.query.limit as string) || '100', 10);

export class ClienteController {
  static async create(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const cliente = await ClienteService.createCliente(getEmpresaId(req), req.body);
      successResponse(res, cliente, 'Cliente criado com sucesso', 201);
    } catch (error) {
      const err = error as any;
      errorResponse(res, err.code || 'ERROR', err.message, err.statusCode || 500);
    }
  }

  static async getById(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const cliente = await ClienteService.getClienteById(
        getEmpresaId(req),
        parseInt(req.params.id, 10)
      );
      successResponse(res, cliente);
    } catch (error) {
      const err = error as any;
      errorResponse(res, err.code || 'ERROR', err.message, err.statusCode || 500);
    }
  }

  static async list(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const result = await ClienteService.listClientes(
        getEmpresaId(req),
        getPage(req),
        getLimit(req),
        req.query.search as string | undefined,
        req.query.habilitado as string | undefined
      );
      paginatedResponse(
        res,
        result.items,
        result.total,
        result.page,
        result.limit,
        'Clientes listados com sucesso'
      );
    } catch (error) {
      const err = error as any;
      errorResponse(res, err.code || 'ERROR', err.message, err.statusCode || 500);
    }
  }

  static async update(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const cliente = await ClienteService.updateCliente(
        getEmpresaId(req),
        parseInt(req.params.id, 10),
        req.body
      );
      successResponse(res, cliente, 'Cliente atualizado com sucesso');
    } catch (error) {
      const err = error as any;
      errorResponse(res, err.code || 'ERROR', err.message, err.statusCode || 500);
    }
  }

  static async delete(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      await ClienteService.deleteCliente(getEmpresaId(req), parseInt(req.params.id, 10));
      successResponse(res, null, 'Cliente deletado com sucesso');
    } catch (error) {
      const err = error as any;
      errorResponse(res, err.code || 'ERROR', err.message, err.statusCode || 500);
    }
  }

  static async createContato(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const contato = await ClienteService.createContato(
        getEmpresaId(req),
        parseInt(req.params.id, 10),
        req.body
      );
      successResponse(res, contato, 'Contato do cliente criado com sucesso', 201);
    } catch (error) {
      const err = error as any;
      errorResponse(res, err.code || 'ERROR', err.message, err.statusCode || 500);
    }
  }

  static async getContato(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const contato = await ClienteService.getContatoByEmail(
        getEmpresaId(req),
        parseInt(req.params.id, 10),
        decodeURIComponent(req.params.email)
      );
      successResponse(res, contato);
    } catch (error) {
      const err = error as any;
      errorResponse(res, err.code || 'ERROR', err.message, err.statusCode || 500);
    }
  }

  static async listContatos(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const result = await ClienteService.listContatos(
        getEmpresaId(req),
        parseInt(req.params.id, 10),
        getPage(req),
        getLimit(req),
        req.query.search as string | undefined,
        req.query.habilitado as string | undefined
      );
      paginatedResponse(
        res,
        result.items,
        result.total,
        result.page,
        result.limit,
        'Contatos do cliente listados com sucesso'
      );
    } catch (error) {
      const err = error as any;
      errorResponse(res, err.code || 'ERROR', err.message, err.statusCode || 500);
    }
  }

  static async listOrcamentos(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const result = await ClienteService.listOrcamentos(
        getEmpresaId(req),
        parseInt(req.params.id, 10),
        getPage(req),
        getLimit(req)
      );
      paginatedResponse(
        res,
        result.items,
        result.total,
        result.page,
        result.limit,
        'Orcamentos do cliente listados com sucesso'
      );
    } catch (error) {
      const err = error as any;
      errorResponse(res, err.code || 'ERROR', err.message, err.statusCode || 500);
    }
  }

  static async updateContato(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const contato = await ClienteService.updateContato(
        getEmpresaId(req),
        parseInt(req.params.id, 10),
        decodeURIComponent(req.params.email),
        req.body
      );
      successResponse(res, contato, 'Contato do cliente atualizado com sucesso');
    } catch (error) {
      const err = error as any;
      errorResponse(res, err.code || 'ERROR', err.message, err.statusCode || 500);
    }
  }

  static async deleteContato(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      await ClienteService.deleteContato(
        getEmpresaId(req),
        parseInt(req.params.id, 10),
        decodeURIComponent(req.params.email)
      );
      successResponse(res, null, 'Contato do cliente deletado com sucesso');
    } catch (error) {
      const err = error as any;
      errorResponse(res, err.code || 'ERROR', err.message, err.statusCode || 500);
    }
  }
}
