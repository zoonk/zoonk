"use client";

import { type WrittenPractice } from "@zoonk/core/plans/written-practice-contract";
import { type SyllabusSubject } from "@zoonk/core/view-models/syllabus/contract";
import { useState, useTransition } from "react";
import { WrittenCadenceChoice } from "../plan/written-cadence";
import { type SubjectActions } from "./subject-not-planned";

/**
 * A written test's page says when it's practiced and changes it in one tap, as "Adjust your plan"
 * does: the learner who opens their redação to see what's planned decides it there.
 */
export function SubjectWrittenPractice({
  actions,
  practice,
  subject,
}: {
  actions: SubjectActions;
  practice: WrittenPractice | null;
  subject: SyllabusSubject;
}) {
  const [failed, setFailed] = useState(false);
  const [isPending, startTransition] = useTransition();

  if (!practice || !subject.areas.some((area) => practice.parts.includes(area))) {
    return null;
  }

  // As wide as the header's facts, so three short choices don't stretch across a wide page.
  return (
    <div className="lg:max-w-xl">
      <WrittenCadenceChoice
        failed={failed}
        onChange={(cadence) =>
          startTransition(async () => {
            setFailed(!(await actions.setWrittenCadence(cadence)));
          })
        }
        pending={isPending}
        practice={practice}
      />
    </div>
  );
}
