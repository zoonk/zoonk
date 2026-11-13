"use client";

import { type MockOptionView, type MockOptionsView } from "@zoonk/core/exams/mocks/contract";
import { useExtracted } from "next-intl";
import { type ReactNode, useState } from "react";
import { ChoiceRows } from "../_components/choice-rows";
import { DetailContent } from "../_components/detail-page";
import { PageSectionLabel } from "../_components/page";
import { ChooserLastMock } from "./mock-chooser-last-mock";
import {
  ChooserBottomBar,
  ChooserHeader,
  ChooserLayout,
  ChooserPlusLink,
  ChooserRefusal,
  ChooserStartButton,
  MockWriting,
} from "./mock-chooser-page";
import { type MockChooserStatus } from "./mock-chooser-parts";
import { type MockChooserHrefs, PickedMock } from "./mock-chooser-picked";
import { useMockOptionDetail, useMockOptionName, useMockOptionSize } from "./mock-option-labels";

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
          <PageSectionLabel id="mock-exam-title">{examTitle}</PageSectionLabel>
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
          <PageSectionLabel id="mock-subjects-title">{t("One subject")}</PageSectionLabel>
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

function PracticeChooser({
  bar,
  busy,
  hrefs,
  onStart,
  status,
  view,
}: {
  bar: ReactNode;
  busy: boolean;
  hrefs: MockChooserHrefs;
  onStart: (option: MockOptionView) => void;
  status: MockChooserStatus;
  view: MockOptionsView;
}) {
  const t = useExtracted();
  // Nothing is picked as the page opens, so a first tap on Start can't begin an hours-long exam.
  const [picked, setPicked] = useState<string | null>(null);
  const option = view.options.find((candidate) => getMockOptionKey(candidate) === picked) ?? null;
  const severalDays = view.options.filter((candidate) => candidate.kind === "full").length > 1;
  const open = view.access === "open";
  const short = status.kind === "short" && status.optionKey === picked ? status : null;

  const shown: MockChooserStatus =
    status.kind === "short" && !short ? { kind: "choosing" } : status;

  const start = (enter: boolean) => (
    <ChooserStartButton
      busy={busy}
      disabled={!option}
      enter={enter}
      onClick={() => option && onStart(option)}
    >
      {t("Start")}
    </ChooserStartButton>
  );

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
    >
      <ChooserHeader
        action={
          open ? (
            <div className="contents max-md:hidden">{start(true)}</div>
          ) : (
            <ChooserPlusLink href={hrefs.plus} />
          )
        }
        detail={
          open
            ? t("Timed like the real exam. You see your result at the end.")
            : t("Mock exams are part of Plus.")
        }
        eyebrow={view.examName}
        status={shown}
        title={t("Take a mock exam")}
      />

      <DetailContent>
        <ChooserRefusal busy={busy} status={shown} />
        <MockOptionLists onPick={setPicked} picked={picked} severalDays={severalDays} view={view} />
        {open && <ChooserBottomBar>{start(false)}</ChooserBottomBar>}
      </DetailContent>
    </ChooserLayout>
  );
}

export function MockChooserScreen({
  bar,
  busy,
  hrefs,
  onStart,
  status,
  view,
}: {
  bar: ReactNode;
  busy: boolean;
  hrefs: MockChooserHrefs;
  onStart: (option: MockOptionView) => void;
  status: MockChooserStatus;
  view: MockOptionsView;
}) {
  if (status.kind === "writing") {
    return <MockWriting bar={bar} eyebrow={view.examName} run={status.run} />;
  }

  return (
    <PracticeChooser
      bar={bar}
      busy={busy}
      hrefs={hrefs}
      onStart={onStart}
      status={status}
      view={view}
    />
  );
}
