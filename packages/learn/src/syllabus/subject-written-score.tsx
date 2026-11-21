"use client";

import { type WrittenPractice } from "@zoonk/core/plans/written-practice-contract";
import { type SyllabusSubject } from "@zoonk/core/view-models/syllabus/contract";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted, useFormatter } from "next-intl";
import {
  ListGroup,
  ListRowBody,
  ListRowContent,
  ListRowDescription,
  ListRowLink,
  ListRowTitle,
  ListRowTrailing,
} from "../_components/list-group";
import {
  PageSection,
  PageSectionDetail,
  PageSectionHeader,
  PageSectionTitle,
} from "../_components/page";
import { StepRow, StepRows } from "../_components/step-card";
import { FactSegments } from "../_components/task-meta";
import { useFormatIsoDate } from "../_utils/iso-date";
import { useFormatScore } from "../essay/essay-labels";
import {
  MinimumLegend,
  PointsMeter,
  PointsReadout,
  getMinimumShare,
} from "../writing/points-readout";
import { useFormatPointsRange } from "../writing/writing-labels";

export type WrittenSubject = NonNullable<WrittenPractice["subjects"]>[number];

const PERCENT = 100;
const TREND_SAMPLES = 4;
/** The shortest bar still reads as a bar, so a zero isn't an empty slot. */
const MIN_BAR_SHARE = 0.2;

export function findWrittenSubject({
  practice,
  subject,
}: {
  practice: WrittenPractice | null;
  subject: SyllabusSubject;
}): WrittenSubject | null {
  return (
    practice?.subjects?.find(({ points }) => subject.areas.some((area) => area === points.name)) ??
    null
  );
}

/** The part's estimated points, its own minimum, and each question's share of them. */
function WrittenPoints({ written }: { written: WrittenSubject }) {
  const t = useExtracted();
  const formatScore = useFormatScore();
  const formatRange = useFormatPointsRange();
  const format = useFormatter();
  const { max, minimum, range, tasks } = written.points;

  const formatShare = (share: number) =>
    format.number(share, { maximumFractionDigits: 0, style: "percent" });

  return (
    <PageSection aria-label={t("Estimated score")}>
      <div className="flex flex-col gap-3">
        <span className="text-muted-foreground text-sm">{t("Estimated score")}</span>
        {range && max !== null ? (
          <PointsReadout max={max} range={range} />
        ) : (
          <p className="text-lg font-semibold">{t("Not measured yet")}</p>
        )}
        {max !== null && (
          <PointsMeter
            max={max}
            minimumShare={minimum && getMinimumShare({ max, minimum })}
            range={range}
          />
        )}
        {minimum && (
          <MinimumLegend>
            {minimum.unit === "percent"
              ? t("Minimum to pass: {share} of the points", {
                  share: formatShare(minimum.value / PERCENT),
                })
              : t("Minimum to pass: {minimum}", { minimum: formatScore(minimum.value) })}
          </MinimumLegend>
        )}
      </div>
      <StepRows>
        {tasks.map((task) => (
          <StepRow key={task.key}>
            <span className="min-w-0 flex-1">{task.name}</span>
            <span className="text-muted-foreground shrink-0 font-mono text-xs tabular-nums">
              {task.range && task.max !== null
                ? t("{range} of {max}", {
                    max: formatScore(task.max),
                    range: formatRange(task.range),
                  })
                : t("Not measured yet")}
            </span>
          </StepRow>
        ))}
      </StepRows>
    </PageSection>
  );
}

/** One small bar per answer, oldest first, the latest in full color. */
function TrendBars({ values }: { values: (number | null)[] }) {
  const peak = Math.max(1, ...values.map((value) => value ?? 0));

  return (
    <span aria-hidden="true" className="flex h-5 shrink-0 items-end gap-0.5">
      {values.map((value, index) => (
        <span
          className={cn(
            "rounded-meter w-1.5",
            index === values.length - 1 ? "bg-success" : "bg-success/40",
            value === null && "bg-surface-3",
          )}
          // oxlint-disable-next-line react/no-array-index-key -- the bars are the answers in order
          key={index}
          style={{ height: `${Math.max(MIN_BAR_SHARE, (value ?? 0) / peak) * PERCENT}%` }}
        />
      ))}
    </span>
  );
}

function TrendRow({
  label,
  last,
  values,
}: {
  label: string;
  last: string;
  values: (number | null)[];
}) {
  if (values.every((value) => value === null)) {
    return null;
  }

  return (
    <StepRow>
      <span className="min-w-0 flex-1">{label}</span>
      <TrendBars values={values} />
      <span className="w-16 shrink-0 text-right font-mono text-xs tabular-nums">{last}</span>
    </StepRow>
  );
}

function WrittenTrend({ written }: { written: WrittenSubject }) {
  const t = useExtracted();
  const format = useFormatter();
  const samples = written.trend.slice(-TREND_SAMPLES);
  const latest = samples.at(-1);

  if (!latest) {
    return null;
  }

  const share = (value: number | null) =>
    value === null ? "" : format.number(value, { maximumFractionDigits: 0, style: "percent" });

  return (
    <PageSection>
      <PageSectionHeader>
        <PageSectionTitle>{t("Your progress")}</PageSectionTitle>
        <PageSectionDetail className="font-mono">
          {t("{count, plural, one {last answer} other {last # answers}}", {
            count: samples.length,
          })}
        </PageSectionDetail>
      </PageSectionHeader>
      <StepRows>
        <TrendRow
          label={t("Content")}
          last={share(latest.contentShare)}
          values={samples.map(({ contentShare }) => contentShare)}
        />
        <TrendRow
          label={t("Presentation and structure")}
          last={share(latest.presentationShare)}
          values={samples.map(({ presentationShare }) => presentationShare)}
        />
        <TrendRow
          label={t("Language errors")}
          last={t("{count, plural, one {# error} other {# errors}}", { count: latest.errors })}
          values={samples.map(({ errors }) => errors)}
        />
      </StepRows>
    </PageSection>
  );
}

type WrittenAnswer = WrittenSubject["answers"][number];

/** The server's count of the lines sent, against the question's limit when it has one. */
function useLineFact() {
  const t = useExtracted();

  return function lineFact({ estimatedLines, lines }: WrittenAnswer): string | null {
    if (estimatedLines === undefined) {
      return lines === null
        ? null
        : t("{count, plural, one {# line} other {# lines}}", { count: lines });
    }

    return lines === null
      ? t("{count, plural, one {about # line} other {about # lines}}", { count: estimatedLines })
      : t("about {used} of {lines} lines", { lines: String(lines), used: String(estimatedLines) });
  };
}

function AnswerRow({ answer, href }: { answer: WrittenAnswer; href: string }) {
  const t = useExtracted();
  const formatDate = useFormatIsoDate();
  const formatRange = useFormatPointsRange();
  const lineFact = useLineFact();

  return (
    <ListRowLink href={href}>
      <ListRowBody>
        <ListRowContent>
          <ListRowTitle>{answer.title}</ListRowTitle>
          <ListRowDescription>
            <FactSegments
              facts={[
                lineFact(answer),
                answer.versions > 1 &&
                  t("{count, plural, one {# version} other {# versions}}", {
                    count: answer.versions,
                  }),
                formatDate(answer.date),
              ]}
            />
          </ListRowDescription>
        </ListRowContent>
        {answer.range && (
          <ListRowTrailing className="font-mono text-xs">
            {formatRange(answer.range)}
          </ListRowTrailing>
        )}
      </ListRowBody>
    </ListRowLink>
  );
}

function WrittenAnswers({
  answerHref,
  written,
}: {
  answerHref: (attemptId: string) => string;
  written: WrittenSubject;
}) {
  const t = useExtracted();

  if (written.answers.length === 0) {
    return null;
  }

  return (
    <PageSection>
      <PageSectionHeader>
        <PageSectionTitle>{t("Your answers")}</PageSectionTitle>
        <PageSectionDetail className="font-mono">{written.answers.length}</PageSectionDetail>
      </PageSectionHeader>
      <ListGroup>
        {written.answers.map((answer) => (
          <AnswerRow answer={answer} href={answerHref(answer.attemptId)} key={answer.attemptId} />
        ))}
      </ListGroup>
    </PageSection>
  );
}

/** A written part's page: where the learner stands in points, how the answers move, and each answer. */
export function SubjectWrittenScore({
  answerHref,
  written,
}: {
  answerHref: (attemptId: string) => string;
  written: WrittenSubject;
}) {
  return (
    <>
      <WrittenPoints written={written} />
      <WrittenTrend written={written} />
      <WrittenAnswers answerHref={answerHref} written={written} />
    </>
  );
}
