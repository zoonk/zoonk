"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { useId, useState } from "react";
import { LessonRichText } from "../../lesson/_components/lesson-rich-text";
import {
  ActivityCanvas,
  ActivityCanvasLabel,
  ActivityTextAlternative,
} from "../_components/activity-canvas";
import { ActivitySnippetBar, useInsertSnippet } from "../_components/activity-code";
import { type CodeSnippet } from "../_utils/insert-at-cursor";
import { type ActivityRendererProps } from "../activity-renderer";
import { FormulaExamples } from "./formula-examples";
import { PatternHints } from "./pattern-hints";
import { countPassing, testFormula, testRegex } from "./pattern-results";
import { RegexSampleList } from "./regex-samples";

type PatternTesterProps = ActivityRendererProps<"patternTester">;
type Fields = PatternTesterProps["content"]["fields"];
type NamedSnippet = CodeSnippet & { label: string; name: string };

const REGEX_DELIMITER = "/";

function useRegexSnippets(): NamedSnippet[] {
  const t = useExtracted();

  return [
    { before: "^", label: "^", name: t("Start of the text") },
    { before: "$", label: "$", name: t("End of the text") },
    { before: "\\d", label: "\\d", name: t("Any digit") },
    { before: "\\w", label: "\\w", name: t("Any letter, digit or underscore") },
    { before: "\\s", label: "\\s", name: t("Any space") },
    { before: ".", label: ".", name: t("Any character") },
    { after: "]", before: "[", label: "[ ]", name: t("One of these characters") },
    { after: "}", before: "{", label: "{ }", name: t("Repeat a number of times") },
    { after: ")", before: "(", label: "( )", name: t("Group") },
    { before: "?", label: "?", name: t("Optional") },
    { before: "+", label: "+", name: t("One or more") },
    { before: "*", label: "*", name: t("Zero or more") },
    { before: "|", label: "|", name: t("Or") },
  ];
}

function useFormulaSnippets(fields: Fields): NamedSnippet[] {
  const t = useExtracted();

  const names =
    fields.mode === "formula" ? (fields.examples[0]?.inputs.map((input) => input.name) ?? []) : [];

  return [
    ...names.map((name) => ({ before: name, label: name, name })),
    // "Plus sign", not "Plus": that's the subscription's name, and the same English shares one translation.
    { before: "+", label: "+", name: t("Plus sign") },
    { before: "-", label: "−", name: t("Minus") },
    { before: "*", label: "×", name: t("Times") },
    { before: "/", label: "÷", name: t("Divided by") },
    { before: "^", label: "^", name: t("To the power of") },
    { after: ")", before: "(", label: "( )", name: t("Parentheses") },
  ];
}

/** How many examples the current pattern gets right, for the summary and the text alternative. */
function passingSummary(
  fields: Fields,
  pattern: string,
): { passing: number; total: number } | null {
  if (fields.mode === "formula") {
    const results = testFormula(pattern, {
      examples: fields.examples.map((example) => ({
        inputs: Object.fromEntries(example.inputs.map((input) => [input.name, input.value])),
        output: example.output,
      })),
      tolerance: fields.tolerance,
    });

    return pattern.trim() ? { passing: countPassing(results), total: results.length } : null;
  }

  const results = testRegex(pattern, fields);

  return results.status === "tested"
    ? {
        passing: countPassing([...results.shouldMatch, ...results.shouldNotMatch]),
        total: fields.shouldMatch.length + fields.shouldNotMatch.length,
      }
    : null;
}

/**
 * Write a regular expression or a spreadsheet formula and watch it tested against every example
 * as you type, the same way grading tests it. Symbol buttons save hunting on a phone keyboard,
 * and hints come one at a time on request. After the check, a pattern that works is shown.
 */
export function PatternTesterActivity({
  answer,
  content,
  labelId,
  onAnswerChange,
  phase,
}: PatternTesterProps) {
  const t = useExtracted();
  const inputId = useId();
  const { fields } = content;
  const isChecked = phase === "checked";
  const isRegex = fields.mode === "regex";
  const [pattern, setPattern] = useState(answer?.kind === "pattern" ? answer.pattern : "");
  const regexSnippets = useRegexSnippets();
  const formulaSnippets = useFormulaSnippets(fields);
  const summary = passingSummary(fields, pattern);

  function change(next: string) {
    setPattern(next);
    onAnswerChange(next.trim() ? { kind: "pattern", pattern: next } : null);
  }

  const { fieldRef, insert } = useInsertSnippet({ onChange: change, value: pattern });

  return (
    <ActivityCanvas className="gap-4" labelId={labelId}>
      <p className="text-base leading-snug font-medium">
        <LessonRichText text={fields.task} />
      </p>

      <div className="flex flex-col gap-2">
        <label className="sr-only" htmlFor={inputId}>
          {isRegex ? t("Your pattern") : t("Your formula")}
        </label>

        <div
          className={cn(
            "bg-background focus-within:border-primary flex h-14 items-center gap-0.5 rounded-2xl border-2 px-4 font-mono text-xl",
            isChecked && "opacity-80",
          )}
        >
          {isRegex && (
            <span aria-hidden="true" className="text-muted-foreground">
              {REGEX_DELIMITER}
            </span>
          )}

          <input
            autoCapitalize="off"
            autoComplete="off"
            autoCorrect="off"
            className="placeholder:text-muted-foreground h-full min-w-0 flex-1 bg-transparent outline-none"
            id={inputId}
            onChange={(event) => change(event.target.value)}
            placeholder={isRegex ? undefined : "=A1*B1"}
            readOnly={isChecked}
            ref={fieldRef}
            spellCheck={false}
            value={pattern}
          />

          {isRegex && (
            <span aria-hidden="true" className="text-muted-foreground">
              {REGEX_DELIMITER}
            </span>
          )}
        </div>

        {!isChecked && (
          <ActivitySnippetBar
            label={t("Symbols")}
            onInsert={insert}
            snippets={isRegex ? regexSnippets : formulaSnippets}
          />
        )}
      </div>

      <PatternExamples fields={fields} pattern={pattern} />

      <p aria-live="polite" className="sr-only">
        {summary &&
          t("{passing} of {total} examples pass.", {
            passing: String(summary.passing),
            total: String(summary.total),
          })}
      </p>

      <PatternHints hints={fields.hints} isChecked={isChecked} />

      {isChecked && (
        <div className="flex flex-col gap-1">
          <ActivityCanvasLabel className="font-medium">
            {isRegex ? t("A pattern that works") : t("A formula that works")}
          </ActivityCanvasLabel>
          <code className="bg-background w-fit rounded-xl border px-3 py-2 font-mono text-base break-all">
            {isRegex ? `/${fields.solution}/` : `=${fields.solution}`}
          </code>
        </div>
      )}

      <ActivityTextAlternative>
        {isRegex
          ? t(
              "A text box for a regular expression, tested live against examples that should and shouldn't match.",
            )
          : t("A text box for a spreadsheet formula, tested live against example cells.")}
      </ActivityTextAlternative>
    </ActivityCanvas>
  );
}

function PatternExamples({ fields, pattern }: { fields: Fields; pattern: string }) {
  const t = useExtracted();

  if (fields.mode === "formula") {
    const examples = fields.examples.map((example) => ({
      inputs: Object.fromEntries(example.inputs.map((input) => [input.name, input.value])),
      output: example.output,
    }));

    return (
      <FormulaExamples
        examples={fields.examples}
        results={
          pattern.trim() ? testFormula(pattern, { examples, tolerance: fields.tolerance }) : null
        }
      />
    );
  }

  const results = testRegex(pattern, fields);
  const tested = results.status === "tested" ? results : null;

  return (
    <div className="flex flex-col gap-3">
      {results.status === "invalid" && (
        <p className="text-destructive text-sm" role="status">
          {t(
            "This pattern can't run. Check that brackets close, and don't repeat a group that already repeats inside.",
          )}
        </p>
      )}

      <RegexSampleList
        label={t("Should match")}
        results={tested?.shouldMatch ?? null}
        samples={fields.shouldMatch}
        shouldMatch
      />

      <RegexSampleList
        label={t("Should not match")}
        results={tested?.shouldNotMatch ?? null}
        samples={fields.shouldNotMatch}
        shouldMatch={false}
      />
    </div>
  );
}
