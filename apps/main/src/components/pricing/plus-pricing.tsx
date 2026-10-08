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
import { PlusBenefits } from "./plus-benefits";
import { PlusPurchase, type PlusViewerState } from "./plus-purchase";
import { PlusQuestions } from "./plus-questions";

/** The public pricing page and the subscription page describe the same offer. */
export async function getPlusPricingMetadata(): Promise<Pick<Metadata, "description" | "title">> {
  const t = await getExtracted();

  return {
    description: t(
      "Get ready for your exam, new job or move with Zoonk Plus: unlimited lessons and goals, full exam prep with mock exams and the AI tutor. Try it free.",
    ),
    title: t("Zoonk Plus: plans and pricing"),
  };
}

/**
 * The public pricing page's hero, or the app's settings pages' header, so the in-app page reads
 * like its siblings.
 */
const PRICING_PAGE_VARIANTS = {
  hero: {
    body: "sm:px-4",
    container: "gap-8 py-4 sm:py-8 lg:gap-10 lg:py-10",
    description: "text-base leading-relaxed sm:text-lg",
    header: "",
    title: "text-4xl leading-[0.95] font-semibold tracking-[-0.04em] text-balance sm:text-5xl",
  },
  settings: {
    body: "px-0 pb-0",
    container: "gap-6",
    description: "leading-normal",
    header: "px-0",
    title: "text-foreground text-2xl leading-tight font-semibold tracking-tight",
  },
} as const;

/**
 * The offer's headline, in the words people use for what they're getting ready for, over one
 * column. Visitors read it on the public pricing page and learners in the app's subscription
 * page. A learner with a goal reads that goal instead, so the offer is about keeping it going.
 */
export async function PlusPricingPage({
  children,
  className,
  goalTitle,
  render,
  variant = "hero",
}: {
  children: ReactNode;
  className?: string;
  goalTitle?: string;
  render?: ContainerProps["render"];
  variant?: keyof typeof PRICING_PAGE_VARIANTS;
}) {
  const t = await getExtracted();
  const classes = PRICING_PAGE_VARIANTS[variant];

  return (
    <Container className={cn(classes.container, className)} render={render}>
      <ContainerHeader className={cn("items-start", classes.header)}>
        <ContainerHeaderGroup className={variant === "hero" ? "gap-4" : "gap-1.5"}>
          {goalTitle && (
            <p className="text-muted-foreground text-sm font-medium text-pretty sm:text-base">
              {t("Your goal: {goal}", { goal: goalTitle })}
            </p>
          )}

          <ContainerTitle className={classes.title}>
            {goalTitle
              ? t("Keep going with Plus.")
              : t("Get ready for your exam, new job or move.")}
          </ContainerTitle>

          <ContainerDescription className={classes.description}>
            {t("Plus gives you everything Zoonk has.")}
          </ContainerDescription>
        </ContainerHeaderGroup>
      </ContainerHeader>

      <ContainerBody className={classes.body}>{children}</ContainerBody>
    </Container>
  );
}

/** The Plus offer for whoever is looking, then what people ask before paying. */
export function PlusPricing({
  monthlyPrice,
  viewerState,
  yearlyPrice,
}: {
  monthlyPrice: PriceInfo | null;
  viewerState: PlusViewerState;
  yearlyPrice: PriceInfo | null;
}) {
  const hasNoAccount = viewerState.status === "guest" || viewerState.status === "visitor";

  return (
    <>
      <PlusPurchase
        benefits={<PlusBenefits />}
        monthlyPrice={monthlyPrice}
        viewerState={viewerState}
        yearlyPrice={yearlyPrice}
      />

      <PlusQuestions hasNoAccount={hasNoAccount} />
    </>
  );
}

export function PlusPricingSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="ring-foreground/10 flex flex-col gap-5 rounded-2xl p-5 ring-1 sm:p-6"
    >
      <div className="flex justify-between">
        <Skeleton className="h-6 w-14" />
        <Skeleton className="h-8 w-44 rounded-4xl" />
      </div>
      <Skeleton className="h-10 w-28" />
      <div className="flex flex-col gap-3">
        <Skeleton className="h-4 w-3/5" />
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-4 w-3/5" />
      </div>
      <Skeleton className="h-10 w-full rounded-4xl" />
    </div>
  );
}
