import { Response } from 'express';
import { AuthenticatedRequest } from '@middleware/auth';
import { ContatoService } from '@services/ContatoService';
import { errorResponse, successResponse } from '@utils/response';

export class ContatoController {
  static async enviar(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const result = await ContatoService.enviarMensagem(req.body);
      successResponse(res, result, 'Mensagem enviada com sucesso', 201);
    } catch (error) {
      const err = error as any;
      errorResponse(res, err.code || 'ERROR', err.message, err.statusCode || 500);
    }
  }
}
