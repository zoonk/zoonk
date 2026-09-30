"use client";

import { type ExamResultInput } from "@zoonk/core/exams/results/contract";
import { Button } from "@zoonk/ui/components/button";
import { Input } from "@zoonk/ui/components/input";
import { Label } from "@zoonk/ui/components/label";
import { LineMarker } from "@zoonk/ui/components/line-marker";
import { RadioGroup, RadioGroupItem } from "@zoonk/ui/components/radio-group";
import { CircleCheckIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useId, useState } from "react";
import { FUN_PRIMARY_BUTTON_CLASS } from "../_utils/fun-primary";
import { useExamScreen } from "./exam-context";

const PASSED_VALUES = ["yes", "no", "unknown"] as const;

type Passed = (typeof PASSED_VALUES)[number];

/** Options share the row but never squeeze a label ("Noch nicht") onto two lines; they wrap instead. */
const OPTION_CLASS =
  "border-border has-data-checked:border-foreground in-data-[mode=fun]:has-data-checked:border-fun-lime flex min-h-11 min-w-max flex-1 cursor-pointer items-center gap-2 rounded-2xl border px-3 text-sm";

function toPassed(value: Passed): boolean | null {
  if (value === "unknown") {
    return null;
  }

  return value === "yes";
}

/**
 * The exam's own scale for the score: SAT, AP or TOEFL scores as those exams report them, IRT
 * points for ENEM-style exams, plain points otherwise.
 */
function useScale(): NonNullable<ExamResultInput["scale"]> {
  const { exam } = useExamScreen();
  return exam.scoring.scale ?? (exam.scoring.method === "irt" ? "irt" : "points");
}

type ScoreField = { label: string; max?: number; min: number; step?: number };

/** The score field for the scale: its label and the values the exam can report. */
function useScoreField(scale: NonNullable<ExamResultInput["scale"]>): ScoreField {
  const t = useExtracted();
  const plain = { label: t("Your score"), min: 0 };

  const fields: Record<typeof scale, ScoreField> = {
    ap: { label: t("Your AP score (1 to 5)"), max: 5, min: 1, step: 1 },
    irt: { label: t("Your score (the average, if there are several)"), min: 0 },
    percent: plain,
    points: plain,
    sat: { label: t("Your total score (400 to 1600)"), max: 1600, min: 400, step: 10 },
    toefl: { label: t("Your total band (1 to 6)"), max: 6, min: 1, step: 0.5 },
  };

  return fields[scale];
}

function ReportedResult() {
  const t = useExtracted();
  const { exam } = useExamScreen();
  const { result } = exam;

  if (!result) {
    return null;
  }

  return (
    <p className="flex items-start gap-2 text-sm" role="status">
      <LineMarker aria-hidden="true">
        <CircleCheckIcon className="text-success size-4" />
      </LineMarker>
      {result.score === null
        ? t("Result saved. Thank you for telling us.")
        : t("Result saved: {score}. Thank you for telling us.", { score: String(result.score) })}
    </p>
  );
}

/**
 * "How did it go?": the official result, whenever it comes out. The score is optional and so is
 * knowing whether they passed; either is enough. It helps make estimates more accurate for everyone.
 */
export function ExamResultSection() {
  const t = useExtracted();
  const { actions, exam } = useExamScreen();
  const scale = useScale();
  const field = useScoreField(scale);
  const scoreId = useId();
  const maxId = useId();
  const [passed, setPassed] = useState<Passed>("unknown");
  const [score, setScore] = useState("");
  const [maxScore, setMaxScore] = useState("");
  const [status, setStatus] = useState<"error" | "idle" | "pending" | "saved">("idle");

  if (exam.stage !== "afterExam" && exam.stage !== "examDay") {
    return null;
  }

  const parsedScore = score.trim() === "" ? null : Number(score);
  const parsedMax = maxScore.trim() === "" ? null : Number(maxScore);
  const canSave = parsedScore !== null || passed !== "unknown";

  async function submit() {
    setStatus("pending");

    const saved = await actions.report({
      maxScore: scale === "points" ? parsedMax : null,
      passed: toPassed(passed),
      scale: parsedScore === null ? null : scale,
      score: parsedScore,
    });

    setStatus(saved ? "saved" : "error");
  }

  return (
    <section
      aria-labelledby="exam-result-title"
      className="border-border in-data-[mode=fun]:fun-glass flex flex-col gap-4 rounded-3xl border p-5 in-data-[mode=fun]:border-transparent"
    >
      <div className="flex flex-col gap-1">
        <h2 className="in-data-[mode=fun]:font-fun-display font-semibold" id="exam-result-title">
          {t("How did it go?")}
        </h2>
        <p className="text-muted-foreground text-sm">
          {t("Add your official result when it comes out. You can change it later.")}
        </p>
      </div>

      {status === "saved" || (exam.result && status === "idle") ? <ReportedResult /> : null}

      <form
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <div className="flex flex-col gap-2">
          <Label htmlFor={scoreId}>{field.label}</Label>
          <div className="flex items-center gap-2">
            <Input
              id={scoreId}
              inputMode="decimal"
              max={field.max}
              min={field.min}
              onChange={(event) => setScore(event.target.value)}
              step={field.step}
              type="number"
              value={score}
            />
            {scale === "points" && (
              <>
                <Label className="text-muted-foreground shrink-0 font-normal" htmlFor={maxId}>
                  {t("out of")}
                </Label>
                <Input
                  id={maxId}
                  inputMode="decimal"
                  min={0}
                  onChange={(event) => setMaxScore(event.target.value)}
                  type="number"
                  value={maxScore}
                />
              </>
            )}
          </div>
        </div>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-medium">{t("Did you pass?")}</legend>
          <RadioGroup
            className="flex flex-wrap gap-2"
            onValueChange={(value) =>
              setPassed(PASSED_VALUES.find((option) => option === value) ?? "unknown")
            }
            value={passed}
          >
            {(
              [
                ["yes", t("Yes")],
                ["no", t("No")],
                ["unknown", t("Not yet")],
              ] as const
            ).map(([value, label]) => (
              <Label className={OPTION_CLASS} key={value}>
                <RadioGroupItem value={value} />
                {label}
              </Label>
            ))}
          </RadioGroup>
        </fieldset>

        {status === "error" && (
          <p className="text-destructive text-sm" role="alert">
            {t("That didn't go through. Try again in a moment.")}
          </p>
        )}

        <Button
          className={FUN_PRIMARY_BUTTON_CLASS}
          disabled={!canSave || status === "pending"}
          type="submit"
        >
          {t("Save my result")}
        </Button>
      </form>
    </section>
  );
}
