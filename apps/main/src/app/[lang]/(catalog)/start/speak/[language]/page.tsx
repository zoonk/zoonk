import { GenerationAuthenticationCTA } from "@/components/generation/generation-authentication-cta";
import { getAiCourseHref } from "@/data/courses/course-href";
import { redirect } from "@/i18n/navigation";
import { getCompletedLanguageCourse } from "@zoonk/core/courses/language";
import { getSession } from "@zoonk/core/users/session";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { getLanguageName, isTTSSupportedLanguage } from "@zoonk/utils/languages";
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
import { CreateLanguageCourse } from "../create-language-course";

export const prefetch = "force-disabled";

type StartSpeakLanguageParams = PageProps<"/[lang]/start/speak/[language]">["params"];

/**
 * Reads an existing language destination; a missing course needs an explicit form submission.
 */
async function StartSpeakLanguageRedirect({ params }: { params: StartSpeakLanguageParams }) {
  const { lang: locale, language: targetLanguage } = await params;

  if (!isTTSSupportedLanguage(targetLanguage)) {
    notFound();
  }

  if (targetLanguage === locale) {
    return redirect({ href: "/start/speak", locale });
  }

  const [existing, session, t] = await Promise.all([
    getCompletedLanguageCourse({ language: locale, targetLanguage }),
    getSession(),
    getExtracted(),
  ]);

  if (existing) {
    return redirect({ href: `${getAiCourseHref(existing)}/start`, locale });
  }

  if (!session) {
    return (
      <StartSurface>
        <GenerationAuthenticationCTA
          loginHref={`/login?next=${encodeURIComponent(`/start/speak/${targetLanguage}`)}`}
          target={{ resource: "course", targetLanguage }}
        />
      </StartSurface>
    );
  }

  return (
    <StartSurface>
      <StartSurfaceHeader>
        <StartSurfaceContent>
          <StartSurfaceTitle>
            {t("Learn {language}", {
              language: getLanguageName({ targetLanguage, userLanguage: locale }),
            })}
          </StartSurfaceTitle>
          <StartSurfaceDescription>
            {t("Create your course, then choose where to start.")}
          </StartSurfaceDescription>
        </StartSurfaceContent>
      </StartSurfaceHeader>
      <CreateLanguageCourse language={targetLanguage} />
    </StartSurface>
  );
}

/**
 * Gives cold navigations a stable course-preparation surface while the runtime
 * redirect checks for an existing course.
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
 * Keeps session-dependent availability beneath the shared static shell.
 */
export default function StartSpeakLanguage(props: PageProps<"/[lang]/start/speak/[language]">) {
  return (
    <Suspense fallback={<StartSpeakLanguageFallback />}>
      <StartSpeakLanguageRedirect params={props.params} />
    </Suspense>
  );
}
