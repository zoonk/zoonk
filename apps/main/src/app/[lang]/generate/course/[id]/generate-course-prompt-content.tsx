import { GenerationAuthenticationCTA } from "@/components/generation/generation-authentication-cta";
import { GenerationExitLink } from "@/components/generation/generation-exit-link";
import { redirect } from "@/i18n/navigation";
import { parseGenerationReturnTo } from "@/lib/workflow/generation-return-to";
import { getCoursePromptGeneration } from "@zoonk/core/courses/get-prompt-generation";
import { getSession } from "@zoonk/core/users/session";
import { Container, ContainerBody } from "@zoonk/ui/components/container";
import { Empty, EmptyContent, EmptyHeader } from "@zoonk/ui/components/empty";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { AI_ORG_SLUG } from "@zoonk/utils/org";
import { getExtracted } from "next-intl/server";
import { notFound } from "next/navigation";
import { GenerationClient } from "./generation-client";

export async function GenerateCoursePromptContent({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; lang: string }>;
  searchParams: Promise<{ returnTo?: string | string[] }>;
}) {
  const [{ id, lang: locale }, query] = await Promise.all([params, searchParams]);
  const returnTo = parseGenerationReturnTo(query.returnTo);
  const generationHref = `/generate/course/${id}${returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : ""}`;

  const [generation, session] = await Promise.all([
    getCoursePromptGeneration({ coursePromptId: id }),
    getSession(),
  ]);

  if (generation.status === "notFound") {
    notFound();
  }

  if (generation.status === "redirect") {
    return redirect({
      href: returnTo ?? `/b/${AI_ORG_SLUG}/c/${generation.target.courseSlug}/start`,
      locale,
    });
  }

  const canFollowRun = generation.generationStatus === "running" && generation.generationRunId;

  if (!session && !canFollowRun) {
    const loginHref = `/login?next=${encodeURIComponent(generationHref)}` as const;

    return (
      <Container variant="narrow">
        <ContainerBody>
          <GenerationAuthenticationCTA
            loginHref={loginHref}
            target={{ courseSlug: generation.courseSlug, resource: "course" }}
          />
        </ContainerBody>
      </Container>
    );
  }

  const t = await getExtracted();

  return (
    <Container variant="narrow">
      <ContainerBody>
        <GenerationClient
          canGenerate={Boolean(session)}
          courseSlug={generation.courseSlug}
          courseTitle={generation.courseTitle}
          linkedCourseSlug={generation.linkedCourseSlug}
          generationRunId={generation.generationRunId}
          generationStatus={generation.generationStatus}
          requestId={generation.coursePromptId}
          returnTo={returnTo}
        >
          <GenerationExitLink href={returnTo ?? "/"} width="content">
            {returnTo ? t("Back") : t("Back home")}
          </GenerationExitLink>
        </GenerationClient>
      </ContainerBody>
    </Container>
  );
}

export function GenerateCoursePromptFallback() {
  return (
    <Container variant="narrow">
      <ContainerBody>
        <Empty className="border-0">
          <EmptyHeader>
            <Skeleton className="size-10 rounded-lg" />
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-64" />
          </EmptyHeader>
          <EmptyContent>
            <Skeleton className="h-9 w-36 rounded-full" />
          </EmptyContent>
        </Empty>
      </ContainerBody>
    </Container>
  );
}
