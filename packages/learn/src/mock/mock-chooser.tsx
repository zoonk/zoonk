"use client";

import { type MockOptionView, type MockOptionsView } from "@zoonk/core/exams/mocks/contract";
import { useExtracted } from "next-intl";
import { type ReactNode, useState } from "react";
import { ChoiceRows } from "../_components/choice-rows";
import { DetailContent } from "../_components/detail-page";
import { PageSectionTitle } from "../_components/page";
import { ChooserLastMock } from "./mock-chooser-last-mock";
import { ChooserBar, ChooserHeader, ChooserLayout, MockWriting } from "./mock-chooser-page";
import { type MockChooserStatus } from "./mock-chooser-parts";
import { type MockChooserHrefs, PickedMock } from "./mock-chooser-picked";
import { useMockOptionDetail, useMockOptionName, useMockOptionSize } from "./mock-option-labels";
import { MockShortDialog } from "./mock-short-dialog";

export type { MockChooserStatus } from "./mock-chooser-parts";

export function getMockOptionKey(option: MockOptionView): string {
  return [option.kind, option.day ?? "", option.area ?? ""].join(":");
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
  const size = useMockOptionSize();

  return options.map((option) => ({
    description: detail({ option, severalDays }) || undefined,
    label: name({ option, severalDays }),
    trailing: size(option),
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
            numberKeys={false}
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
  /** The learner agreed to the `short` status's numbers. */
  onStartShort: (option: MockOptionView) => void;
  onStayChoosing: () => void;
  status: MockChooserStatus;
  view: MockOptionsView;
};

function PracticeChooser({
  bar,
  busy,
  hrefs,
  onStart,
  onStartShort,
  onStayChoosing,
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
  const short = status.kind === "short" ? status : null;
  const shown: MockChooserStatus = short ? { kind: "choosing" } : status;

  const shortOption = short
    ? view.options.find((candidate) => getMockOptionKey(candidate) === short.optionKey)
    : undefined;

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
      aside={
        <>
          {/* What a pick shows comes last, so picking moves nothing above it. */}
          <ChooserLastMock mock={view.lastMock} resultHref={hrefs.mock} />
          {option && <PickedMock option={option} severalDays={severalDays} />}
        </>
      }
      bar={bar}
      bottomBar={
        <ChooserBar busy={busy} disabled={!option} gated={gated} onStart={start} status={shown} />
      }
    >
      <ChooserHeader
        detail={t("Timed like the real exam. You see your result at the end.")}
        title={t("Take a mock exam")}
      />

      <DetailContent>
        <MockOptionLists onPick={setPicked} picked={picked} severalDays={severalDays} view={view} />
      </DetailContent>

      <MockShortDialog
        onCancel={onStayChoosing}
        onStart={() => shortOption && onStartShort(shortOption)}
        status={short}
      />
    </ChooserLayout>
  );
}

export function MockChooserScreen(props: MockChooserProps) {
  if (props.status.kind === "writing") {
    return <MockWriting bar={props.bar} run={props.status.run} />;
  }

  return <PracticeChooser {...props} />;
}
