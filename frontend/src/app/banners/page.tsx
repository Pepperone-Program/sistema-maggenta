import { ResourcePage } from "@/components/admin/resource-page";
import { resources } from "@/config/resources";

export default function BannersPage() {
  return <ResourcePage config={resources.banners} />;
}
