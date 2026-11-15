import { VisitorBarLinks } from "@/components/login-bar-link";
import { NoAccountNote } from "@/components/public/no-account-note";
import { LearnPageBar } from "@zoonk/learn/bar";
import { cn } from "@zoonk/ui/lib/utils";

export function CatalogPageBar({
  back,
  options,
  title,
}: {
  back: { href: string; label: string };
  options?: React.ReactNode;
  title?: string;
}) {
  return (
    <LearnPageBar back={back} section title={title}>
      {/* On a phone the way back names the course or the chapter, so it gets the room: only "Log in" stays, at every scroll, since a visitor has no other way in. The "…" ends the bar, so "Log in" doesn't take its edge. */}
      <NoAccountNote>
        <VisitorBarLinks
          className={cn("max-sm:*:not-last:hidden lg:hidden", options && "*:last:me-0")}
        />
      </NoAccountNote>

      {options}
    </LearnPageBar>
  );
}
