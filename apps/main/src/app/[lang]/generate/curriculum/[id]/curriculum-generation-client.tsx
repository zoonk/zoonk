"use client";

import { GenerationLimitCTA } from "@/components/generation/generation-limit-cta";
import { WorkflowGenerationError } from "@/components/generation/workflow-generation-error";
import { Link, useRouter } from "@/i18n/navigation";
import { type GenerationReturnTo } from "@/lib/workflow/generation-return-to";
import { useWorkflowGeneration } from "@/lib/workflow/use-workflow-generation";
import { COURSE_COMPLETION_STEP, type CourseWorkflowStepName } from "@zoonk/core/workflows/steps";
import { type GenerationStatus } from "@zoonk/db";
import { Spinner } from "@zoonk/ui/components/spinner";
import { safeAsync } from "@zoonk/utils/error";
import { useExtracted } from "next-intl";
import { useEffect, useEffectEvent, useState, useTransition } from "react";
import { finishGenerationRequest } from "../../finish-generation-request";
import { finishCurriculumSetup, readCurriculumGeneration } from "./curriculum-actions";

const CURRICULUM_POLL_DELAY_MS = 4000;

export function CurriculumGenerationClient({
  brandSlug,
  courseId,
  courseSlug,
  courseTitle,
  generationRunId,
  generationStatus,
  needsGeneration,
  returnTo,
}: {
  brandSlug: string;
  courseId: string;
  courseSlug: string;
  courseTitle: string;
  generationRunId: string | null;
  generationStatus: GenerationStatus;
  needsGeneration: boolean;
  returnTo: GenerationReturnTo | null;
}) {
  const t = useExtracted();
  const router = useRouter();
  const [ready, setReady] = useState(!needsGeneration);
  const [readError, setReadError] = useState(false);
  const [finishing, startFinishing] = useTransition();

  const generation = useWorkflowGeneration<CourseWorkflowStepName>({
    autoTrigger: needsGeneration,
    completionStep: COURSE_COMPLETION_STEP,
    initialRunId: generationRunId,
    initialStatus: generationStatus === "running" && generationRunId ? "streaming" : "idle",
    target: { id: courseId, type: "curriculum" },
  });

  const backHref = `/b/${brandSlug}/c/${courseSlug}?edition=original` as const;

  const loginHref =
    `/login?next=${encodeURIComponent(`/generate/curriculum/${courseId}`)}` as const;

  const reconcile = useEffectEvent(async () => {
    const result = await readCurriculumGeneration(courseId);

    if (result.status === "unavailable") {
      throw new Error("The course is unavailable");
    }

    if (result.status === "completed") {
      setReady(true);
      return;
    }

    if (
      result.generationRunId &&
      result.generationRunId !== generation.runId &&
      result.generationStatus === "running"
    ) {
      generation.resume(result.generationRunId);
    }

    if (result.generationRunId === generation.runId && result.generationStatus === "failed") {
      throw new Error("Course preparation failed");
    }
  });

  useEffect(() => {
    if (ready || readError || generation.status === "limitReached") {
      return;
    }

    const state = { active: true, timer: undefined as ReturnType<typeof setTimeout> | undefined };

    async function poll() {
      const { error } = await safeAsync(() => reconcile());

      if (!state.active) {
        return;
      }

      if (error) {
        setReadError(true);
      } else {
        state.timer = globalThis.setTimeout(poll, CURRICULUM_POLL_DELAY_MS);
      }
    }

    state.timer = globalThis.setTimeout(poll, CURRICULUM_POLL_DELAY_MS);

    return () => {
      state.active = false;
      globalThis.clearTimeout(state.timer);
    };
  }, [ready, readError, generation.status]);

  const continueLearning = useEffectEvent(() => {
    startFinishing(async () => {
      if (returnTo) {
        const { data: href } = await safeAsync(() => finishGenerationRequest(returnTo));

        if (href) {
          router.replace(href);
        } else {
          setReadError(true);
        }

        return;
      }

      const { data: result } = await safeAsync(() => finishCurriculumSetup(courseId));

      if (result?.status === "ready") {
        router.replace(result.href);
      } else {
        setReadError(true);
      }
    });
  });

  useEffect(() => {
    if (ready && !readError) {
      continueLearning();
    }
  }, [ready, readError]);

  if (generation.status === "limitReached" && generation.limit) {
    return (
      <GenerationLimitCTA
        backHref={returnTo ?? backHref}
        backLabel={returnTo ? t("Back") : t("Back to course")}
        limit={generation.limit}
        loginHref={loginHref}
      />
    );
  }

  return (
    <div className="flex w-full max-w-md flex-col gap-6 py-8">
      <CurriculumGenerationHeader
        courseTitle={courseTitle}
        isPreparing={!ready && !readError && generation.status !== "error"}
        ready={ready}
      />
      {(readError || (!ready && generation.status === "error")) && (
        <WorkflowGenerationError
          error={null}
          errorKind={readError ? "connection" : generation.errorKind}
          onRetry={() => {
            setReadError(false);

            if (!ready) {
              generation.retry();
            }
          }}
        />
      )}
      {finishing && <Spinner aria-label={t("Opening your next step…")} />}
      <Link
        className="text-muted-foreground hover:text-foreground inline-flex min-h-11 items-center text-sm underline underline-offset-4"
        href={returnTo ?? backHref}
      >
        {returnTo ? t("Back") : t("Back to course")}
      </Link>
    </div>
  );
}

function CurriculumGenerationHeader({
  courseTitle,
  isPreparing,
  ready,
}: {
  courseTitle: string;
  isPreparing: boolean;
  ready: boolean;
}) {
  const t = useExtracted();

  return (
    <div aria-live="polite" className="flex flex-col gap-3">
      <h1 className="text-2xl font-semibold tracking-tight">
        {ready ? t("Your course is ready") : t("Preparing {course}", { course: courseTitle })}
      </h1>
      <p className="text-muted-foreground text-sm">
        {ready
          ? t("Opening your next step…")
          : t(
              "We're organizing the chapters for your learning path. You can leave this page and come back later.",
            )}
      </p>
      {isPreparing && (
        <p className="flex items-center gap-2 text-sm">
          <Spinner aria-hidden="true" />
          {t("Preparing your chapters…")}
        </p>
      )}
    </div>
  );
}
