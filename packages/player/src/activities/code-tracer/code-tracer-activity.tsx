"use client";

import { useExtracted } from "next-intl";
import { useState } from "react";
import { LessonRichText } from "../../lesson/_components/lesson-rich-text";
import { ActivityCanvas, ActivityTextAlternative } from "../_components/activity-canvas";
import { ActivitySelectGrid, ActivitySelectGridItem } from "../_components/activity-select-grid";
import { expectedInteraction } from "../_utils/activity-expected";
import { type ActivityRendererProps } from "../activity-renderer";
import { TracerCode, TracerControls, TracerPredictionLog, TracerVariables } from "./tracer-parts";
import {
  blockingPause,
  firstStep,
  tracerAnswer,
  upcomingPause,
  watchedValues,
} from "./tracer-steps";

type CodeTracerProps = ActivityRendererProps<"codeTracer">;
type Fields = CodeTracerProps["content"]["fields"];
type Pause = Fields["pauses"][number];

const SHORT_OPTION_LENGTH = 8;

/** Short values sit side by side; four make a 2 by 2 grid. */
function optionColumns(options: Pause["options"]): 1 | 2 | 3 {
  if (options.some((option) => option.text.length > SHORT_OPTION_LENGTH)) {
    return 1;
  }

  return options.length === 3 ? 3 : 2;
}

function tracedText(fields: Fields, pause: Pause): string {
  const value = fields.trace[pause.step]?.values.find(
    (item) => item.name === pause.variable,
  )?.value;

  return value === undefined ? "" : String(value);
}

function optionText(pause: Pause, optionId: string | undefined): string {
  return pause.options.find((option) => option.id === optionId)?.text ?? "";
}

/**
 * Step through a program line by line and watch its variables change. At each pause the learner
 * predicts a value before stepping on to see it; the predictions are the answer. After the check
 * every pause shows the traced value next to the prediction, and the run can still be replayed.
 */
export function CodeTracerActivity({
  answer,
  content,
  expected,
  labelId,
  onAnswerChange,
  phase,
}: CodeTracerProps) {
  const t = useExtracted();
  const { fields } = content;
  const isChecked = phase === "checked";
  const start = firstStep(fields.pauses);
  const [step, setStep] = useState(start);
  const [furthest, setFurthest] = useState(start);

  const [predictions, setPredictions] = useState<Record<string, string>>(() =>
    answer?.kind === "assignment" ? answer.pairs : {},
  );

  const expectedPairs = expectedInteraction(expected, "assignment")?.pairs ?? null;
  const lastStep = fields.trace.length - 1;
  const blocking = isChecked ? null : blockingPause({ pauses: fields.pauses, predictions, step });
  const upcoming = isChecked ? null : upcomingPause(fields.pauses, step);
  const isRevealed = (pause: Pause) => isChecked || furthest >= pause.step;
  const values = watchedValues({ step, trace: fields.trace, watch: fields.watch });

  function goTo(next: number) {
    setStep(next);
    setFurthest((current) => Math.max(current, next));
  }

  function predict(index: number, optionId: string) {
    const next = { ...predictions, [String(index)]: optionId };
    setPredictions(next);
    onAnswerChange(tracerAnswer(fields.pauses, next));
  }

  const revealed = fields.pauses.flatMap((pause, index) => {
    const guess = predictions[String(index)];

    if (!isRevealed(pause) || guess === undefined) {
      return [];
    }

    const rightId = expectedPairs?.[String(index)];
    const traced = tracedText(fields, pause);

    const isRight =
      rightId === undefined ? optionText(pause, guess).trim() === traced : guess === rightId;

    return [{ guess: optionText(pause, guess), isRight, question: pause.question, traced }];
  });

  const position =
    step < 0
      ? t("Before the first line")
      : t("Step {current} of {total}", { current: String(step + 1), total: String(lastStep + 1) });

  return (
    <ActivityCanvas className="gap-3" labelId={labelId}>
      <TracerVariables values={values} />

      <div className="bg-background flex flex-col gap-1 rounded-3xl border px-2 pt-2 pb-2.5">
        <div className="pl-2">
          <TracerControls
            canGoBack={step > start}
            canGoForward={step < lastStep && !blocking}
            label={position}
            onBack={() => goTo(step - 1)}
            onForward={() => goTo(step + 1)}
          />
        </div>

        <TracerCode
          code={fields.code}
          currentLine={fields.trace[step]?.line ?? null}
          language={fields.language}
        />
      </div>

      {upcoming && !isRevealed(upcoming.pause) && (
        <div className="flex flex-col gap-2 pt-1" data-slot="code-tracer-prediction">
          <p className="text-base leading-snug font-medium">
            <LessonRichText text={upcoming.pause.question} />
          </p>

          <ActivitySelectGrid
            className="font-mono"
            columns={optionColumns(upcoming.pause.options)}
            label={upcoming.pause.question}
          >
            {upcoming.pause.options.map((option) => (
              <ActivitySelectGridItem
                isSelected={predictions[String(upcoming.index)] === option.id}
                key={option.id}
                onToggle={() => predict(upcoming.index, option.id)}
              >
                {option.text}
              </ActivitySelectGridItem>
            ))}
          </ActivitySelectGrid>

          <p className="text-muted-foreground text-xs">
            {predictions[String(upcoming.index)] === undefined
              ? t("Predict first. Then step forward to see what happens.")
              : t("Step forward to see if you're right.")}
          </p>
        </div>
      )}

      {!isChecked && !(upcoming && !isRevealed(upcoming.pause)) && (
        <p className="text-muted-foreground text-xs">
          {step < lastStep
            ? t("Step forward to run the next line.")
            : t("That's the whole run. Check your predictions when you're ready.")}
        </p>
      )}

      <TracerPredictionLog results={revealed} />

      <ActivityTextAlternative>
        {[
          position,
          step >= 0 && t("Line {line} ran.", { line: String(fields.trace[step]?.line ?? "") }),
          values
            .map((item) =>
              item.value === null
                ? null
                : t("{name} is {value}", { name: item.name, value: item.value }),
            )
            .filter(Boolean)
            .join(", "),
        ]
          .filter(Boolean)
          .join(" ")}
      </ActivityTextAlternative>
    </ActivityCanvas>
  );
}
