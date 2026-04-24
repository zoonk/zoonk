"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { CircleCheck, CircleX } from "lucide-react";
import { useExtracted } from "next-intl";
import { RomanizationText } from "./romanization-text";

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
        variant === "correct" ? "bg-success/10" : "bg-destructive/10",
      )}
    >
      <span
        className={cn(
          "mt-0.5 shrink-0",
          variant === "correct" ? "text-success" : "text-destructive",
        )}
      >
        {icon}
      </span>
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
        <span>{selectedText}</span>
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
          {selectedText}
        </AnswerLine>
      )}
      {correctAnswer && (
        <AnswerLine
          icon={<CircleCheck aria-hidden="true" className="size-4" />}
          label={t("Correct answer:")}
          variant="correct"
        >
          <span className="flex flex-col">
            <span>{correctAnswer}</span>
            <RomanizationText>{romanization}</RomanizationText>
          </span>
        </AnswerLine>
      )}
    </>
  );
}
