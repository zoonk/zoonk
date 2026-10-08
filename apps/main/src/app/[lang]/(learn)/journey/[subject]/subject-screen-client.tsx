"use client";

import { useRouter } from "@/i18n/navigation";
import { type LearnerPlanOperation } from "@zoonk/core/plans/contract";
import { type SyllabusSubject, type SyllabusView } from "@zoonk/core/view-models/syllabus/contract";
import { SubjectScreen } from "@zoonk/learn/subject";
import { changePlanAction } from "../journey-actions";

/**
 * A subject's page: its chapters open with a way back here, "Bring it back" puts a subject the
 * learner took out into the plan again, and a written test's cadence changes in place; each change
 * reads the page again.
 */
export function SubjectScreenClient({
  goalId,
  hasMindMaps,
  subject,
  syllabus,
}: {
  goalId: string;
  /** Whether one of its chapters is on the goal's mind maps page. */
  hasMindMaps: boolean;
  subject: SyllabusSubject;
  syllabus: Pick<SyllabusView, "fromMaterial" | "kind" | "writtenPractice">;
}) {
  const router = useRouter();

  const change = async (operations: LearnerPlanOperation[]) => {
    const changed = (await changePlanAction(goalId, operations)) !== null;

    if (changed) {
      router.refresh();
    }

    return changed;
  };

  return (
    <SubjectScreen
      actions={{
        restore: (areas) => change([{ areas, kind: "restoreAreas" }]),
        setWrittenCadence: (cadence) => change([{ cadence, kind: "setWrittenCadence" }]),
      }}
      hrefs={{
        adjust: "/journey",
        back: "/journey",
        chapter: (chapterId) =>
          `/content/chapters/${chapterId}?from=${encodeURIComponent(subject.key)}`,
        mindMaps: hasMindMaps ? (key) => `/mind-maps#${encodeURIComponent(key)}` : undefined,
      }}
      subject={subject}
      syllabus={syllabus}
    />
  );
}
