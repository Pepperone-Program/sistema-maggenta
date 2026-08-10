"use client";

import { AssociationProductsModal } from "./association-products-modal";

type PromotionalDate = { id_data_promocional: number; data_promocional: string; data: string | null };

export function PromotionalDateProducts({ date, onClose }: { date: PromotionalDate; onClose: () => void }) {
  return <AssociationProductsModal associationLabel="Na data" endpoint={`/api/v1/datas-promocionais/${date.id_data_promocional}/produtos`} onClose={onClose} title={date.data_promocional} />;
}
