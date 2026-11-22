"use client";

import { useRouter } from "@/i18n/navigation";
import { MOCK_ENTRY_HREFS } from "@/lib/mocks/mock-entry-hrefs";
import { readMockWriting } from "@/lib/mocks/read-mock-writing";
import { answerHere, openingHere } from "@/lib/session/tap-answer";
import { useResetWhenDone } from "@/lib/use-reset-when-done";
import { type MockOptionView, type MockOptionsView } from "@zoonk/core/exams/mocks/contract";
import {
  MockChooserScreen,
  type MockChooserStatus,
  getMockOptionKey,
} from "@zoonk/learn/mock/chooser";
import { safeAsync } from "@zoonk/utils/error";
import { useState, useTransition } from "react";
import { startAnytimeMockAction } from "./mock-start-actions";

type MockChooserClientProps = { bar: React.ReactNode; goalId: string; view: MockOptionsView };

function MockChooserVisit({
  bar,
  goalId,
  onDone,
  view,
}: MockChooserClientProps & { onDone: () => void }) {
  const router = useRouter();
  const [busy, startTransition] = useTransition();
  const [status, setStatus] = useState<MockChooserStatus>({ kind: "choosing" });

  /** A start the server couldn't answer is a failed start, never an error page. */
  const begin = (option: MockOptionView) =>
    startTransition(async () => {
      onDone();
      setStatus({ kind: "choosing" });
      const shape = { area: option.area, day: option.day, kind: option.kind };

      const { data } = await safeAsync(() =>
        answerHere(startAnytimeMockAction(goalId, { shape }), openingHere()),
      );

      const answered = data ?? "failed";

      if (answered === "left") {
        return;
      }

      const outcome = answered === "failed" ? { status: "failed" as const } : answered.answer;

      if ("id" in outcome) {
        router.push(`/mock/${outcome.id}`);
        return;
      }

      if (outcome.status === "preparing") {
        setStatus({ kind: "preparing", optionKey: getMockOptionKey(option), over: view });
        router.refresh();
        return;
      }

      if (outcome.status === "limitReached") {
        setStatus({ kind: "writingUsedUp", returnsOn: outcome.returnsOn });
        return;
      }

      if (outcome.status === "needsChoice") {
        setStatus({ choiceGroups: outcome.choiceGroups, kind: "needsChoice" });
        return;
      }

      setStatus({ kind: "failed" });
    });

  return (
    <MockChooserScreen
      bar={bar}
      busy={busy}
      goalId={goalId}
      hrefs={{ mock: MOCK_ENTRY_HREFS.mock }}
      onStart={begin}
      readAgain={() => router.refresh()}
      readWriting={() => readMockWriting({ goalId })}
      status={status}
      view={view}
    />
  );
}

/** Back or a link shows this page as it was left, so a visit that started a mock starts over. */
export function MockChooserClient(props: MockChooserClientProps) {
  const reset = useResetWhenDone();
  return <MockChooserVisit key={reset.key} {...props} onDone={reset.done} />;
}
