import { Request, Response } from 'express';
import { FreeshopService } from '@services/FreeshopService';
import { errorResponse } from '@utils/response';

export class FreeshopController {
  static async xml(_req: Request, res: Response): Promise<void> {
    try {
      const configuredEmpresaId = Number(process.env.SITE_API_EMPRESA_ID || 1);
      const empresaId = Number.isInteger(configuredEmpresaId) && configuredEmpresaId > 0
        ? configuredEmpresaId
        : 1;
      const xml = await FreeshopService.generateXml(empresaId);

      res.setHeader('Content-Type', 'application/xml; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
      res.status(200).send(xml);
    } catch (error) {
      const err = error as any;
      errorResponse(res, err.code || 'FREESHOP_XML_ERROR', err.message, err.statusCode || 500);
    }
  }
}
