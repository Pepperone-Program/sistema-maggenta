"use client";

import { resources } from "@/config/resources";
import { useState } from "react";
import { PromotionalDateProducts } from "./promotional-date-products";
import { ResourcePage } from "./resource-page";

type DateRow = Record<string, unknown>;

export function PromotionalDatesPage() {
  const [selectedDate, setSelectedDate] = useState<DateRow | null>(null);

  return (
    <>
      <ResourcePage config={resources["datas-promocionais"]} onRowClick={setSelectedDate} />
      {selectedDate && (
        <PromotionalDateProducts
          date={{
            id_data_promocional: Number(selectedDate.id_data_promocional),
            data_promocional: String(selectedDate.data_promocional || "Data promocional"),
            data: selectedDate.data ? String(selectedDate.data) : null,
          }}
          onClose={() => setSelectedDate(null)}
        />
      )}
    </>
  );
}
