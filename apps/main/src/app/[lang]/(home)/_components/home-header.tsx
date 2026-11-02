import { PublicNavLinks } from "@/components/public/public-nav-links";
import { PublicTopBar } from "@/components/public/public-top-bar";
import { PublicVisitorActions } from "@/components/public/public-visitor-actions";

export function HomeHeader() {
  return (
    <PublicTopBar
      actions={
        <>
          <PublicNavLinks />
          <PublicVisitorActions />
        </>
      }
    />
  );
}
