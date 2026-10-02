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
 * The offer's headline, in the words people use for what they're getting ready for, over one
 * column. Visitors read it on the public pricing page and learners in the app's subscription
 * page. A learner with a goal reads that goal instead, so the offer is about keeping it going.
 */
export async function PlusPricingPage({
  children,
  className,
  goalTitle,
  render,
}: {
  children: ReactNode;
  className?: string;
  goalTitle?: string;
  render?: ContainerProps["render"];
}) {
  const t = await getExtracted();

  return (
    <Container className={cn("gap-8 py-4 sm:py-8 lg:gap-10 lg:py-10", className)} render={render}>
      <ContainerHeader className="items-start">
        <ContainerHeaderGroup className="gap-4">
          {goalTitle && (
            <p className="text-muted-foreground text-sm font-medium text-pretty sm:text-base">
              {t("Your goal: {goal}", { goal: goalTitle })}
            </p>
          )}

          <ContainerTitle className="text-4xl leading-[0.95] font-semibold tracking-[-0.04em] text-balance sm:text-5xl">
            {goalTitle
              ? t("Keep going with Plus.")
              : t("Get ready for your exam, new job or move.")}
          </ContainerTitle>

          <ContainerDescription className="text-base leading-relaxed sm:text-lg">
            {t("Plus gives you everything Zoonk has, with no limits.")}
          </ContainerDescription>
        </ContainerHeaderGroup>
      </ContainerHeader>

      <ContainerBody className="sm:px-4">{children}</ContainerBody>
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
