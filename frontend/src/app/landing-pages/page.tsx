import { ResourcePage } from "@/components/admin/resource-page";
import { resources } from "@/config/resources";

export default function LandingPagesPage() {
  return <ResourcePage config={resources["landing-pages"]} />;
}
