import { VisitorBarLinks } from "@/components/login-bar-link";
import { CatalogBarContent } from "./catalog-bar-content";

/** Its height is `--catalog-bar`, under which the category chips stay in reach. */
export function CatalogBar() {
  return <CatalogBarContent visitor={<VisitorBarLinks />} />;
}
