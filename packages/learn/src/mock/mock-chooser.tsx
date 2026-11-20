"use client";

import { type MockOptionView, type MockOptionsView } from "@zoonk/core/exams/mocks/contract";
import { useExtracted } from "next-intl";
import { type ReactNode, useState } from "react";
import { ChoiceRows } from "../_components/choice-rows";
import { DetailContent } from "../_components/detail-page";
import { PageSectionTitle } from "../_components/page";
import { FactSegments } from "../_components/task-meta";
import { ChooserLastMock } from "./mock-chooser-last-mock";
import { ChooserBar, ChooserHeader, ChooserLayout, MockWriting } from "./mock-chooser-page";
import { type MockChooserStatus } from "./mock-chooser-parts";
import {
  getExamTests,
  useMockOptionDetail,
  useMockOptionName,
  useMockOptionSizeFacts,
} from "./mock-option-labels";
import { MockShortDialog } from "./mock-short-dialog";

export type { MockChooserStatus } from "./mock-chooser-parts";

type MockChooserHrefs = { mock: (id: string) => string };

export function getMockOptionKey(option: MockOptionView): string {
  return [option.kind, option.day ?? "", option.area ?? ""].join(":");
}

/** `objectiveTitled`: the group's title already says its options hold objective questions only. */
function useMockChoices({
  objectiveTitled = false,
  options,
  severalDays,
  tests = 0,
}: {
  objectiveTitled?: boolean;
  options: readonly MockOptionView[];
  severalDays: boolean;
  tests?: number;
}) {
  const name = useMockOptionName();
  const detail = useMockOptionDetail();
  const sizeFacts = useMockOptionSizeFacts();

  return options.map((option) => {
    // An exam taken as one test reads its options as it always did; its sections say nothing new.
    const shown = tests > 1 ? option : { ...option, sections: undefined };

    return {
      description: (!objectiveTitled && detail({ option: shown, severalDays })) || undefined,
      label: name({ option: shown, severalDays, tests }),
      trailing: <FactSegments facts={sizeFacts(shown)} />,
      value: getMockOptionKey(option),
    };
  });
}

function OptionGroup({
  choices,
  id,
  label,
  onPick,
  picked,
  title,
}: {
  choices: ReturnType<typeof useMockChoices>;
  id: string;
  label: string;
  onPick: (key: string) => void;
  picked: string | null;
  title: string | null;
}) {
  if (choices.length === 0) {
    return null;
  }

  return (
    <section aria-labelledby={title ? id : undefined} className="flex flex-col gap-1">
      {title && <PageSectionTitle id={id}>{title}</PageSectionTitle>}
      <ChoiceRows
        choices={choices}
        label={label}
        onChange={onPick}
        value={choices.some((choice) => choice.value === picked) ? picked : null}
      />
    </section>
  );
}

/**
 * An exam of several tests lists each test and all of them first, then the shorter, objective-only
 * options; any other exam lists the exam, then one subject.
 */
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
  const tests = severalDays ? 0 : getExamTests(view.options);

  const leads = (option: MockOptionView) =>
    tests > 1 ? option.kind !== "half" && option.kind !== "area" : option.kind !== "area";

  const exam = view.options.filter((option) => leads(option));
  const rest = view.options.filter((option) => !leads(option));
  const examChoices = useMockChoices({ options: exam, severalDays, tests });
  const restChoices = useMockChoices({ objectiveTitled: tests > 1, options: rest, severalDays });

  const examTitle =
    tests > 1
      ? t("{count, plural, other {Your exam has # tests}}", { count: tests })
      : t("The exam");

  const restTitle = tests > 1 ? t("Shorter, objective questions only") : t("One subject");

  return (
    <div className="flex flex-col gap-6">
      <OptionGroup
        choices={examChoices}
        id="mock-exam-title"
        label={examTitle}
        onPick={onPick}
        picked={picked}
        title={restChoices.length > 0 || tests > 1 ? examTitle : null}
      />
      <OptionGroup
        choices={restChoices}
        id="mock-subjects-title"
        label={restTitle}
        onPick={onPick}
        picked={picked}
        title={restTitle}
      />
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
      aside={view.lastMock && <ChooserLastMock mock={view.lastMock} resultHref={hrefs.mock} />}
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
