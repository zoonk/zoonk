import { LoginRequired } from "@/components/auth/login-required";
import { SubscriptionGate } from "@/components/subscription/subscription-gate";
import { getActivityForGeneration } from "@/data/activities/get-activity-for-generation";
import { getSession } from "@zoonk/core/users/session/get";
import {
  Container,
  ContainerBody,
  ContainerDescription,
  ContainerHeader,
  ContainerHeaderGroup,
  ContainerTitle,
} from "@zoonk/ui/components/container";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { AI_ORG_SLUG } from "@zoonk/utils/constants";
import { parseBigIntId } from "@zoonk/utils/string";
import { getExtracted } from "next-intl/server";
import { notFound, redirect } from "next/navigation";
import { GenerationClient } from "./generation-client";

export async function GenerateActivityContent({
  params,
}: {
  params: Promise<{ id: string; locale: string }>;
}) {
  const { id, locale } = await params;
  const activityId = parseBigIntId(id);

  if (activityId === null) {
    notFound();
  }

  const [session, activity] = await Promise.all([
    getSession(),
    getActivityForGeneration(activityId),
  ]);

  if (!activity || !activity.lesson) {
    notFound();
  }

  const t = await getExtracted();

  if (!session) {
    return <LoginRequired title={t("Generate Activity")} />;
  }

  if (activity.generationStatus === "completed") {
    redirect(
      `/${locale}/b/${AI_ORG_SLUG}/c/${activity.lesson.chapter.course.slug}/ch/${activity.lesson.chapter.slug}/l/${activity.lesson.slug}/a/${activity.position}`,
    );
  }

  const returnUrl = `/generate/a/${activityId}`;

  return (
    <Container variant="narrow">
      <ContainerHeader>
        <ContainerHeaderGroup>
          <ContainerTitle>{activity.title ?? t("Activity")}</ContainerTitle>
          <ContainerDescription>{t("Generate content for this activity")}</ContainerDescription>
        </ContainerHeaderGroup>
      </ContainerHeader>

      <ContainerBody>
        <SubscriptionGate returnUrl={returnUrl}>
          <GenerationClient
            activityKind={activity.kind}
            chapterSlug={activity.lesson.chapter.slug}
            courseSlug={activity.lesson.chapter.course.slug}
            generationRunId={activity.generationRunId}
            generationStatus={activity.generationStatus}
            lessonId={activity.lesson.id}
            lessonSlug={activity.lesson.slug}
            locale={locale}
            position={activity.position}
          />
        </SubscriptionGate>
      </ContainerBody>
    </Container>
  );
}

export function GenerateActivityFallback() {
  return (
    <Container variant="narrow">
      <ContainerHeader>
        <ContainerHeaderGroup>
          <Skeleton className="h-8 w-48" />
          <Skeleton className="mt-1 h-4 w-72" />
        </ContainerHeaderGroup>
      </ContainerHeader>

      <ContainerBody>
        <Skeleton className="h-64 w-full rounded-xl" />
      </ContainerBody>
    </Container>
  );
}
