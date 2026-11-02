"use client";

import { type WrittenPractice } from "@zoonk/core/plans/written-practice-contract";
import { type SyllabusSubject } from "@zoonk/core/view-models/syllabus/contract";
import { safeAsync } from "@zoonk/utils/error";
import { useState, useTransition } from "react";
import { WrittenCadenceChoice } from "../plan/written-cadence";
import { type SubjectActions } from "./subject-not-planned";

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

  return (
    <div className="lg:max-w-xl">
      <WrittenCadenceChoice
        failed={failed}
        onChange={(cadence, answered) => {
          setFailed(false);

          startTransition(async () => {
            const { data: saved } = await safeAsync(() => actions.setWrittenCadence(cadence));

            // Updates after an `await` join the transition only when started in one again.
            startTransition(() => {
              setFailed(!saved);
              answered();
            });
          });
        }}
        pending={isPending}
        practice={practice}
      />
    </div>
  );
}
