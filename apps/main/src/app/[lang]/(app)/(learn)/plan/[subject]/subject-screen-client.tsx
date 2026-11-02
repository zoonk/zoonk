"use client";

import { MainAskTutor, type TutorViewer } from "@/components/learn/main-ask-tutor";
import { useRouter } from "@/i18n/navigation";
import { useTopicOutlineActions } from "@/lib/topic-outlines/use-topic-outline-actions";
import { type LearnerPlanOperation } from "@zoonk/core/plans/contract";
import { type SyllabusSubject, type SyllabusView } from "@zoonk/core/view-models/syllabus/contract";
import { SubjectScreen } from "@zoonk/learn/subject";
import { TopicOutlineProvider } from "@zoonk/learn/topic-outline";
import { useMemo } from "react";
import { changePlanAction } from "../journey-actions";

/** "Ask" opens the buddy's conversation; only what the learner sends there is answered. */
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
    | "examDocument"
    | "fromMaterial"
    | "kind"
    | "knownTopicsReturn"
    | "questionsSource"
    | "writtenPractice"
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
      <SubjectScreen
        actions={{
          restore: (areas) => change([{ areas, kind: "restoreAreas" }]),
          setWrittenCadence: (cadence) => change([{ cadence, kind: "setWrittenCadence" }]),
        }}
        ask={{
          bar: <MainAskTutor {...tutor} size="bar" target={target} />,
          row: <MainAskTutor {...tutor} appearance="row" target={target} />,
        }}
        hrefs={{
          adjust: "/plan",
          back: "/plan",
          chapter: (chapterId) =>
            `/content/chapters/${chapterId}?from=${encodeURIComponent(subject.key)}`,
          mindMaps: hasMindMaps ? (key) => `/mind-maps#${encodeURIComponent(key)}` : undefined,
        }}
        subject={subject}
        syllabus={syllabus}
      />
    </TopicOutlineProvider>
  );
}
