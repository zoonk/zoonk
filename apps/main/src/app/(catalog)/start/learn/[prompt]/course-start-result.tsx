import {
  type UnsupportedCourseStartScope,
  resolveCourseStartRequest,
} from "@/data/courses/course-start-request";
import { getSession } from "@zoonk/core/users/session/get";
import { buttonVariants } from "@zoonk/ui/components/button";
import { getExtracted, getLocale } from "next-intl/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  StartSurface,
  StartSurfaceActions,
  StartSurfaceBadge,
  StartSurfaceContent,
  StartSurfaceDescription,
  StartSurfaceHeader,
  StartSurfaceTitle,
} from "../../_components/start-surface";
import { CourseStartWaitlistForm } from "./course-mode-waitlist-form";

/**
 * Keeps translated emphasis for the canonical title stable across renders so
 * the rich-text formatter does not receive a new component-like callback from
 * inside the page render path.
 */
function renderHighlightedTitle(chunks: React.ReactNode) {
  return <strong className="text-foreground font-medium">{chunks}</strong>;
}

/**
 * Shows the waitlist state for routed scopes that are intentionally recognized
 * before their dedicated learning workflows exist.
 */
async function WaitlistedCourseStartRequest({
  prompt,
  scope,
  title,
}: {
  prompt: string;
  scope: UnsupportedCourseStartScope;
  title: string;
}) {
  const t = await getExtracted();
  const session = await getSession();

  return (
    <StartSurface>
      <StartSurfaceHeader>
        <StartSurfaceBadge>{t("Coming soon")}</StartSurfaceBadge>

        <StartSurfaceContent>
          <StartSurfaceTitle>{t("This option isn't available yet")}</StartSurfaceTitle>
          <StartSurfaceDescription>
            {t.rich(
              "Join the waitlist and we'll let you know when you can learn <strong>{title}</strong> with Zoonk.",
              { strong: renderHighlightedTitle, title },
            )}
          </StartSurfaceDescription>
        </StartSurfaceContent>
      </StartSurfaceHeader>

      <CourseStartWaitlistForm
        defaultEmail={session?.user.email}
        prompt={prompt}
        scope={scope}
        title={title}
      />
    </StartSurface>
  );
}

/**
 * Gives unsafe requests a clear stop state without creating a feedback or
 * generation record for content Zoonk should not help produce.
 */
async function UnsafeCourseRequest() {
  const t = await getExtracted();

  return (
    <StartSurface>
      <StartSurfaceHeader>
        <StartSurfaceBadge variant="destructive">{t("Not available")}</StartSurfaceBadge>

        <StartSurfaceContent>
          <StartSurfaceTitle>{t("We can't create this course")}</StartSurfaceTitle>
          <StartSurfaceDescription>
            {t(
              "Zoonk can't help with requests that involve unsafe, illegal, or harmful activity. Try a safer learning goal instead.",
            )}
          </StartSurfaceDescription>
        </StartSurfaceContent>
      </StartSurfaceHeader>

      <StartSurfaceActions>
        <Link className={buttonVariants({ variant: "outline" })} href="/start/learn">
          {t("Try another goal")}
        </Link>
      </StartSurfaceActions>
    </StartSurface>
  );
}

/**
 * Resolves the submitted prompt and sends the learner to the matching start
 * surface. Topic requests immediately enter generation; question and
 * personalized requests stay on this route so learners can join the waitlist.
 */
export async function CourseStartResult({ prompt }: { prompt: string }) {
  const locale = await getLocale();
  const result = await resolveCourseStartRequest({ language: locale, prompt });

  if (result.kind === "generate") {
    redirect(`/generate/course/${result.request.id}`);
  }

  if (result.kind === "redirect") {
    redirect(result.href);
  }

  if (result.kind === "unsafe") {
    return <UnsafeCourseRequest />;
  }

  return <WaitlistedCourseStartRequest prompt={prompt} scope={result.scope} title={result.title} />;
}
