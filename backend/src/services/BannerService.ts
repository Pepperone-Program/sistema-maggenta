import { BannerModel } from '@models/Banner';
import type { Banner, BannersByTipo, CreateBannerDTO, UpdateBannerDTO } from '@/types/banner';
import { throwError } from '@utils/helpers';
import { uploadToSupabaseStorage } from '@services/SupabaseStorageService';
import crypto from 'crypto';
import path from 'path';

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

  static async createResponsiveBanners(
    empresaId: number,
    data: CreateBannerDTO,
    files: { desktop?: Express.Multer.File[]; mobile?: Express.Multer.File[] }
  ): Promise<Banner[]> {
    const desktopFile = files.desktop?.[0];
    const mobileFile = files.mobile?.[0];

    if (!desktopFile || !mobileFile) {
      throwError('BANNER_IMAGES_REQUIRED', 'Envie as imagens desktop e mobile', 400);
    }

    const bucket = process.env.BANNER_IMAGES_SUPABASE_BUCKET || 'banners-site-pepperone';
    const upload = async (file: Express.Multer.File, tamanhoTela: 'desktop' | 'mobile') => {
      const extension = path.extname(file.originalname || '').toLowerCase() || '.jpg';
      const key = `admin/${new Date().getFullYear()}/${Date.now()}-${crypto.randomUUID()}-${tamanhoTela}${extension}`;
      return uploadToSupabaseStorage({
        bucket,
        key,
        body: file.buffer,
        contentType: file.mimetype || 'application/octet-stream',
      });
    };

    const [desktopUrl, mobileUrl] = await Promise.all([
      upload(desktopFile as Express.Multer.File, 'desktop'),
      upload(mobileFile as Express.Multer.File, 'mobile'),
    ]);

    const [desktopId, mobileId] = await Promise.all([
      BannerModel.create(empresaId, {
        ...data,
        url_banner: desktopUrl,
        tamanho_tela: 'desktop',
      }),
      BannerModel.create(empresaId, {
        ...data,
        url_banner: mobileUrl,
        tamanho_tela: 'mobile',
      }),
    ]);

    const banners = await Promise.all([
      BannerModel.findById(empresaId, desktopId),
      BannerModel.findById(empresaId, mobileId),
    ]);

    return banners.filter(Boolean) as Banner[];
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
    limit: number = 100,
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
    tipo?: string,
    page: number = 1,
    limit: number = 100
  ): Promise<{
    items: Banner[];
    grouped: BannersByTipo;
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const { items, total } = await BannerModel.findActiveByTipo(empresaId, tipo, page, limit);

    return {
      items,
      grouped: groupByTipo(items),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
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
