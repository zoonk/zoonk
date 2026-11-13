import { VisitorBarLinks } from "@/components/login-bar-link";
import { NoAccountNote } from "@/components/public/no-account-note";
import { LearnPageBar } from "@zoonk/learn/bar";

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
      {/* On a phone a visitor's links follow the options, which then aren't the bar's last thing. */}
      <div className="contents max-lg:not-last:*:me-0">{options}</div>

      <NoAccountNote>
        <VisitorBarLinks className="lg:hidden" />
      </NoAccountNote>
    </LearnPageBar>
  );
}
