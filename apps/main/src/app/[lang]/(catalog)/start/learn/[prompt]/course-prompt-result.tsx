import { type UnsupportedCoursePrompt, resolveCoursePrompt } from "@/data/courses/course-prompt";
import { getSession } from "@/data/users/get-session";
import { Link, redirect } from "@/i18n/navigation";
import { buttonVariants } from "@zoonk/ui/components/button";
import { getExtracted, getLocale } from "next-intl/server";
import {
  StartSurface,
  StartSurfaceActions,
  StartSurfaceBadge,
  StartSurfaceContent,
  StartSurfaceDescription,
  StartSurfaceHeader,
  StartSurfaceTitle,
} from "../../_components/start-surface";
import { CoursePromptWaitlistForm } from "./course-prompt-waitlist-form";

/**
 * Keeps translated emphasis for the canonical title stable across renders so
 * the rich-text formatter does not receive a new component-like callback from
 * inside the page render path.
 */
function renderHighlightedTitle(chunks: React.ReactNode) {
  return <strong className="text-foreground font-medium">{chunks}</strong>;
}

/**
 * Shows the waitlist state for prompt intents and reusable course formats that are
 * intentionally recognized before their dedicated learning workflows exist.
 */
async function WaitlistedCoursePrompt({
  prompt,
  coursePrompt,
  title,
}: {
  prompt: string;
  coursePrompt: UnsupportedCoursePrompt;
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

      <CoursePromptWaitlistForm
        coursePrompt={coursePrompt}
        defaultEmail={session?.user.email}
        prompt={prompt}
        title={title}
      />
    </StartSurface>
  );
}

/**
 * Gives unsafe requests a clear stop state without creating a feedback or
 * generation record for content Zoonk should not help produce.
 */
async function UnsafeCoursePrompt() {
  const t = await getExtracted();

  return (
    <StartSurface>
      <StartSurfaceHeader>
        <StartSurfaceBadge variant="destructive">{t("Not available")}</StartSurfaceBadge>

        <StartSurfaceContent>
          <StartSurfaceTitle>{t("We can't create this course")}</StartSurfaceTitle>
          <StartSurfaceDescription>
            {t(
              "Zoonk can't help with requests that involve unsafe, illegal, or harmful activity. Try a different subject instead.",
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
 * surface. Topic requests immediately enter generation, exam requests move to
 * exam prep, and question or personalized requests stay on this route so
 * learners can join the waitlist.
 */
export async function CourseStartResult({ prompt }: { prompt: string }) {
  const locale = await getLocale();
  const result = await resolveCoursePrompt({ language: locale, prompt });

  if (result.kind === "course" || result.kind === "redirect") {
    return redirect({ href: result.href, locale });
  }

  if (result.kind === "generate") {
    return redirect({ href: `/generate/course/${result.prompt.id}`, locale });
  }

  if (result.kind === "unsafe") {
    return <UnsafeCoursePrompt />;
  }

  return (
    <WaitlistedCoursePrompt coursePrompt={result.prompt} prompt={prompt} title={result.title} />
  );
}
