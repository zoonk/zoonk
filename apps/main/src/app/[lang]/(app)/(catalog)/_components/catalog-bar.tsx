import { VisitorBarLinks } from "@/components/login-bar-link";
import { CatalogBarContent } from "./catalog-bar-content";

/**
 * The catalog's bar on phones and tablets, where the app's tab bar has no way back from it and no
 * account: the catalog is a section of the app, as statistics and settings are. Its height is
 * `--catalog-bar`, under which the category chips stay in reach.
 */
export function CatalogBar() {
  return <CatalogBarContent visitor={<VisitorBarLinks />} />;
}
