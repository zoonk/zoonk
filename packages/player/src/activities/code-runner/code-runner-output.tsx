"use client";

import { PROGRAM_TIME_LIMIT_MS } from "@zoonk/core/library/activities/program-limits";
import { cn } from "@zoonk/ui/lib/utils";
import { CircleX } from "lucide-react";
import { useExtracted } from "next-intl";
import { LessonRichText } from "../../lesson/_components/lesson-rich-text";
import { type ProgramRun } from "../_sandbox/run-program";

const MS_PER_SECOND = 1000;

function OutputCell({
  children,
  className,
  label,
}: {
  children: React.ReactNode;
  className?: string;
  label: string;
}) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-0.5 px-4 py-3", className)}>
      <p className="text-muted-foreground text-xs font-medium">{label}</p>
      <div className="overflow-x-auto">{children}</div>
    </div>
  );
}

function OutputText({ className, text }: { className?: string; text: string }) {
  return (
    <pre className={cn("font-mono text-lg font-semibold whitespace-pre", className)}>{text}</pre>
  );
}

function StopNotice({ language, run }: { language: "javascript" | "python"; run: ProgramRun }) {
  const t = useExtracted();
  const seconds = String(PROGRAM_TIME_LIMIT_MS[language] / MS_PER_SECOND);

  const message = (() => {
    if (run.stop === "error" && run.error) {
      return run.error.line === null
        ? run.error.message
        : t("Line {line}: {error}", { error: run.error.message, line: String(run.error.line) });
    }

    if (run.stop === "timeout") {
      return t("Stopped after {seconds} seconds. Is there a loop that never ends?", { seconds });
    }

    if (run.stop === "tooMuchOutput") {
      return t("Stopped because it printed too much. Is there a loop that never ends?");
    }

    return null;
  })();

  if (!message) {
    return null;
  }

  return (
    <p className="text-destructive-text flex gap-2 font-mono text-sm leading-snug" role="status">
      <CircleX aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <span className="min-w-0 wrap-break-word">{message}</span>
    </p>
  );
}

function PrintedOutput({
  hasTarget,
  matches,
  run,
}: {
  hasTarget: boolean;
  matches: boolean;
  run: ProgramRun | null;
}) {
  const t = useExtracted();

  if (run === null) {
    return <p className="text-muted-foreground py-1 text-sm">{t("Run the code to see it")}</p>;
  }

  if (run.output === "") {
    return <p className="text-muted-foreground py-1 text-sm">{t("Nothing printed")}</p>;
  }

  return (
    <OutputText
      className={cn(hasTarget && (matches ? "text-success-text" : "text-destructive-text"))}
      text={run.output.trimEnd()}
    />
  );
}

export function CodeRunnerOutput({
  expectedOutput,
  isStale,
  language,
  matches,
  mistake,
  run,
}: {
  expectedOutput: string | null;
  isStale: boolean;
  language: "javascript" | "python";
  matches: boolean;
  mistake: string | null;
  run: ProgramRun | null;
}) {
  const t = useExtracted();

  return (
    <div className="flex flex-col gap-3">
      <div
        className={cn(
          "bg-background grid overflow-hidden rounded-xl border",
          expectedOutput !== null && "grid-cols-2",
        )}
      >
        <OutputCell
          className={cn(isStale && run && "opacity-60")}
          label={expectedOutput === null ? t("Output") : t("Your output")}
        >
          <PrintedOutput
            hasTarget={expectedOutput !== null && !isStale}
            matches={matches}
            run={run}
          />
        </OutputCell>

        {expectedOutput !== null && (
          <OutputCell className="border-l" label={t("Expected")}>
            <OutputText text={expectedOutput.trimEnd()} />
          </OutputCell>
        )}
      </div>

      {isStale && run && (
        <p className="text-muted-foreground text-xs">
          {t("You changed the code. Run it again to see the new output.")}
        </p>
      )}

      {run && !isStale && <StopNotice language={language} run={run} />}

      {run?.errorOutput && !isStale && (
        <pre className="text-muted-foreground overflow-x-auto font-mono text-xs whitespace-pre">
          {run.errorOutput}
        </pre>
      )}

      {mistake && !isStale && (
        <p className="flex gap-2.5 text-sm leading-relaxed">
          <CircleX aria-hidden="true" className="text-destructive-text mt-0.5 size-4 shrink-0" />
          <span>
            <span className="text-destructive-text font-semibold">{t("Not quite:")}</span>{" "}
            <LessonRichText text={mistake} />
          </span>
        </p>
      )}
    </div>
  );
}
