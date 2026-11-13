import { BackLink, PageTitle, PageTop } from "@zoonk/ui/components/page-top";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { type Route } from "next";
import Link from "next/link";

type EvalParent<T extends string = string> = { href: Route<T>; label: string };

export const EVALS_HOME: EvalParent = { href: "/", label: "Evals" };

export function EvalPageTop<T extends string>({
  actions,
  children,
  parent,
  title,
}: {
  actions?: React.ReactNode;
  children?: React.ReactNode;
  parent?: EvalParent<T>;
  title: React.ReactNode;
}) {
  return (
    <div className="px-(--page-gutter)">
      <PageTop
        actions={actions}
        back={
          parent && (
            <BackLink aria-label={`Back to ${parent.label}`} render={<Link href={parent.href} />}>
              {parent.label}
            </BackLink>
          )
        }
      >
        <PageTitle>{title}</PageTitle>
        {children}
      </PageTop>
    </div>
  );
}

export function EvalPageTopSkeleton() {
  return (
    <div aria-hidden="true" className="px-(--page-gutter)">
      <PageTop back={<Skeleton className="h-5 w-32 rounded" />}>
        <Skeleton className="h-8 w-1/2 rounded" />
        <Skeleton className="mt-1 h-4 w-1/3 rounded" />
      </PageTop>
    </div>
  );
}
