import { ICON_MEANINGS, ICON_RULES, ICON_SIZES, type IconMeaning } from "@/design-system/shape";
import { KindMark, type LearnKind } from "@zoonk/learn/kind-tile";
import { DoneMark, StatusMark } from "@zoonk/learn/status-mark";
import {
  ArrowRightIcon,
  BarChart3Icon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  EllipsisIcon,
  type LucideIcon,
  MapIcon,
  NotebookPenIcon,
  SunIcon,
  XIcon,
} from "lucide-react";
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

const MEANING_ICONS: Record<IconMeaning["icon"], LucideIcon> = {
  "arrow-right": ArrowRightIcon,
  "chevron-down": ChevronDownIcon,
  "chevron-left": ChevronLeftIcon,
  "chevron-right": ChevronRightIcon,
  ellipsis: EllipsisIcon,
  x: XIcon,
};

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

      <DocSection
        intro="Five sizes, each matched to the text or the control it sits in."
        title="Sizes"
      >
        <Specimen className="grid gap-x-8 gap-y-4 sm:grid-cols-2 xl:grid-cols-5">
          {ICON_SIZES.map((size) => (
            <div className="flex flex-col gap-2" key={size.className}>
              <span className="flex h-6 items-center">
                <SunIcon aria-hidden="true" className={size.className} />
              </span>
              <p className="text-sm font-medium">{size.size}</p>
              <code className="text-muted-foreground font-mono text-xs">{size.className}</code>
              <p className="text-muted-foreground text-xs leading-normal">{size.use}</p>
            </div>
          ))}
        </Specimen>
      </DocSection>

      <DocSection
        intro="The same glyph for the same thing on every screen."
        title="One thing, one icon"
      >
        <Specimen className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {ICON_MEANINGS.map(({ icon, meaning }) => {
            const Icon = MEANING_ICONS[icon];

            return (
              <span className="flex items-center gap-2 text-sm" key={icon}>
                <Icon aria-hidden="true" className="text-muted-foreground size-4 shrink-0" />
                {meaning}
              </span>
            );
          })}
        </Specimen>
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
            <span className="flex items-center gap-2 text-sm" key={kind}>
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
            <span className="flex items-center gap-2 text-sm" key={status}>
              <StatusMark status={status} />
              {label}
            </span>
          ))}
          <span className="flex items-center gap-2 text-sm">
            <DoneMark />
            DoneMark on its own
          </span>
        </Specimen>
      </DocSection>
    </>
  );
}
