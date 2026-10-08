"use client";

import {
  type MockOptionView,
  type MockOptionsView,
  type PlacementMockLength,
} from "@zoonk/core/exams/mocks/contract";
import { EyeOffIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useState } from "react";
import { Callout } from "../_components/callout";
import { KindTile } from "../_components/kind-tile";
import { SectionLabel } from "../_components/section-label";
import { StepCard, StepDetail, StepEyebrow, StepHeader, StepTitle } from "../_components/step-card";
import { ChoiceList } from "../onboarding/choice-list";
import { TaskFrame, TaskMainButton, TaskMainLink } from "../shell/task-frame";
import {
  ChooserProblem,
  type MockChooserStatus,
  MockPlusNotice,
  MockWriting,
  ResultRule,
} from "./mock-chooser-parts";
import {
  useMockOptionDetail,
  useMockOptionName,
  usePlacementLengthChoices,
} from "./mock-option-labels";

export type { MockChooserStatus } from "./mock-chooser-parts";

type MockChooserHrefs = { exit: string; plus: string };

/** What Start asks for: one of the goal's options, or a diagnostic mock in a length. */
export type MockStart =
  | { option: MockOptionView; purpose: "practice" }
  | { length: PlacementMockLength; purpose: "placement" };

function toKey(option: MockOptionView): string {
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

  return options.map((option) => ({
    description: detail({ option, severalDays }),
    label: name({ option, severalDays }),
    value: toKey(option),
  }));
}

/**
 * The mocks to pick from: the exam itself (each day, half of one), then each subject on its own.
 * Number keys pick from the first list.
 */
function MockOptionLists({
  onPick,
  picked,
  view,
}: {
  onPick: (key: string) => void;
  picked: string;
  view: MockOptionsView;
}) {
  const t = useExtracted();
  const severalDays = view.options.filter((option) => option.kind === "full").length > 1;
  const exam = view.options.filter((option) => option.kind !== "area");
  const subjects = view.options.filter((option) => option.kind === "area");
  const examChoices = useMockChoices({ options: exam, severalDays });
  const subjectChoices = useMockChoices({ options: subjects, severalDays });

  return (
    <div className="flex flex-col gap-5">
      <ChoiceList
        choices={examChoices}
        label={t("The exam")}
        onChange={onPick}
        value={examChoices.some((choice) => choice.value === picked) ? picked : null}
      />

      {subjectChoices.length > 0 && (
        <section aria-labelledby="mock-subjects-title" className="flex flex-col gap-2">
          <SectionLabel id="mock-subjects-title">{t("One subject")}</SectionLabel>
          <ChoiceList
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

/**
 * "Take a mock exam", whenever the learner wants: the exam's name, the mocks to pick from with
 * their honest size and time (the full exam is picked to start), the one rule, and Start. A mock
 * the bank is short of has its questions written first, while the screen says so. Without Plus,
 * the options show with what it would take.
 */
function PracticeChooser({
  busy,
  hrefs,
  onStart,
  status,
  view,
}: {
  busy: boolean;
  hrefs: MockChooserHrefs;
  onStart: (start: MockStart) => void;
  status: MockChooserStatus;
  view: MockOptionsView;
}) {
  const t = useExtracted();
  const [first] = view.options;
  const [picked, setPicked] = useState(first ? toKey(first) : "");
  const option = view.options.find((candidate) => toKey(candidate) === picked) ?? null;
  const open = view.access === "open";

  return (
    <TaskFrame
      closeOnEscape
      exitHref={hrefs.exit}
      exitToApp
      footer={
        <>
          <ChooserProblem status={status} />
          {open ? (
            <TaskMainButton
              busy={busy}
              disabled={!option}
              onClick={() => option && onStart({ option, purpose: "practice" })}
            >
              {busy ? t("Getting it ready…") : t("Start")}
            </TaskMainButton>
          ) : (
            <TaskMainLink href={hrefs.plus}>{t("See Plus")}</TaskMainLink>
          )}
        </>
      }
    >
      <StepCard className="gap-3 py-6">
        <KindTile kind="mock" size="lg" />
        <StepHeader>
          <StepEyebrow>{view.examName}</StepEyebrow>
          <StepTitle>{t("Take a mock exam")}</StepTitle>
          <StepDetail>{t("Pick how much of the exam to take now.")}</StepDetail>
        </StepHeader>
      </StepCard>

      <MockOptionLists onPick={setPicked} picked={picked} view={view} />

      {open ? <ResultRule /> : <MockPlusNotice />}
    </TaskFrame>
  );
}

/**
 * A diagnostic mock in onboarding instead of the quick questions: what it is (the exam's format,
 * and the plan starts from its answers), how long, as one choice of a few lengths with their
 * questions and how fine a starting point each sets (the suggested one picked), that stopping
 * midway keeps what was answered, and Start. Without Plus, the lengths show with what it takes.
 */
function PlacementChooser({
  busy,
  hrefs,
  onStart,
  placement,
  status,
  view,
}: {
  busy: boolean;
  hrefs: MockChooserHrefs;
  onStart: (start: MockStart) => void;
  placement: NonNullable<MockOptionsView["placement"]>;
  status: MockChooserStatus;
  view: MockOptionsView;
}) {
  const t = useExtracted();
  const choices = usePlacementLengthChoices(placement);
  const [length, setLength] = useState<PlacementMockLength>(placement.recommended);
  const open = view.access === "open";

  return (
    <TaskFrame
      closeOnEscape
      exitHref={hrefs.exit}
      footer={
        <>
          <ChooserProblem status={status} />
          {open ? (
            <TaskMainButton busy={busy} onClick={() => onStart({ length, purpose: "placement" })}>
              {busy ? t("Getting it ready…") : t("Start the mock exam")}
            </TaskMainButton>
          ) : (
            <TaskMainLink href={hrefs.plus}>{t("See Plus")}</TaskMainLink>
          )}
        </>
      }
    >
      <StepCard className="gap-3 py-6">
        <KindTile kind="mock" size="lg" />
        <StepHeader>
          <StepEyebrow>{view.examName}</StepEyebrow>
          <StepTitle>{t("A mock exam to find your level")}</StepTitle>
          <StepDetail>{t("In the exam's format. Your plan starts from your answers.")}</StepDetail>
        </StepHeader>
      </StepCard>

      <ChoiceList choices={choices} label={t("How long")} onChange={setLength} value={length} />

      {open ? (
        <Callout>
          <EyeOffIcon aria-hidden="true" />
          <p>
            {t(
              "Stop whenever you want: your plan uses the questions you answered. Your result shows at the end.",
            )}
          </p>
        </Callout>
      ) : (
        <MockPlusNotice placement />
      )}
    </TaskFrame>
  );
}

/**
 * Taking a mock any time, or (`placement`) a diagnostic mock as placement in onboarding. The host
 * starts the picked mock (`onStart`), follows the run writing its questions when the bank is short
 * (`status`), and says why it couldn't start.
 */
export function MockChooserScreen({
  busy,
  hrefs,
  onStart,
  placement = false,
  status,
  view,
}: {
  busy: boolean;
  hrefs: MockChooserHrefs;
  onStart: (start: MockStart) => void;
  placement?: boolean;
  status: MockChooserStatus;
  view: MockOptionsView;
}) {
  if (status.kind === "writing") {
    return <MockWriting exitHref={hrefs.exit} run={status.run} />;
  }

  if (placement && view.placement) {
    return (
      <PlacementChooser
        busy={busy}
        hrefs={hrefs}
        onStart={onStart}
        placement={view.placement}
        status={status}
        view={view}
      />
    );
  }

  return (
    <PracticeChooser busy={busy} hrefs={hrefs} onStart={onStart} status={status} view={view} />
  );
}
