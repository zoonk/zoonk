"use client";

import { type PlanPhaseView } from "@zoonk/core/plans/view-contract";
import { type SyllabusSubject, type SyllabusView } from "@zoonk/core/view-models/syllabus/contract";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  FoldChevron,
} from "@zoonk/ui/components/collapsible";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { useId } from "react";
import {
  LIST_ROW_INTERACTIVE_CLASS,
  ListRow,
  ListRowBody,
  ListRowChevronSpace,
  ListRowContent,
  ListRowDescription,
  ListRowTitle,
  ListRowTrailing,
  ROW_FOLD_CLASS,
} from "../../_components/list-group";
import { PageSection, PageSectionHeader, PageSectionTitle } from "../../_components/page";
import { useExamQuestionCount } from "../../exam/use-exam-question-count";
import {
  JourneyChapters,
  LeftOutTopicsRow,
  hasListedChapters,
} from "../../journey/journey-chapters";
import {
  PATH_ROW_CLASS,
  PATH_ROW_LEADING_CLASS,
  PathRowBody,
} from "../../journey/journey-phase-events";
import { PHASE_END_CLASS, PhaseMark, usePhaseRowName } from "../../journey/path-phase-row";
import { PhaseWhen } from "../../journey/phase-when";
import { usePlanScreen } from "../../plan/plan-context";
import { LeftOutTopicsLine } from "../../syllabus/left-out-topics";
import { namesModules } from "../../syllabus/names-modules";
import { SubjectGroups } from "../../syllabus/subject-groups";
import { TopicChapters } from "../../syllabus/subject-topic-chapters";
import { SubjectTopics } from "../../syllabus/subject-topics";
import { hasSyllabusSection } from "../../syllabus/syllabus-section";
import { useNotPlannedReason } from "../../syllabus/topic-note";

function PhaseRow({ alignChevron, phase }: { alignChevron: boolean; phase: PlanPhaseView }) {
  const phaseRowName = usePhaseRowName();

  const row = (
    <>
      <span className={PATH_ROW_LEADING_CLASS} data-slot="path-row-mark">
        <PhaseMark phase={phase} />
      </span>
      <PathRowBody value={<PhaseWhen className={PHASE_END_CLASS} phase={phase} />}>
        <span className="font-medium">{phaseRowName(phase)}</span>
        <LeftOutTopicsLine count={phase.leftOut.length} />
      </PathRowBody>
    </>
  );

  if (!hasListedChapters(phase.chapters) && phase.leftOut.length === 0) {
    return (
      <div className={PATH_ROW_CLASS} data-slot="path-row">
        {row}
        {alignChevron && <ListRowChevronSpace />}
      </div>
    );
  }

  return (
    <Collapsible>
      <CollapsibleTrigger className={cn(PATH_ROW_CLASS, "hover:bg-muted/70")} data-slot="path-row">
        {row}
        <FoldChevron />
      </CollapsibleTrigger>

      <CollapsibleContent className={ROW_FOLD_CLASS}>
        <div className="nested-rows flex flex-col pb-2" data-slot="path-nested">
          <JourneyChapters
            chapters={phase.chapters}
            leftOut={phase.leftOut}
            links={null}
            phase={null}
          />
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function RevealPath() {
  const t = useExtracted();
  const titleId = useId();
  const { plan } = usePlanScreen();
  const [only, ...rest] = plan.phases;

  if (!only) {
    return null;
  }

  return (
    <PageSection aria-labelledby={titleId} data-slot="reveal-structure">
      <PageSectionHeader>
        <PageSectionTitle id={titleId}>{t("Your path")}</PageSectionTitle>
      </PageSectionHeader>

      {rest.length === 0 && hasListedChapters(only.chapters) ? (
        <JourneyChapters
          chapters={only.chapters}
          leftOut={only.leftOut}
          links={null}
          phase={null}
        />
      ) : (
        <ol className="flex flex-col [&>li+li]:border-t" data-slot="journey-path-list">
          {plan.phases.map((phase) => (
            <li key={phase.index}>
              <PhaseRow alignChevron={rest.length > 0} phase={phase} />
            </li>
          ))}
        </ol>
      )}
    </PageSection>
  );
}

function useSubjectLine({ isModule }: { isModule: boolean }) {
  const t = useExtracted();
  const reasonText = useNotPlannedReason({ isModule });

  return function subjectLine(subject: SyllabusSubject): string | null {
    if (subject.notPlannedReason) {
      return reasonText(subject.notPlannedReason);
    }

    if (subject.topics.length > 0) {
      return t("{total, plural, one {# topic} other {# topics}}", { total: subject.topics.length });
    }

    return subject.chapters.length > 0
      ? t("{count, plural, one {# chapter} other {# chapters}}", { count: subject.chapters.length })
      : null;
  };
}

function SubjectRow({ isModule, subject }: { isModule: boolean; subject: SyllabusSubject }) {
  const questionCount = useExamQuestionCount();
  const subjectLine = useSubjectLine({ isModule });
  const titleId = useId();
  const line = subjectLine(subject);

  const row = (
    <ListRowBody>
      <ListRowContent>
        <ListRowTitle
          className={cn("wrap-anywhere", subject.notPlannedReason && "text-muted-foreground")}
          id={titleId}
        >
          {subject.shortName}
        </ListRowTitle>
        {line && <ListRowDescription>{line}</ListRowDescription>}
        <LeftOutTopicsLine count={subject.leftOut.length} />
      </ListRowContent>
      <ListRowTrailing className="hidden empty:hidden @lg/structure:flex">
        {subject.questions !== null && subject.questions > 0 && questionCount(subject.questions)}
      </ListRowTrailing>
    </ListRowBody>
  );

  if (
    subject.topics.length === 0 &&
    subject.chapters.length === 0 &&
    subject.leftOut.length === 0
  ) {
    return (
      <ListRow>
        {row}
        <ListRowChevronSpace />
      </ListRow>
    );
  }

  return (
    <Collapsible>
      <CollapsibleTrigger className={LIST_ROW_INTERACTIVE_CLASS}>
        {row}
        <FoldChevron />
      </CollapsibleTrigger>

      <CollapsibleContent className={ROW_FOLD_CLASS}>
        <div className="flex flex-col gap-3 pb-4">
          {subject.topics.length > 0 ? (
            <SubjectTopics chapterHref={null} labelledBy={titleId} topics={subject.topics} />
          ) : (
            <TopicChapters chapterHref={null} chapters={subject.chapters} />
          )}
          {subject.leftOut.length > 0 && (
            <LeftOutTopicsRow className="min-h-control" names={subject.leftOut} />
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function RevealSubjects({ syllabus }: { syllabus: SyllabusView }) {
  const t = useExtracted();
  const titleId = useId();
  const isModule = namesModules(syllabus.goal.kind);

  return (
    <PageSection
      aria-labelledby={titleId}
      className="@container/structure"
      data-slot="reveal-structure"
    >
      <PageSectionHeader>
        <PageSectionTitle id={titleId}>{isModule ? t("Modules") : t("Subjects")}</PageSectionTitle>
      </PageSectionHeader>

      <SubjectGroups
        renderSubject={(subject) => <SubjectRow isModule={isModule} subject={subject} />}
        syllabus={syllabus}
        titleId={titleId}
      />
    </PageSection>
  );
}

/**
 * Everything the plan holds, in the groups the Plan page shows it in: an exam's subjects with their
 * topics, or the path's phases with their chapters. Each group opens in place, and nothing here
 * leaves the screen: changing the plan is "Adjust plan".
 */
export function RevealStructure({ syllabus }: { syllabus: SyllabusView | null }) {
  return hasSyllabusSection(syllabus) ? <RevealSubjects syllabus={syllabus} /> : <RevealPath />;
}
