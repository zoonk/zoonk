import { GenerationAuthenticationCTA } from "@/components/generation/generation-authentication-cta";
import { getAiCourseHref } from "@/data/courses/course-href";
import { redirect } from "@/i18n/navigation";
import { resolveLanguageCourse } from "@zoonk/core/courses/language";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { isTTSSupportedLanguage } from "@zoonk/utils/languages";
import { getExtracted } from "next-intl/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import {
  StartSurface,
  StartSurfaceContent,
  StartSurfaceDescription,
  StartSurfaceHeader,
  StartSurfaceTitle,
} from "../../_components/start-surface";

export const prefetch = "force-disabled";

type StartSpeakLanguageParams = PageProps<"/[lang]/start/speak/[language]">["params"];

/**
 * Turns a selected supported language into either the existing completed course
 * or the controlled workflow input that will generate that course.
 */
async function StartSpeakLanguageRedirect({ params }: { params: StartSpeakLanguageParams }) {
  const { lang: locale, language: targetLanguage } = await params;

  if (!isTTSSupportedLanguage(targetLanguage)) {
    notFound();
  }

  if (targetLanguage === locale) {
    return redirect({ href: "/start/speak", locale });
  }

  const resolution = await resolveLanguageCourse({ language: locale, targetLanguage });

  if (resolution.kind === "course") {
    return redirect({ href: getAiCourseHref(resolution.course), locale });
  }

  if (resolution.kind === "unauthorized") {
    const loginHref =
      `/login?next=${encodeURIComponent(`/start/speak/${targetLanguage}`)}` as const;

    return (
      <StartSurface>
        <GenerationAuthenticationCTA loginHref={loginHref} />
      </StartSurface>
    );
  }

  return redirect({ href: `/generate/course/${resolution.coursePrompt.id}`, locale });
}

/**
 * Gives cold navigations a stable course-preparation surface while the runtime
 * redirect checks for an existing course or creates its generation request.
 */
async function StartSpeakLanguageFallback() {
  const t = await getExtracted();

  return (
    <StartSurface>
      <StartSurfaceHeader>
        <StartSurfaceContent>
          <StartSurfaceTitle>{t("Preparing your course")}</StartSurfaceTitle>
          <StartSurfaceDescription>
            {t("Checking whether this course already exists...")}
          </StartSurfaceDescription>
        </StartSurfaceContent>
      </StartSurfaceHeader>

      <div className="flex w-full flex-col gap-3">
        <Skeleton className="h-11 w-full rounded-lg" />
        <Skeleton className="h-11 w-full rounded-lg" />
      </div>
    </StartSurface>
  );
}

/**
 * Keeps the side-effecting course request below Suspense so this page can
 * prerender only its fallback and never execute generation work in the shell.
 */
export default function StartSpeakLanguage(props: PageProps<"/[lang]/start/speak/[language]">) {
  return (
    <Suspense fallback={<StartSpeakLanguageFallback />}>
      <StartSpeakLanguageRedirect params={props.params} />
    </Suspense>
  );
}
