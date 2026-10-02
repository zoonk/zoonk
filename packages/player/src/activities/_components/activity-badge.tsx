"use client";

import { cn } from "@zoonk/ui/lib/utils";
import {
  ArrowDownUp,
  ArrowLeftRight,
  Atom,
  Blocks,
  ChartLine,
  ChartSpline,
  Columns2,
  Database,
  Dices,
  Ear,
  Footprints,
  GitBranch,
  GitCompareArrows,
  Grid2x2,
  Grid2x2Check,
  Group,
  Hand,
  Headphones,
  Link2,
  ListOrdered,
  type LucideIcon,
  MapPinned,
  MessagesSquare,
  Move,
  MoveHorizontal,
  MoveVertical,
  Music,
  Piano,
  Puzzle,
  Regex,
  Repeat,
  RotateCw,
  ScanSearch,
  SlidersHorizontal,
  Split,
  SquareTerminal,
  Table2,
  Tag,
  Target,
  Workflow,
} from "lucide-react";
import { useExtracted } from "next-intl";

/**
 * What the learner does in an activity, named in a small badge above the prompt. Each renderer
 * picks one in the registry; add a kind here when a template needs a new verb.
 */
export type ActivityBadgeKind =
  | "beforeAfter"
  | "buildArgument"
  | "buildIt"
  | "buildSentence"
  | "compareSources"
  | "dragCorner"
  | "earTraining"
  | "estimateFirst"
  | "explore"
  | "exploreMap"
  | "fillSquare"
  | "findError"
  | "followKey"
  | "handsOn"
  | "labelIt"
  | "linkCauses"
  | "listen"
  | "matchPairs"
  | "moveCurve"
  | "placeInTime"
  | "placeIt"
  | "playIt"
  | "predictFirst"
  | "predictValue"
  | "putInOrder"
  | "queryData"
  | "readAndListen"
  | "readChart"
  | "reply"
  | "runCode"
  | "simulate"
  | "sortGroups"
  | "splitIt"
  | "spotPattern"
  | "stepByStep"
  | "stepThrough"
  | "tapAlong"
  | "testPattern"
  | "tryIt"
  | "turnIt"
  | "whatIf";

type BadgeTone = "accent" | "highlight" | "secondary";

const BADGES: Record<ActivityBadgeKind, { icon: LucideIcon; tone: BadgeTone }> = {
  beforeAfter: { icon: GitCompareArrows, tone: "secondary" },
  buildArgument: { icon: Puzzle, tone: "accent" },
  buildIt: { icon: Atom, tone: "highlight" },
  buildSentence: { icon: Blocks, tone: "secondary" },
  compareSources: { icon: Columns2, tone: "accent" },
  dragCorner: { icon: Move, tone: "secondary" },
  earTraining: { icon: Ear, tone: "highlight" },
  estimateFirst: { icon: Target, tone: "highlight" },
  explore: { icon: ChartSpline, tone: "accent" },
  exploreMap: { icon: MapPinned, tone: "secondary" },
  fillSquare: { icon: Grid2x2Check, tone: "accent" },
  findError: { icon: ScanSearch, tone: "highlight" },
  followKey: { icon: Split, tone: "secondary" },
  handsOn: { icon: Hand, tone: "accent" },
  labelIt: { icon: Tag, tone: "accent" },
  linkCauses: { icon: Workflow, tone: "highlight" },
  listen: { icon: Headphones, tone: "highlight" },
  matchPairs: { icon: Link2, tone: "accent" },
  moveCurve: { icon: ArrowLeftRight, tone: "secondary" },
  placeInTime: { icon: MoveVertical, tone: "secondary" },
  placeIt: { icon: MoveHorizontal, tone: "secondary" },
  playIt: { icon: Piano, tone: "accent" },
  predictFirst: { icon: Dices, tone: "highlight" },
  predictValue: { icon: Target, tone: "highlight" },
  putInOrder: { icon: ArrowDownUp, tone: "secondary" },
  queryData: { icon: Database, tone: "secondary" },
  readAndListen: { icon: Music, tone: "secondary" },
  readChart: { icon: ChartLine, tone: "secondary" },
  reply: { icon: MessagesSquare, tone: "secondary" },
  runCode: { icon: SquareTerminal, tone: "accent" },
  simulate: { icon: Repeat, tone: "accent" },
  sortGroups: { icon: Group, tone: "secondary" },
  splitIt: { icon: Grid2x2, tone: "accent" },
  spotPattern: { icon: Table2, tone: "accent" },
  stepByStep: { icon: ListOrdered, tone: "secondary" },
  stepThrough: { icon: Footprints, tone: "highlight" },
  tapAlong: { icon: Hand, tone: "highlight" },
  testPattern: { icon: Regex, tone: "accent" },
  tryIt: { icon: SlidersHorizontal, tone: "accent" },
  turnIt: { icon: RotateCw, tone: "accent" },
  whatIf: { icon: GitBranch, tone: "highlight" },
};

function useBadgeLabel(kind: ActivityBadgeKind): string {
  const t = useExtracted();

  const labels: Record<ActivityBadgeKind, string> = {
    beforeAfter: t("Before and after"),
    buildArgument: t("Build an argument"),
    buildIt: t("Build it"),
    buildSentence: t("Build the sentence"),
    compareSources: t("Compare sources"),
    dragCorner: t("Drag a corner"),
    earTraining: t("Ear training"),
    estimateFirst: t("Estimate first"),
    explore: t("Explore"),
    exploreMap: t("Explore the map"),
    fillSquare: t("Fill the square"),
    findError: t("Find the error"),
    followKey: t("Follow the key"),
    handsOn: t("Hands on"),
    labelIt: t("Label it"),
    linkCauses: t("Link causes"),
    listen: t("Listen"),
    matchPairs: t("Match pairs"),
    moveCurve: t("Move a curve"),
    placeInTime: t("Place in time"),
    placeIt: t("Place it"),
    playIt: t("Play it"),
    predictFirst: t("Predict first"),
    predictValue: t("Predict first"),
    putInOrder: t("Put in order"),
    queryData: t("Query the data"),
    readAndListen: t("Read and listen"),
    readChart: t("Read the chart"),
    reply: t("Reply"),
    runCode: t("Run the code"),
    simulate: t("Simulate"),
    sortGroups: t("Sort into groups"),
    splitIt: t("Split it"),
    spotPattern: t("Spot the pattern"),
    stepByStep: t("Step by step"),
    stepThrough: t("Step through"),
    tapAlong: t("Tap along"),
    testPattern: t("Test a pattern"),
    tryIt: t("Try it"),
    turnIt: t("Turn it"),
    whatIf: t("What if"),
  };

  return labels[kind];
}

export function ActivityBadge({ kind }: { kind: ActivityBadgeKind }) {
  const { icon: Icon, tone } = BADGES[kind];
  const label = useBadgeLabel(kind);

  return (
    <span
      className={cn(
        "inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
        tone === "accent" && "bg-viz-accent-soft text-viz-accent",
        tone === "highlight" && "bg-viz-highlight-soft text-viz-highlight",
        tone === "secondary" && "bg-viz-secondary-soft text-viz-secondary",
      )}
      data-slot="activity-badge"
    >
      <Icon aria-hidden="true" className="size-3.5" />
      {label}
    </span>
  );
}
