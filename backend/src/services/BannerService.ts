import { BannerModel } from '@models/Banner';
import type { Banner, BannersByTipo, CreateBannerDTO, UpdateBannerDTO } from '@/types/banner';
import { throwError } from '@utils/helpers';

const knownTipos = ['home_mega', 'home_grande', 'banner_medio', 'mega_banner'];

function groupByTipo(items: Banner[]): BannersByTipo {
  const grouped = knownTipos.reduce<BannersByTipo>((acc, tipo) => {
    acc[tipo] = [];
    return acc;
  }, {});

  for (const item of items) {
    const tipo = item.tipo || 'sem_tipo';
    grouped[tipo] = grouped[tipo] || [];
    grouped[tipo].push(item);
  }

  return grouped;
}

export class BannerService {
  static groupByTipo(items: Banner[]): BannersByTipo {
    return groupByTipo(items);
  }

  static async createBanner(empresaId: number, data: CreateBannerDTO): Promise<Banner> {
    if (data.id_banner !== undefined) {
      const existentePorId = await BannerModel.findById(empresaId, data.id_banner);
      if (existentePorId) {
        throwError('DUPLICATE_BANNER_ID', 'Banner com esse ID ja existe', 409);
      }
    }

    const id = await BannerModel.create(empresaId, data);
    const banner = await BannerModel.findById(empresaId, id);

    if (!banner) {
      throwError('CREATE_FAILED', 'Falha ao criar banner', 500);
    }

    return banner as Banner;
  }

  static async getBannerById(empresaId: number, bannerId: number): Promise<Banner> {
    const banner = await BannerModel.findById(empresaId, bannerId);

    if (!banner) {
      throwError('BANNER_NOT_FOUND', 'Banner nao encontrado', 404);
    }

    return banner as Banner;
  }

  static async listBanners(
    empresaId: number,
    page: number = 1,
    limit: number = 50,
    filters: { search?: string; habilitado?: string; tipo?: string } = {}
  ): Promise<{
    items: Banner[];
    grouped: BannersByTipo;
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const { items, total } = await BannerModel.findAll(empresaId, page, limit, filters);

    return {
      items,
      grouped: groupByTipo(items),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  static async listActiveBanners(
    empresaId: number,
    tipo?: string
  ): Promise<{ items: Banner[]; grouped: BannersByTipo; total: number }> {
    const items = await BannerModel.findActiveByTipo(empresaId, tipo);

    return {
      items,
      grouped: groupByTipo(items),
      total: items.length,
    };
  }

  static async updateBanner(
    empresaId: number,
    bannerId: number,
    data: UpdateBannerDTO
  ): Promise<Banner> {
    await this.getBannerById(empresaId, bannerId);
    await BannerModel.update(empresaId, bannerId, data);
    const updated = await BannerModel.findById(empresaId, bannerId);

    if (!updated) {
      throwError('UPDATE_FAILED', 'Falha ao atualizar banner', 500);
    }

    return updated as Banner;
  }

  static async deleteBanner(empresaId: number, bannerId: number): Promise<void> {
    await this.getBannerById(empresaId, bannerId);
    const success = await BannerModel.delete(empresaId, bannerId);

    if (!success) {
      throwError('DELETE_FAILED', 'Falha ao deletar banner', 500);
    }
  }

  static async reorderBanners(empresaId: number, bannerIds: number[]): Promise<Banner[]> {
    const requestedIds = bannerIds.map(Number).filter((id) => Number.isInteger(id) && id > 0);

    if (!requestedIds.length || requestedIds.length !== new Set(requestedIds).size) {
      throwError('INVALID_ORDER', 'Informe uma ordem valida de banners', 400);
    }

    await BannerModel.reorder(empresaId, requestedIds);
    const { items } = await BannerModel.findAll(empresaId, 1, 500);
    return items;
  }
}
