import { Badge } from "@zoonk/ui/components/badge";
import {
  Container,
  ContainerBody,
  ContainerDescription,
  ContainerHeader,
  ContainerHeaderGroup,
  type ContainerProps,
  ContainerTitle,
} from "@zoonk/ui/components/container";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { cn } from "@zoonk/ui/lib/utils";
import { type PriceInfo } from "@zoonk/utils/currency";
import { type Metadata } from "next";
import { getExtracted } from "next-intl/server";
import { type ReactNode } from "react";
import { PlanComparison } from "./plan-comparison";
import { PlusPurchase, type PlusViewerState } from "./plus-purchase";

/** Tracks start at zero width, so a long translation wraps instead of widening the page. */
const PRICING_GRID_CLASS =
  "grid w-full grid-cols-[minmax(0,1fr)] border-y lg:grid-cols-[minmax(0,3fr)_minmax(18rem,2fr)]";

/** The public pricing page and the subscription page describe the same offer. */
export async function getPlusPricingMetadata(): Promise<Pick<Metadata, "description" | "title">> {
  const t = await getExtracted();

  return {
    description: t(
      "Compare Free and Plus: as many lessons and goals as you need and more time with the AI tutor, whatever you want to learn.",
    ),
    title: t("Zoonk Plus: plans and pricing"),
  };
}

/**
 * The offer's headline above the plans. Visitors read it on the public pricing page and learners
 * in the app's subscription page, so both say the same thing in the same place.
 */
export async function PlusPricingPage({
  children,
  className,
  render,
}: {
  children: ReactNode;
  className?: string;
  render?: ContainerProps["render"];
}) {
  const t = await getExtracted();

  return (
    <Container className={cn("gap-8 py-4 sm:py-8 lg:gap-10 lg:py-10", className)} render={render}>
      <ContainerHeader className="items-start">
        <ContainerHeaderGroup className="max-w-3xl gap-4">
          <Badge variant="outline">{t("Zoonk Plus")}</Badge>

          <ContainerTitle className="text-4xl leading-[0.95] font-semibold tracking-[-0.04em] sm:text-5xl lg:text-6xl">
            {t("Learn anything. It’s all included.")}
          </ContainerTitle>

          <ContainerDescription className="max-w-2xl text-base leading-relaxed sm:text-lg">
            {t(
              "Whatever you want to learn, Plus gives you as many lessons and goals as you need and more time with the AI tutor.",
            )}
          </ContainerDescription>

          <p className="text-muted-foreground pt-2 font-mono text-xs tracking-wide text-pretty uppercase">
            {t("Any subject · Every goal · One price")}
          </p>
        </ContainerHeaderGroup>
      </ContainerHeader>

      <ContainerBody className="sm:px-4">{children}</ContainerBody>
    </Container>
  );
}

/** Free and Plus compared, beside the Plus offer for whoever is looking. */
export async function PlusPricing({
  monthlyPrice,
  viewerState,
  yearlyPrice,
}: {
  monthlyPrice: PriceInfo | null;
  viewerState: PlusViewerState;
  yearlyPrice: PriceInfo | null;
}) {
  const t = await getExtracted();
  const hasNoAccount = viewerState.status === "guest" || viewerState.status === "visitor";

  return (
    <section aria-label={t("Zoonk Plus benefits and pricing")} className={PRICING_GRID_CLASS}>
      <PlanComparison isVisitor={hasNoAccount} />
      <PlusPurchase
        monthlyPrice={monthlyPrice}
        viewerState={viewerState}
        yearlyPrice={yearlyPrice}
      />
    </section>
  );
}

export function PlusPricingSkeleton() {
  return (
    <div aria-hidden="true" className={PRICING_GRID_CLASS}>
      <div className="divide-y">
        {Array.from({ length: 3 }, (_, index) => (
          <div
            className="grid gap-3 px-1 py-6 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] sm:gap-8 sm:px-4 sm:py-8"
            key={index}
          >
            <Skeleton className="h-5 w-40" />
            <div className="flex flex-col gap-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          </div>
        ))}
      </div>

      <div className="bg-muted/40 order-first flex min-h-72 flex-col gap-6 border-b px-5 py-6 sm:px-8 sm:py-8 lg:order-last lg:border-b-0 lg:border-l">
        <div className="flex justify-between">
          <Skeleton className="h-5 w-14" />
          <Skeleton className="h-5 w-28" />
        </div>
        <Skeleton className="h-9 w-full rounded-4xl" />
        <Skeleton className="h-10 w-36" />
        <Skeleton className="mt-auto h-10 w-full rounded-4xl" />
      </div>
    </div>
  );
}
