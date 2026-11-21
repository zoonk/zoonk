"use client";

import { type MockOptionView, type MockOptionsView } from "@zoonk/core/exams/mocks/contract";
import { useExtracted } from "next-intl";
import { type ReactNode, useEffect, useEffectEvent, useState } from "react";
import { ChoiceRows } from "../_components/choice-rows";
import { DetailContent } from "../_components/detail-page";
import { PageSectionTitle } from "../_components/page";
import { FactSegments } from "../_components/task-meta";
import { ChooserLastMock } from "./mock-chooser-last-mock";
import { ChooserBar, ChooserHeader, ChooserLayout } from "./mock-chooser-page";
import { type MockChooserStatus, getMockOptionKey, getPreparingKey } from "./mock-chooser-parts";
import {
  useMockOptionDetail,
  useMockOptionName,
  useMockOptionSizeFacts,
} from "./mock-option-labels";
import { type MockWriting } from "./mock-preparing";

export { type MockChooserStatus, getMockOptionKey } from "./mock-chooser-parts";
export { type MockWriting } from "./mock-preparing";

type MockChooserHrefs = { mock: (id: string) => string };

const READ_AGAIN_MS = 15_000;

function useReadAgainWhile({ readAgain, waiting }: { readAgain: () => void; waiting: boolean }) {
  const read = useEffectEvent(() => {
    if (document.visibilityState === "visible") {
      readAgain();
    }
  });

  useEffect(() => {
    if (!waiting) {
      return;
    }

    const timer = setInterval(read, READ_AGAIN_MS);
    document.addEventListener("visibilitychange", read);

    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", read);
    };
  }, [waiting]);
}

function useMockChoices({
  options,
  severalDays,
}: {
  options: readonly MockOptionView[];
  severalDays: boolean;
}) {
  const name = useMockOptionName();
  const detail = useMockOptionDetail();
  const sizeFacts = useMockOptionSizeFacts();

  return options.map((option) => ({
    description: detail({ option, severalDays }) || undefined,
    label: name({ option, severalDays }),
    trailing: <FactSegments facts={sizeFacts(option)} />,
    value: getMockOptionKey(option),
  }));
}

function MockOptionLists({
  onPick,
  picked,
  severalDays,
  view,
}: {
  onPick: (key: string) => void;
  picked: string | null;
  severalDays: boolean;
  view: MockOptionsView;
}) {
  const t = useExtracted();
  const exam = view.options.filter((option) => option.kind !== "area");
  const subjects = view.options.filter((option) => option.kind === "area");
  const examChoices = useMockChoices({ options: exam, severalDays });
  const subjectChoices = useMockChoices({ options: subjects, severalDays });
  const examTitle = t("The exam");

  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="mock-exam-title" className="flex flex-col gap-1">
        {subjectChoices.length > 0 && (
          <PageSectionTitle id="mock-exam-title">{examTitle}</PageSectionTitle>
        )}
        <ChoiceRows
          choices={examChoices}
          label={examTitle}
          onChange={onPick}
          value={examChoices.some((choice) => choice.value === picked) ? picked : null}
        />
      </section>

      {subjectChoices.length > 0 && (
        <section aria-labelledby="mock-subjects-title" className="flex flex-col gap-1">
          <PageSectionTitle id="mock-subjects-title">{t("One subject")}</PageSectionTitle>
          <ChoiceRows
            choices={subjectChoices}
            label={t("One subject")}
            onChange={onPick}
            value={subjectChoices.some((choice) => choice.value === picked) ? picked : null}
          />
        </section>
      )}
    </div>
  );
}

type MockChooserProps = {
  bar: ReactNode;
  busy: boolean;
  hrefs: MockChooserHrefs;
  onStart: (option: MockOptionView) => void;
  readAgain: () => void;
  /** The run writing the mock the learner asked for, while it's being prepared. */
  readWriting: () => Promise<MockWriting>;
  goalId: string;
  status: MockChooserStatus;
  view: MockOptionsView;
};

export function MockChooserScreen({
  bar,
  busy,
  hrefs,
  onStart,
  readAgain,
  goalId,
  readWriting,
  status,
  view,
}: MockChooserProps) {
  const t = useExtracted();
  // Nothing is picked as the page opens, so a first tap on Start can't begin an hours-long exam.
  const [picked, setPicked] = useState<string | null>(null);
  const option = view.options.find((candidate) => getMockOptionKey(candidate) === picked) ?? null;
  const severalDays = view.options.filter((candidate) => candidate.kind === "full").length > 1;
  // A free learner sees the chooser as a subscriber does; Start is where the gate shows.
  const [gated, setGated] = useState(false);
  const preparing = picked !== null && picked === getPreparingKey({ status, view }) ? picked : null;

  useReadAgainWhile({ readAgain, waiting: preparing !== null });

  const start = () => {
    if (!option) {
      return;
    }

    if (view.access === "open") {
      onStart(option);
    } else {
      setGated(true);
    }
  };

  return (
    <ChooserLayout
      aside={view.lastMock && <ChooserLastMock mock={view.lastMock} resultHref={hrefs.mock} />}
      bar={bar}
      bottomBar={
        <ChooserBar
          busy={busy}
          disabled={!option}
          gated={gated}
          onStart={start}
          preparing={preparing}
          status={status}
          goalId={goalId}
          writing={{ read: readWriting, written: readAgain }}
        />
      }
    >
      <ChooserHeader
        detail={t("Timed like the real exam. You see your result at the end.")}
        title={t("Take a mock exam")}
      />

      <DetailContent>
        <MockOptionLists onPick={setPicked} picked={picked} severalDays={severalDays} view={view} />
      </DetailContent>
    </ChooserLayout>
  );
}
