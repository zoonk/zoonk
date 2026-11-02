"use client";

import { RichTextBlocks } from "@zoonk/learn/rich-text";
import { Button } from "@zoonk/ui/components/button";
import { Spinner } from "@zoonk/ui/components/spinner";
import { LightbulbIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useState } from "react";
import { LessonHelpLimitNotice } from "../_components/help-limit-notice";
import { useLessonPlayerConfig } from "../lesson-player-context";
import { type AnswerExplanationOutcome } from "../lesson-player-types";

type ExplanationState = AnswerExplanationOutcome | { status: "idle" } | { status: "loading" };

export function ExplainAnswer({ answer, stepId }: { answer: string; stepId: string }) {
  const t = useExtracted();
  const { adapters } = useLessonPlayerConfig();
  const [state, setState] = useState<ExplanationState>({ status: "idle" });
  const explain = adapters.explainAnswer;

  if (!explain) {
    return null;
  }

  async function request() {
    if (!explain) {
      return;
    }

    setState({ status: "loading" });
    setState(await explain({ answer, stepId }));
  }

  if (state.status === "explained") {
    return (
      <div
        className="border-border flex flex-col gap-2 border-s-2 ps-3"
        data-slot="lesson-answer-explanation"
      >
        <p className="text-muted-foreground text-sm font-medium">{t("Why that answer misses")}</p>
        <RichTextBlocks className="text-base leading-relaxed" text={state.explanation} />
      </div>
    );
  }

  return (
    <div aria-live="polite" className="flex flex-col items-start gap-2">
      <Button
        disabled={state.status === "loading"}
        onClick={() => void request()}
        size="sm"
        variant="outline"
      >
        {state.status === "loading" ? <Spinner /> : <LightbulbIcon aria-hidden="true" />}
        {state.status === "loading" ? t("Explaining your answer") : t("Explain my answer")}
      </Button>

      {state.status === "failed" && (
        <p className="text-muted-foreground text-sm">
          {t("We couldn't explain it right now. Try again in a moment.")}
        </p>
      )}

      {(state.status === "slowDown" ||
        state.status === "limitReached" ||
        state.status === "signUpRequired") && <LessonHelpLimitNotice limit={state} />}
    </div>
  );
}
