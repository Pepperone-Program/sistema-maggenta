import { Request, Response } from 'express';
import { NewsletterService } from '@services/NewsletterService';
import { errorResponse, successResponse } from '@utils/response';

export class NewsletterController {
  static async create(req: Request, res: Response): Promise<void> {
    try {
      const email = req.body?.email || req.body?.lead_email;
      const lead = await NewsletterService.createLead(email);
      successResponse(res, lead, 'Lead da newsletter cadastrado com sucesso', 201);
    } catch (error) {
      const err = error as any;
      errorResponse(res, err.code || 'ERROR', err.message, err.statusCode || 500);
    }
  }
}
