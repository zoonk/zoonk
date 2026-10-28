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
    <LearnPageBar back={back} title={title}>
      {options}

      <NoAccountNote>
        <VisitorBarLinks className="lg:hidden" />
      </NoAccountNote>
    </LearnPageBar>
  );
}
