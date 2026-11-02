import { ICON_RULES } from "@/design-system/shape";
import { KindMark, type LearnKind } from "@zoonk/learn/kind-tile";
import { DoneMark, StatusMark } from "@zoonk/learn/status-mark";
import { BarChart3Icon, MapIcon, NotebookPenIcon, SunIcon } from "lucide-react";
import { type Metadata } from "next";
import { DocHeader, DocRules, DocSection, Specimen } from "../_components/doc";

export const metadata: Metadata = { title: "Icons" };

const NAVIGATION = [
  { icon: SunIcon, label: "Today" },
  { icon: MapIcon, label: "Plan" },
  { icon: NotebookPenIcon, label: "Mistakes notebook" },
  { icon: BarChart3Icon, label: "Statistics" },
] as const;

const KINDS: readonly { kind: LearnKind; label: string }[] = [
  { kind: "lesson", label: "Lesson" },
  { kind: "review", label: "Review" },
  { kind: "practice", label: "Practice" },
  { kind: "mistakes", label: "Mistakes" },
  { kind: "mock", label: "Mock exam" },
  { kind: "challenge", label: "Challenge" },
  { kind: "conversation", label: "Conversation" },
  { kind: "essay", label: "Essay" },
  { kind: "mindMap", label: "Mind map" },
];

const STATUSES = [
  { label: "Done", status: "done" },
  { label: "Next: where the learner is", status: "next" },
  { label: "Skipped: shown to be known", status: "skipped" },
  { label: "Ahead", status: "todo" },
] as const;

export default function IconsPage() {
  return (
    <>
      <DocHeader title="Icons">
        Lucide, neutral by default. Color goes on an icon only when the icon is a meaning: a
        kind&apos;s mark in a mixed list, done, a flag, a reward.
      </DocHeader>

      <DocSection title="Rules">
        <DocRules rules={ICON_RULES} />
      </DocSection>

      <DocSection intro="Every navigation icon is the same neutral color." title="Navigation">
        <Specimen className="flex flex-wrap gap-x-8 gap-y-3">
          {NAVIGATION.map(({ icon: Icon, label }) => (
            <span className="text-muted-foreground flex items-center gap-2 text-sm" key={label}>
              <Icon aria-hidden="true" className="size-4" />
              {label}
            </span>
          ))}
        </Specimen>
      </DocSection>

      <DocSection
        intro="`KindMark`, from `KIND_MARKS`: its shape and its hue say what a thing is."
        title="Kinds"
      >
        <Specimen className="grid gap-3 sm:grid-cols-3">
          {KINDS.map(({ kind, label }) => (
            <span className="flex items-center gap-2.5 text-sm" key={kind}>
              <KindMark kind={kind} />
              {label}
            </span>
          ))}
        </Specimen>
      </DocSection>

      <DocSection
        intro="`StatusMark` and `DoneMark`: where a thing stands, in every list."
        title="Status"
      >
        <Specimen className="flex flex-col gap-3">
          {STATUSES.map(({ label, status }) => (
            <span className="flex items-center gap-2.5 text-sm" key={status}>
              <StatusMark status={status} />
              {label}
            </span>
          ))}
          <span className="flex items-center gap-2.5 text-sm">
            <DoneMark />
            DoneMark on its own
          </span>
        </Specimen>
      </DocSection>
    </>
  );
}
