"use client";

import { MainTutorScope, type TutorViewer } from "@/components/learn/main-ask-tutor";
import { useRouter } from "@/i18n/navigation";
import { useTopicOutlineActions } from "@/lib/topic-outlines/use-topic-outline-actions";
import { type LearnerPlanOperation } from "@zoonk/core/plans/contract";
import { type SyllabusSubject, type SyllabusView } from "@zoonk/core/view-models/syllabus/contract";
import { buildSubjectMindMapsHref } from "@zoonk/learn/mind-maps/urls";
import { SubjectScreen } from "@zoonk/learn/subject";
import { TopicOutlineProvider } from "@zoonk/learn/topic-outline";
import { AskTutorEntry } from "@zoonk/player/tutor";
import { useMemo } from "react";
import { changePlanAction } from "../journey-actions";

/**
 * "Ask" opens the buddy's conversation; only what the learner sends there is answered. The page
 * places it twice (the bar on a phone, a row in the side column from wide screens), so both open
 * the one conversation.
 */
export function SubjectScreenClient({
  goalId,
  hasMindMaps,
  subject,
  syllabus,
  tutor,
}: {
  goalId: string;
  hasMindMaps: boolean;
  subject: SyllabusSubject;
  syllabus: Pick<
    SyllabusView,
    "fromMaterial" | "kind" | "questionsSource" | "sharedExams" | "writtenPractice"
  >;
  tutor: TutorViewer;
}) {
  const router = useRouter();
  const outlineActions = useTopicOutlineActions(goalId);
  const subjectKey = subject.key;

  const target = useMemo(
    () => ({ goalId, kind: "subject" as const, subjectKey }),
    [goalId, subjectKey],
  );

  const change = async (operations: LearnerPlanOperation[]) => {
    const changed = (await changePlanAction(goalId, operations)) !== null;

    if (changed) {
      router.refresh();
    }

    return changed;
  };

  return (
    <TopicOutlineProvider value={outlineActions}>
      <MainTutorScope {...tutor} target={target}>
        <SubjectScreen
          actions={{
            restore: (areas) => change([{ areas, kind: "restoreAreas" }]),
            setWrittenCadence: (cadence) => change([{ cadence, kind: "setWrittenCadence" }]),
          }}
          ask={{ bar: <AskTutorEntry size="bar" />, row: <AskTutorEntry appearance="row" /> }}
          hrefs={{
            adjust: "/plan",
            back: "/plan",
            chapter: (chapterId) =>
              `/content/chapters/${chapterId}?from=${encodeURIComponent(subject.key)}`,
            mindMaps: hasMindMaps
              ? (key) => buildSubjectMindMapsHref({ page: "/mind-maps", subject: key })
              : undefined,
          }}
          subject={subject}
          syllabus={syllabus}
        />
      </MainTutorScope>
    </TopicOutlineProvider>
  );
}
