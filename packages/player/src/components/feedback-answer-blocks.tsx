"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { CircleCheck, CircleX } from "lucide-react";
import { useExtracted } from "next-intl";
import { PlayerRichText } from "./player-rich-text";
import { RomanizationText } from "./romanization-text";

/**
 * Feedback rows repeat learner-facing answer text that may have already been
 * shown as rich option copy during play. Rendering it through the shared rich
 * text path keeps LaTeX, lightweight formatting, name replacement, and quote
 * cleanup consistent between the prompt and result screens.
 */
function FeedbackAnswerText({ text }: { text: string }) {
  return <PlayerRichText text={text} />;
}

function AnswerLine({
  children,
  icon,
  label,
  variant,
}: {
  children: React.ReactNode;
  icon: React.ReactNode;
  label: string;
  variant: "correct" | "incorrect";
}) {
  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-lg px-3 py-2 text-sm",
        variant === "correct" ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive",
      )}
    >
      <span className="mt-0.5 shrink-0">{icon}</span>
      <div>
        <span className="text-muted-foreground">{label}</span>{" "}
        <span className="font-medium">{children}</span>
      </div>
    </div>
  );
}

export function CorrectAnswerBlock({
  romanization,
  selectedText,
}: {
  romanization: string | null;
  selectedText: string;
}) {
  const t = useExtracted();

  return (
    <AnswerLine
      icon={<CircleCheck aria-hidden="true" className="size-4" />}
      label={t("Your answer:")}
      variant="correct"
    >
      <span className="flex flex-col">
        <span>
          <FeedbackAnswerText text={selectedText} />
        </span>
        <RomanizationText>{romanization}</RomanizationText>
      </span>
    </AnswerLine>
  );
}

export function IncorrectAnswerBlock({
  correctAnswer,
  romanization,
  selectedText,
}: {
  correctAnswer?: string | null;
  romanization: string | null;
  selectedText: string | null;
}) {
  const t = useExtracted();

  return (
    <>
      {selectedText && (
        <AnswerLine
          icon={<CircleX aria-hidden="true" className="size-4" />}
          label={t("Your answer:")}
          variant="incorrect"
        >
          <FeedbackAnswerText text={selectedText} />
        </AnswerLine>
      )}
      {correctAnswer && (
        <AnswerLine
          icon={<CircleCheck aria-hidden="true" className="size-4" />}
          label={t("Correct answer:")}
          variant="correct"
        >
          <span className="flex flex-col">
            <span>
              <FeedbackAnswerText text={correctAnswer} />
            </span>
            <RomanizationText>{romanization}</RomanizationText>
          </span>
        </AnswerLine>
      )}
    </>
  );
}
