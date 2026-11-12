"use client";

import { type MockOptionView, type MockOptionsView } from "@zoonk/core/exams/mocks/contract";
import { useExtracted } from "next-intl";
import { type ReactNode, useState } from "react";
import { ChoiceRows } from "../_components/choice-rows";
import { DetailContent } from "../_components/detail-page";
import { PageSectionLabel } from "../_components/page";
import {
  ChooserHeader,
  ChooserLayout,
  ChooserPlusLink,
  ChooserRefusal,
  ChooserStartButton,
  MockWriting,
} from "./mock-chooser-page";
import { type MockChooserStatus, MockPlusNotice } from "./mock-chooser-parts";
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
  picked: string;
  severalDays: boolean;
  view: MockOptionsView;
}) {
  const t = useExtracted();
  const exam = view.options.filter((option) => option.kind !== "area");
  const subjects = view.options.filter((option) => option.kind === "area");
  const examChoices = useMockChoices({ options: exam, severalDays });
  const subjectChoices = useMockChoices({ options: subjects, severalDays });

  return (
    <div className="flex flex-col gap-6">
      <ChoiceRows
        choices={examChoices}
        label={t("The exam")}
        onChange={onPick}
        value={examChoices.some((choice) => choice.value === picked) ? picked : null}
      />

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
  const [first] = view.options;
  const [picked, setPicked] = useState(first ? getMockOptionKey(first) : "");
  const option = view.options.find((candidate) => getMockOptionKey(candidate) === picked) ?? null;
  const severalDays = view.options.filter((candidate) => candidate.kind === "full").length > 1;
  const open = view.access === "open";
  const short = status.kind === "short" && status.optionKey === picked ? status : null;

  const shown: MockChooserStatus =
    status.kind === "short" && !short ? { kind: "choosing" } : status;

  return (
    <ChooserLayout
      aside={
        option && <PickedMock hrefs={hrefs} option={option} severalDays={severalDays} view={view} />
      }
      bar={bar}
    >
      <ChooserHeader
        action={
          open ? (
            <ChooserStartButton
              busy={busy}
              disabled={!option}
              onClick={() => option && onStart(option)}
            >
              {short
                ? t("Start with {count, plural, one {# question} other {# questions}}", {
                    count: short.questions,
                  })
                : t("Start")}
            </ChooserStartButton>
          ) : (
            <ChooserPlusLink href={hrefs.plus} />
          )
        }
        detail={
          open
            ? t("Your result only shows at the end, like on exam day.")
            : t("Pick how much of the exam to take now.")
        }
        eyebrow={view.examName}
        status={shown}
        title={t("Take a mock exam")}
      />

      <DetailContent>
        <ChooserRefusal busy={busy} status={shown} />
        <MockOptionLists onPick={setPicked} picked={picked} severalDays={severalDays} view={view} />
        {!open && <MockPlusNotice />}
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
    return <MockWriting bar={bar} run={status.run} />;
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
