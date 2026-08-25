import { createHash } from 'crypto';
import type { CreateOrcamentoDTO } from '@/types/orcamento';
import type { CreateOrcamentoItemDTO } from '@/types/orcamento-item';

const normalize = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([key]) => key !== 'idempotency_key')
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, normalize(entry)])
    );
  }
  if (typeof value === 'string') return value.trim().toLocaleLowerCase('pt-BR');
  return value ?? null;
};

const digest = (namespace: string, value: unknown): string =>
  createHash('sha256').update(`${namespace}:${JSON.stringify(normalize(value))}`).digest('hex');

export const sanitizeIdempotencyKey = (value: unknown): string | null => {
  const key = String(value ?? '').trim();
  return key && key.length <= 200 ? key : null;
};

export const quoteIdempotencyFingerprint = (
  empresaId: number,
  data: CreateOrcamentoDTO,
  suppliedKey?: string | null
): { fingerprint: string; explicit: boolean } => {
  const key = sanitizeIdempotencyKey(suppliedKey || data.idempotency_key);
  return {
    fingerprint: digest('orcamento', key ? { empresaId, key } : { empresaId, data }),
    explicit: Boolean(key),
  };
};

export const quoteItemFingerprint = (
  empresaId: number,
  orcamentoId: number,
  data: CreateOrcamentoItemDTO
): string => digest('orcamento-item', { empresaId, orcamentoId, data });
