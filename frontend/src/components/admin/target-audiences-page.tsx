"use client";

import { resources } from "@/config/resources";
import { useState } from "react";
import { AssociationProductsModal } from "./association-products-modal";
import { ResourcePage } from "./resource-page";

type TargetAudienceRow = Record<string, unknown>;

export function TargetAudiencesPage() {
  const [selectedAudience, setSelectedAudience] = useState<TargetAudienceRow | null>(null);

  return (
    <>
      <ResourcePage config={resources["publicos-alvos"]} onRowClick={setSelectedAudience} />
      {selectedAudience && (
        <AssociationProductsModal
          associationLabel="No público-alvo"
          endpoint={`/api/v1/publicos-alvos/${Number(selectedAudience.id_publico_alvo)}/produtos`}
          onClose={() => setSelectedAudience(null)}
          title={String(selectedAudience.publico_alvo || "Público-alvo")}
        />
      )}
    </>
  );
}
