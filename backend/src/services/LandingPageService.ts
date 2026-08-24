import { LandingPageModel } from '@models/LandingPage';
import type {
  CreateLandingPageDTO,
  LandingPage,
  UpdateLandingPageDTO,
} from '@/types/landing-page';
import { throwError } from '@utils/helpers';

export class LandingPageService {
  static async create(data: CreateLandingPageDTO): Promise<LandingPage> {
    const id = await LandingPageModel.create(data);
    const item = await LandingPageModel.findById(id);
    if (!item) throwError('CREATE_FAILED', 'Falha ao criar landing page', 500);
    return item as LandingPage;
  }

  static async getById(id: number): Promise<LandingPage> {
    const item = await LandingPageModel.findById(id);
    if (!item) throwError('LANDING_PAGE_NOT_FOUND', 'Landing page nao encontrada', 404);
    return item as LandingPage;
  }

  static async list(page: number, limit: number, search?: string) {
    const result = await LandingPageModel.findAll(page, limit, search);
    return {
      ...result,
      page,
      limit,
      totalPages: Math.ceil(result.total / limit),
    };
  }

  static async update(id: number, data: UpdateLandingPageDTO): Promise<LandingPage> {
    await this.getById(id);
    await LandingPageModel.update(id, data);
    return this.getById(id);
  }

  static async delete(id: number): Promise<void> {
    await this.getById(id);
    if (!(await LandingPageModel.delete(id))) {
      throwError('DELETE_FAILED', 'Falha ao excluir landing page', 500);
    }
  }
}
