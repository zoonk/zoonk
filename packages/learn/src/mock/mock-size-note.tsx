"use client";

import { type ExamDocument } from "@zoonk/core/exams/document";
import { type MockSizeSource } from "@zoonk/core/exams/mocks/view-contract";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { getSourceHost } from "../_utils/source-host";
import { useFormatDuration } from "../_utils/time-format";

type Size = { minutes: number; questions: number };

function PastEditionLine({ source }: { source: NonNullable<MockSizeSource["pastEdition"]> }) {
  const t = useExtracted();
  const publisher = getSourceHost(source.url);

  const link = (chunks: React.ReactNode) => (
    <a
      className="hover:text-foreground underline underline-offset-2"
      href={source.url}
      rel="noreferrer"
      target="_blank"
    >
      {chunks}
    </a>
  );

  return (
    <p>
      {source.edition
        ? t.rich(
            "Questions per subject in the {edition}, as counted by <link>{publisher}</link>.",
            { edition: source.edition, link, publisher },
          )
        : t.rich(
            "Questions per subject in the latest exam, as counted by <link>{publisher}</link>.",
            { link, publisher },
          )}
    </p>
  );
}

function useUnstatedLines({
  document,
  size,
  source,
}: {
  document: ExamDocument;
  size: Size;
  source: MockSizeSource;
}): string[] {
  const t = useExtracted();
  const duration = useFormatDuration();
  const count = { count: size.questions, document, time: duration(size.minutes) };

  if (source.material) {
    return [
      (source.questions === "unstated" || source.time === "unstated") &&
        t(
          "Your material doesn't say how long the test is. This mock asks {count, plural, one {# question} other {# questions}} in {time}.",
          count,
        ),
      source.formats === "even" &&
        t("Your material doesn't say how many questions each format has, so they're split evenly."),
    ].filter((line) => typeof line === "string");
  }

  return [
    source.questions === "unstated" &&
      t(
        "{document, select, notice {The notice doesn't say how many questions the exam has.} other {The official guide doesn't say how many questions the exam has.}} This mock asks {count, plural, one {# question} other {# questions}}.",
        count,
      ),
    source.questions === "pastEdition" &&
      t(
        "{document, select, notice {The notice doesn't say how many questions the exam has.} other {The official guide doesn't say how many questions the exam has.}} This mock asks {count, plural, one {# question} other {# questions}}, as a past edition did.",
        count,
      ),
    source.subjects === "even" &&
      t(
        "{document, select, notice {The notice doesn't say how many questions each subject has, so they're split evenly.} other {The official guide doesn't say how many questions each part has, so they're split evenly.}}",
        { document },
      ),
    source.formats === "even" &&
      t(
        "{document, select, notice {The notice doesn't say how many questions each format has, so they're split evenly.} other {The official guide doesn't say how many questions each format has, so they're split evenly.}}",
        { document },
      ),
    source.time === "unstated" &&
      t(
        "{document, select, notice {The notice doesn't give the exam's time.} other {The official guide doesn't give the exam's time.}} This mock gives {time}.",
        count,
      ),
  ].filter((line) => typeof line === "string");
}

export function MockSizeNote({
  className,
  document,
  size,
  source,
}: {
  className?: string;
  document: ExamDocument;
  size: Size;
  source: MockSizeSource;
}) {
  const lines = useUnstatedLines({ document, size, source });

  if (lines.length === 0 && !source.pastEdition) {
    return null;
  }

  return (
    <div className={cn("text-muted-foreground flex flex-col gap-1 text-xs", className)}>
      {source.pastEdition && <PastEditionLine source={source.pastEdition} />}
      {lines.map((line) => (
        <p key={line}>{line}</p>
      ))}
    </div>
  );
}
