import { EstatisticaProdutoModel } from '@models/EstatisticaProduto';
import type { EstatisticasProdutosResumo, ProdutoRanking } from '@/types/estatistica-produto';
import { throwError } from '@utils/helpers';

const toDateOnly = (date: Date): string => date.toISOString().slice(0, 10);

const addDays = (date: Date, days: number): Date => {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
};

const startOfMonth = (date: Date): Date =>
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));

const startOfNextMonth = (date: Date): Date =>
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1));

const startOfYear = (date: Date): Date => new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
const startOfNextYear = (date: Date): Date =>
  new Date(Date.UTC(date.getUTCFullYear() + 1, 0, 1));

export class EstatisticaProdutoService {
  static async ranking(
    empresaId: number,
    limit: number = 100,
    startDate?: string,
    endDate?: string
  ): Promise<ProdutoRanking[]> {
    if (startDate && endDate && startDate >= endDate) {
      throwError('INVALID_DATE_RANGE', 'Data inicial deve ser menor que a data final', 422);
    }

    return EstatisticaProdutoModel.ranking(empresaId, limit, startDate, endDate);
  }

  static async melhoresDoDia(
    empresaId: number,
    limit: number = 100,
    date: string = toDateOnly(new Date())
  ): Promise<ProdutoRanking[]> {
    const start = new Date(`${date}T00:00:00.000Z`);
    return this.ranking(empresaId, limit, toDateOnly(start), toDateOnly(addDays(start, 1)));
  }

  static async melhoresDoMes(
    empresaId: number,
    limit: number = 100,
    date: string = toDateOnly(new Date())
  ): Promise<ProdutoRanking[]> {
    const target = new Date(`${date}T00:00:00.000Z`);
    return this.ranking(
      empresaId,
      limit,
      toDateOnly(startOfMonth(target)),
      toDateOnly(startOfNextMonth(target))
    );
  }

  static async melhoresDoAno(
    empresaId: number,
    limit: number = 100,
    date: string = toDateOnly(new Date())
  ): Promise<ProdutoRanking[]> {
    const target = new Date(`${date}T00:00:00.000Z`);
    return this.ranking(
      empresaId,
      limit,
      toDateOnly(startOfYear(target)),
      toDateOnly(startOfNextYear(target))
    );
  }

  static async resumo(
    empresaId: number,
    limit: number = 100,
    date: string = toDateOnly(new Date())
  ): Promise<EstatisticasProdutosResumo> {
    const [maisOrcados, melhoresDoDia, melhoresDoMes, melhoresDoAno] = await Promise.all([
      this.ranking(empresaId, limit),
      this.melhoresDoDia(empresaId, limit, date),
      this.melhoresDoMes(empresaId, limit, date),
      this.melhoresDoAno(empresaId, limit, date),
    ]);

    return {
      mais_orcados: maisOrcados,
      melhores_do_dia: melhoresDoDia,
      melhores_do_mes: melhoresDoMes,
      melhores_do_ano: melhoresDoAno,
    };
  }
}
