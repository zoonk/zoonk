"use client";

import { type SyllabusSubject, type SyllabusView } from "@zoonk/core/view-models/syllabus/contract";
import { BottomBar, BottomBarActions } from "@zoonk/ui/components/bottom-bar";
import { DetailFacts, DetailHero, DetailHeroText, DetailTitle } from "@zoonk/ui/components/detail";
import { useExtracted, useFormatter } from "next-intl";
import {
  DetailAside,
  DetailContent,
  DetailContinueLink,
  DetailLayout,
  useDoneShare,
} from "../_components/detail-page";
import {
  PageSection,
  PageSectionDetail,
  PageSectionHeader,
  PageSectionTitle,
} from "../_components/page";
import { FactSegments } from "../_components/task-meta";
import { ReportProblemMenu } from "../feedback/content-feedback-menu";
import { LearnPageBar } from "../shell/learn-bar";
import { useAlsoIn } from "./shared-exams";
import { SubjectAside, SubjectCoverage } from "./subject-aside";
import { SubjectChapters } from "./subject-chapters";
import { SubjectMatrix } from "./subject-matrix";
import { NotPlannedCallout, type SubjectActions } from "./subject-not-planned";
import { SubjectTopics } from "./subject-topics";
import { WriteBottomBar, useWrittenFacts } from "./subject-write-bar";
import { SubjectWrittenPractice } from "./subject-written-practice";
import {
  SubjectWrittenScore,
  type WrittenSubject,
  findWrittenSubject,
} from "./subject-written-score";
import { TopicFrequencySource } from "./syllabus-notes";
import { getSubjectBar, getSubjectShare, useKnownLine } from "./use-subject-progress";

const TOPICS_TITLE_ID = "subject-topics-title";

type SubjectHrefs = {
  adjust: string;
  /** A past written answer's page; without it the written part lists no answers. */
  answer?: (attemptId: string) => string;
  back: string;
  chapter: (chapterId: string) => string;
  /** An unfinished written task the learner asked for. */
  essay: (blockId: string) => string;
  mindMaps?: (subjectKey: string) => string;
};

/**
 * Where a subject comes from, when its name doesn't say: the exam area it belongs to, the
 * learner's own material, or the plan's lessons beyond the exam's guide.
 */
function useOriginFact({
  fromMaterial,
  kind,
  subject,
}: {
  fromMaterial: boolean;
  kind: SyllabusView["kind"];
  subject: SyllabusSubject;
}): string | null {
  const t = useExtracted();

  if (subject.group) {
    return subject.group;
  }

  if (subject.source === "notice") {
    return fromMaterial ? t("From your material") : null;
  }

  return kind === "notice" ? t("Also in your plan") : null;
}

/** A subject's weight when the exam gives no question count, which Details shows otherwise. */
function useShareFact(subject: SyllabusSubject): string | null {
  const t = useExtracted();
  const format = useFormatter();

  if (subject.questions || subject.share === null) {
    return null;
  }

  return t("{share} of the exam", {
    share: format.number(subject.share, { maximumFractionDigits: 0, style: "percent" }),
  });
}

function useSubjectFacts({
  fromMaterial,
  kind,
  subject,
}: {
  fromMaterial: boolean;
  kind: SyllabusView["kind"];
  subject: SyllabusSubject;
}): string[] {
  const doneShare = useDoneShare();
  const origin = useOriginFact({ fromMaterial, kind, subject });
  const share = useShareFact(subject);
  const inLessons = !subject.notPlannedReason && subject.preparation === null;

  // Topics and chapters count themselves over their lists, and Details names the questions.
  return [origin, share, inLessons && doneShare(getSubjectShare(getSubjectBar(subject)))].filter(
    (fact) => typeof fact === "string",
  );
}

function SubjectFacts({
  fromMaterial,
  kind,
  sharedExams,
  subject,
  written,
}: {
  fromMaterial: boolean;
  kind: SyllabusView["kind"];
  sharedExams: SyllabusView["sharedExams"];
  subject: SyllabusSubject;
  written: WrittenSubject | null;
}) {
  const subjectFacts = useSubjectFacts({ fromMaterial, kind, subject });
  const writtenFacts = useWrittenFacts(written ?? {});
  const known = useKnownLine()(subject);
  const alsoIn = useAlsoIn({ sharedExams, sharedWith: subject.sharedWith });
  const facts = written ? writtenFacts : subjectFacts;

  return (
    <>
      {facts.length > 0 && (
        <DetailFacts>
          <FactSegments facts={facts} />
        </DetailFacts>
      )}
      {known && <DetailFacts className="pt-0 font-sans">{known}</DetailFacts>}
      {alsoIn && <DetailFacts className="pt-0 font-sans">{alsoIn}</DetailFacts>}
    </>
  );
}

/** The subject's main action, pinned under the page: its next chapter to study. */
function SubjectBottomBar({
  chapterHref,
  subject,
}: {
  chapterHref: (chapterId: string) => string;
  subject: SyllabusSubject;
}) {
  const next = subject.chapters.find((chapter) => chapter.state !== "done" && chapter.chapterId);
  const nextId = subject.notPlannedReason ? null : (next?.chapterId ?? null);

  if (!nextId) {
    return null;
  }

  return (
    <BottomBar>
      <BottomBarActions>
        <DetailContinueLink href={chapterHref(nextId)} started={subject.lessonsDone > 0} />
      </BottomBarActions>
    </BottomBar>
  );
}

function SubjectHeader({
  fromMaterial,
  kind,
  sharedExams,
  subject,
  written,
}: {
  fromMaterial: boolean;
  kind: SyllabusView["kind"];
  sharedExams: SyllabusView["sharedExams"];
  subject: SyllabusSubject;
  written: WrittenSubject | null;
}) {
  return (
    <DetailHero>
      <DetailHeroText>
        <DetailTitle>{subject.shortName ?? subject.name}</DetailTitle>
        <SubjectFacts
          fromMaterial={fromMaterial}
          kind={kind}
          sharedExams={sharedExams}
          subject={subject}
          written={written}
        />
      </DetailHeroText>
    </DetailHero>
  );
}

function TopicsSection({
  chapterHref,
  fromMaterial,
  subject,
}: {
  chapterHref: (chapterId: string) => string;
  fromMaterial: boolean;
  subject: SyllabusSubject;
}) {
  const t = useExtracted();

  return (
    <PageSection aria-labelledby={TOPICS_TITLE_ID}>
      <PageSectionHeader>
        <PageSectionTitle id={TOPICS_TITLE_ID}>
          {fromMaterial ? t("Topics in your material") : t("Topics on the exam")}
        </PageSectionTitle>
        <PageSectionDetail>
          {subject.topicsStudied === null
            ? t("{count, plural, one {# topic} other {# topics}}", { count: subject.topics.length })
            : t(
                "{total, plural, one {{done, number} of # topic} other {{done, number} of # topics}}",
                { done: subject.topicsStudied, total: subject.topics.length },
              )}
        </PageSectionDetail>
      </PageSectionHeader>

      <SubjectTopics
        chapterHref={chapterHref}
        labelledBy={TOPICS_TITLE_ID}
        topics={subject.topics}
      />

      <TopicFrequencySource source={subject.topicFrequencySource} />
    </PageSection>
  );
}

export function SubjectScreen({
  actions,
  ask,
  hrefs,
  subject,
  syllabus,
}: {
  actions: SubjectActions;
  ask?: React.ReactNode;
  hrefs: SubjectHrefs;
  subject: SyllabusSubject;
  syllabus: Pick<
    SyllabusView,
    "fromMaterial" | "kind" | "questionsSource" | "sharedExams" | "writtenPractice"
  >;
}) {
  const t = useExtracted();
  const written = findWrittenSubject({ practice: syllabus.writtenPractice, subject });

  return (
    <DetailLayout
      aside={
        <SubjectAside
          questionsSource={syllabus.questionsSource}
          subject={subject}
          written={written}
        />
      }
      asideLabel={t("About this subject")}
      bar={
        <LearnPageBar
          back={{ href: hrefs.back, label: t("Plan") }}
          title={subject.shortName ?? subject.name}
        >
          {ask}
          <ReportProblemMenu label={t("Subject options")} screen="subject" />
        </LearnPageBar>
      }
      bottomBar={
        written && actions.write ? (
          <WriteBottomBar essayHref={hrefs.essay} write={actions.write} written={written} />
        ) : (
          <SubjectBottomBar chapterHref={hrefs.chapter} subject={subject} />
        )
      }
      data-slot="subject"
    >
      <DetailAside>
        <SubjectHeader
          fromMaterial={syllabus.fromMaterial}
          kind={syllabus.kind}
          sharedExams={syllabus.sharedExams}
          subject={subject}
          written={written}
        />
        {/* A written part's headline is its estimated points: lessons are a small part of its time. */}
        {!written && <SubjectCoverage className="min-[72rem]:hidden" labelled subject={subject} />}
        <NotPlannedCallout actions={actions} adjustHref={hrefs.adjust} subject={subject} />
      </DetailAside>

      <DetailContent>
        {written && hrefs.answer && (
          <SubjectWrittenScore answerHref={hrefs.answer} written={written} />
        )}

        <SubjectChapters
          chapterHref={hrefs.chapter}
          chapters={subject.chapters}
          mindMapsHref={hrefs.mindMaps?.(subject.key) ?? null}
        />

        <SubjectWrittenPractice
          actions={actions}
          practice={syllabus.writtenPractice}
          subject={subject}
        />

        {subject.topics.length > 0 && (
          <TopicsSection
            chapterHref={hrefs.chapter}
            fromMaterial={syllabus.fromMaterial}
            subject={subject}
          />
        )}

        <SubjectMatrix matrix={subject.matrix} />
      </DetailContent>
    </DetailLayout>
  );
}
