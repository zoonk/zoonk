import { type ContinueLearningItem } from "@/data/courses/get-continue-learning";
import { getActivityKinds } from "@/lib/activities";
import {
  FeatureCard,
  FeatureCardBody,
  FeatureCardContent,
  FeatureCardSectionTitle,
  FeatureCardThumbnail,
} from "@zoonk/ui/components/feature";
import { ScrollArea, ScrollBar } from "@zoonk/ui/components/scroll-area";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { getExtracted } from "next-intl/server";
import { ContinueLearningCard } from "./continue-learning-card";

export async function ContinueLearningList({ items }: { items: ContinueLearningItem[] }) {
  const t = await getExtracted();
  const activityKinds = await getActivityKinds();

  const kindLabels = new Map<string, string>(activityKinds.map((kind) => [kind.key, kind.label]));

  return (
    <section className="flex flex-col gap-3 py-4 md:py-6">
      <FeatureCardSectionTitle className="px-4">{t("Continue learning")}</FeatureCardSectionTitle>

      <ScrollArea className="w-full px-4 pb-2">
        <div className="flex snap-x snap-mandatory gap-4">
          {items.map((item) => (
            <ContinueLearningCard item={item} key={item.activity.id} kindLabels={kindLabels} />
          ))}
        </div>

        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </section>
  );
}

export function ContinueLearningSkeleton() {
  return (
    <section className="flex flex-col gap-3 py-4 md:py-6">
      <Skeleton className="mx-4 h-5 w-32" />

      <div className="flex gap-6 overflow-hidden px-4 pb-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <FeatureCard className="w-72 shrink-0 md:w-80" key={i}>
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
        ))}
      </div>
    </section>
  );
}
