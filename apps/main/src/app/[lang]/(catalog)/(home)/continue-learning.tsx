import { getContinueLearning } from "@/data/courses/get-continue-learning";
import { MAX_CONTINUE_LEARNING_ITEMS } from "@zoonk/core/courses/continue-learning-contract";
import { type ContinueLearningItem } from "@zoonk/core/courses/list-current-user-continue-learning";
import {
  FeatureCard,
  FeatureCardBody,
  FeatureCardContent,
  FeatureCardSectionTitle,
  FeatureCardThumbnail,
} from "@zoonk/ui/components/feature";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { getExtracted } from "next-intl/server";
import { type ReactNode } from "react";
import { ContinueLearningCard } from "./continue-learning-card";

const CONTINUE_LEARNING_TITLE_ID = "continue-learning-title";

function ContinueLearningItem({ children, itemCount }: { children: ReactNode; itemCount: number }) {
  if (itemCount === 1) {
    return <div className="w-full">{children}</div>;
  }

  return <div className="w-72 shrink-0 snap-start sm:w-auto sm:shrink">{children}</div>;
}

function ContinueLearningLayout({
  children,
  itemCount,
}: {
  children: ReactNode;
  itemCount: number;
}) {
  if (itemCount === 1) {
    return (
      <div className="grid grid-cols-1 gap-4 px-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {children}
      </div>
    );
  }

  return (
    <div className="scrollbar-none overflow-x-auto sm:overflow-x-visible [&::-webkit-scrollbar]:hidden">
      <div className="flex w-max min-w-full snap-x snap-mandatory gap-4 px-4 pb-1 sm:grid sm:w-auto sm:min-w-0 sm:snap-none sm:grid-cols-2 sm:pb-0 lg:grid-cols-3 xl:grid-cols-4">
        {children}
      </div>
    </div>
  );
}

export async function ContinueLearningList() {
  const items = await getContinueLearning();

  if (items.length === 0) {
    return null;
  }

  const t = await getExtracted();
  const itemCount = items.length;

  const cards = items.map((item) => (
    <ContinueLearningItem itemCount={itemCount} key={item.course.id}>
      <ContinueLearningCard item={item} />
    </ContinueLearningItem>
  ));

  return (
    <section
      aria-labelledby={CONTINUE_LEARNING_TITLE_ID}
      className="flex flex-col gap-3 py-4 md:py-6"
    >
      <FeatureCardSectionTitle className="px-4" id={CONTINUE_LEARNING_TITLE_ID}>
        {t("Continue learning")}
      </FeatureCardSectionTitle>

      <ContinueLearningLayout itemCount={itemCount}>{cards}</ContinueLearningLayout>
    </section>
  );
}

function ContinueLearningCardSkeleton() {
  return (
    <FeatureCard>
      <Skeleton className="h-5 w-full" />

      <FeatureCardContent>
        <FeatureCardThumbnail size="lg">
          <Skeleton className="size-full" />
        </FeatureCardThumbnail>

        <FeatureCardBody className="gap-1">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-3 w-2/3" />
          <Skeleton className="h-6 w-full" />
        </FeatureCardBody>
      </FeatureCardContent>
    </FeatureCard>
  );
}

export function ContinueLearningSkeleton() {
  return (
    <section className="flex flex-col gap-3 py-4 md:py-6">
      <Skeleton className="mx-4 h-5 w-32" />

      <ContinueLearningLayout itemCount={MAX_CONTINUE_LEARNING_ITEMS}>
        {/* eslint-disable react/no-array-index-key -- static skeleton */}
        {Array.from({ length: MAX_CONTINUE_LEARNING_ITEMS }).map((_, i) => (
          <ContinueLearningItem itemCount={MAX_CONTINUE_LEARNING_ITEMS} key={i}>
            <ContinueLearningCardSkeleton />
          </ContinueLearningItem>
        ))}
      </ContinueLearningLayout>
    </section>
  );
}
