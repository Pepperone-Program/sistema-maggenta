import { ResourcePage } from "@/components/admin/resource-page";
import { PromotionalDateProducts } from "@/components/admin/promotional-date-products";
import { resources } from "@/config/resources";

export default function DatasPromocionaisPage() {
  return (
    <div className="space-y-6">
      <ResourcePage config={resources["datas-promocionais"]} />
      <PromotionalDateProducts />
    </div>
  );
}
