"use client";

import { Link, useRouter } from "@/i18n/navigation";
import {
  type OptionalActivityKind,
  type getLessonOptionalActivities,
} from "@zoonk/core/lessons/optional-activities";
import { Button, buttonVariants } from "@zoonk/ui/components/button";
import { ChevronDownIcon, Loader2Icon } from "lucide-react";
import { useExtracted } from "next-intl";
import { type ReactNode, useEffect, useRef, useState, useTransition } from "react";
import { requestOptionalPractice } from "./optional-practice-action";

type OptionalPracticeGroup = Extract<
  Awaited<ReturnType<typeof getLessonOptionalActivities>>,
  { status: "ready" }
> & { title?: string | null };

/** Optional practice stays beside its teaching source and outside the required lesson list. */
export function OptionalPractice({
  groups,
  isAuthenticated,
  children,
}: {
  children?: ReactNode;
  groups: OptionalPracticeGroup[];
  isAuthenticated: boolean;
}) {
  const t = useExtracted();
  const detailsRef = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    function openLinkedSource() {
      const source = groups.find(
        (group) => globalThis.location.hash === `#optional-${group.source.lessonId}`,
      );

      if (source && detailsRef.current) {
        detailsRef.current.open = true;

        document
          .querySelector(`#optional-${source.source.lessonId}`)
          ?.scrollIntoView({ block: "center" });
      }
    }

    openLinkedSource();
    globalThis.addEventListener("hashchange", openLinkedSource);
    return () => globalThis.removeEventListener("hashchange", openLinkedSource);
  }, [groups]);

  if (groups.length === 0 && !children) {
    return null;
  }

  return (
    <details className="group border-t pt-5" ref={detailsRef}>
      <summary className="focus-visible:ring-ring flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-sm py-2 text-sm font-medium outline-none focus-visible:ring-2 [&::-webkit-details-marker]:hidden">
        {t("Optional practice")}
        <ChevronDownIcon
          aria-hidden="true"
          className="size-4 transition-transform group-open:rotate-180 motion-reduce:transition-none"
        />
      </summary>
      <div className="divide-y">
        {groups.map((group) => (
          <OptionalPracticeSource
            group={group}
            isAuthenticated={isAuthenticated}
            key={group.source.lessonId}
          />
        ))}
        {children}
      </div>
    </details>
  );
}

function OptionalPracticeSource({
  group,
  isAuthenticated,
}: {
  group: OptionalPracticeGroup;
  isAuthenticated: boolean;
}) {
  const t = useExtracted();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState<OptionalActivityKind | null>(null);
  const [failed, setFailed] = useState(false);
  const { source } = group;

  const chapterHref =
    `/b/${source.brandSlug}/c/${source.courseSlug}/ch/${source.chapterSlug}` as const;

  const sourceHref = `${chapterHref}#optional-${source.lessonId}` as const;

  function start(kind: OptionalActivityKind) {
    setSelected(kind);
    setFailed(false);

    startTransition(async () => {
      try {
        const result = await requestOptionalPractice({ kind, lessonId: source.lessonId });

        if (result.status === "unauthorized") {
          router.push(`/login?next=${encodeURIComponent(sourceHref)}`);
        } else if (result.status === "generationRequired") {
          router.push(`/generate/l/${result.resourceId}?backTo=${encodeURIComponent(sourceHref)}`);
        } else if (result.status === "ready") {
          router.push(`${chapterHref}/l/${result.lesson.slug}`);
        } else {
          setFailed(true);
        }
      } catch {
        setFailed(true);
      }
    });
  }

  return (
    <div className="space-y-3 py-4" id={`optional-${source.lessonId}`}>
      {group.title && <h3 className="text-sm font-medium">{group.title}</h3>}
      <div className="flex flex-wrap gap-2">
        {group.activities.map(({ kind, lesson }) => {
          const label = kind === "quiz" ? t("Check understanding") : t("Try a scenario");

          if (lesson?.generationStatus === "completed" && !pending) {
            return (
              <Link
                key={kind}
                href={`${chapterHref}/l/${lesson.slug}`}
                className={buttonVariants({
                  className: "min-h-11",
                  size: "sm",
                  variant: "outline",
                })}
              >
                {label}
              </Link>
            );
          }

          if (!isAuthenticated && !pending) {
            return (
              <Link
                key={kind}
                href={`/login?next=${encodeURIComponent(sourceHref)}`}
                className={buttonVariants({
                  className: "min-h-11",
                  size: "sm",
                  variant: "outline",
                })}
              >
                {label}
              </Link>
            );
          }

          return (
            <Button
              aria-busy={pending && selected === kind}
              disabled={pending}
              key={kind}
              onClick={() => start(kind)}
              className="min-h-11"
              size="sm"
              variant="outline"
            >
              {pending && selected === kind && (
                <Loader2Icon
                  aria-hidden="true"
                  className="animate-spin motion-reduce:animate-none"
                />
              )}
              {label}
            </Button>
          );
        })}
      </div>
      {failed && (
        <p className="text-destructive text-sm" role="alert">
          {t("Could not open this activity. Please try again.")}
        </p>
      )}
    </div>
  );
}
