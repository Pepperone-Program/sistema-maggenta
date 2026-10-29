"use client";

import { useState } from "react";

export function ProductThumbnail({ src, name }: { src: string; name: string }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return <span className="flex h-14 w-14 items-center justify-center rounded-md bg-gray-2 text-center text-[10px] text-dark-4 dark:bg-dark-2 dark:text-dark-6">Sem imagem</span>;
  // Catalog URLs can be hosted on multiple suppliers' domains.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={name} width={56} height={56} loading="lazy" decoding="async" onError={() => setFailed(true)} className="h-14 w-14 rounded-md border border-stroke bg-white object-contain dark:border-dark-3" />;
}

export function mainProductImage(row: Record<string, unknown>): string {
  const images = Array.isArray(row.imagens) ? row.imagens as Array<{ url_imagem?: string; ordem_imagem?: number }> : [];
  const source = images.find(image => Number(image.ordem_imagem) === 1)?.url_imagem || images[0]?.url_imagem || row.url_imagem || row.imagem;
  return typeof source === "string" && /^(https?:\/\/|\/(?!\/))/.test(source.trim()) ? source.trim() : "";
}
