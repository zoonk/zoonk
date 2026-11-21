import { Fold } from "@/components/fold";
import { type Comparison, type PacketOutput } from "@/lib/comparisons/schemas";
import { Badge } from "@zoonk/ui/components/badge";
import { cn } from "@zoonk/ui/lib/utils";
import {
  type CheckResult,
  type FailedCheck,
  type ObservationView,
  type ReadOrder,
  type ReadView,
  type RunView,
} from "../_utils/case-evidence";
import {
  SIDE_LABELS,
  type Side,
  familyLabel,
  findingLabel,
  modelName,
  variantName,
} from "../_utils/labels";
import { imagePath } from "../_utils/paths";
import { OutputImage, type ShownImage } from "./output-image";
import { type OutputMark, ReadableOutput } from "./readable-output";

type CriterionLabels = Record<string, string>;

const SIDE_ORDER: Side[] = ["incumbent", "challenger"];

type NumberedObservation = ObservationView & {
  anchor: string;
  family: string;
  number: number;
  order: ReadOrder;
};

/** Numbered through the current model's answer and then the challenger's, so each answer's list counts up without gaps. */
function numberObservations(caseId: string, run: RunView): NumberedObservation[] {
  return run.reads
    .flatMap((read) =>
      read.observations.map((view) => ({ ...view, family: read.reader.family, order: read.order })),
    )
    .toSorted((left, right) => SIDE_ORDER.indexOf(left.side) - SIDE_ORDER.indexOf(right.side))
    .map((view, index) => ({
      ...view,
      anchor: `problem-${caseId}-${run.run}-${index + 1}`,
      number: index + 1,
    }));
}

/** Readers sometimes wrap a quote in their own quote marks; the output's words are inside them. */
function unquote(text: string): string {
  return text
    .trim()
    .replaceAll(/^["“”'‘’]+|["“”'‘’]+$/gu, "")
    .trim();
}

function marksFor(observations: NumberedObservation[]): OutputMark[] {
  return observations.flatMap((view) =>
    view.observation.location.kind === "quote"
      ? [
          {
            anchor: view.anchor,
            label: String(view.number),
            major: view.observation.severity === "major",
            quote: unquote(view.observation.location.detail),
          },
        ]
      : [],
  );
}

function FindingBadge({ check }: { check: ObservationView["check"] }) {
  if (!check) {
    return null;
  }

  if (check.source === "owner") {
    return <Badge variant="destructive">Counts</Badge>;
  }

  if (!check.checked) {
    return <Badge variant="outline">Not checked</Badge>;
  }

  return <Badge variant={findingVariant(check.finding)}>{findingLabel(check.finding)}</Badge>;
}

function findingVariant(finding: string) {
  if (finding === "holds" || finding === "holds for both") {
    return "destructive";
  }

  return finding === "doesn't hold" ? "success" : "secondary";
}

function CheckReasons({ results }: { results: CheckResult[] }) {
  if (results.length === 0) {
    return null;
  }

  return (
    <ul className="flex flex-col gap-1">
      {results.map((result) => (
        <li className="text-muted-foreground text-xs" key={`${result.family}-${result.reason}`}>
          Checked by {familyLabel(result.family)}: {findingLabel(result.finding)}. {result.reason}
        </li>
      ))}
    </ul>
  );
}

/** A reader names a part of a picture in words, whatever kind it gives, so a picture shows those words. */
function Location({
  observation,
  picture,
}: {
  observation: ObservationView["observation"];
  picture: boolean;
}) {
  const { detail, kind } = observation.location;

  if (picture && kind !== "quote") {
    return <p className="text-muted-foreground text-xs">Where: {detail}</p>;
  }

  if (kind === "quote") {
    return (
      <blockquote className="text-muted-foreground border-s-2 ps-3 text-xs italic">
        “{unquote(detail)}”
      </blockquote>
    );
  }

  return (
    <p className="text-muted-foreground text-xs">
      {kind === "whole" ? "Across the whole output" : "Where"}: {detail}
    </p>
  );
}

function ProblemItem({
  criteria,
  picture,
  view,
}: {
  criteria: CriterionLabels;
  picture: boolean;
  view: NumberedObservation;
}) {
  const { observation } = view;
  const major = observation.severity === "major";

  return (
    <li
      className="flex scroll-mt-20 flex-col gap-1.5 border-t py-3 first:border-t-0"
      id={view.anchor}
    >
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
        <span className="text-muted-foreground font-mono">{view.number}</span>
        <span className={cn("font-medium", major && "text-destructive-text")}>
          {major ? "Major" : "Minor"}
        </span>
        <span className="text-muted-foreground">
          {criteria[observation.criterion] ?? observation.criterion} · found by{" "}
          {familyLabel(view.family)}
          {view.order.paired && `, who saw it as ${observation.output}`}
        </span>
        <FindingBadge check={view.check} />
      </p>
      <p className="text-sm">{observation.claim}</p>
      <p className="text-muted-foreground text-xs">For the learner: {observation.learnerCost}</p>
      <Location observation={observation} picture={picture} />
      {view.check && <CheckReasons results={view.check.results} />}
    </li>
  );
}

/** Named with the check's name, as the decision table's row is, so a row's link lands on what it counted. */
function FailedChecks({ checks }: { checks: FailedCheck[] }) {
  return checks.map((check) => (
    <Fold
      key={check.name}
      title={
        <span className="text-destructive-text">
          Failed {check.total - check.passed} of {check.total} {check.name}
        </span>
      }
    >
      <ul className="flex flex-col gap-1 pb-2">
        {[...new Set(check.problems)].map((problem) => (
          <li className="text-muted-foreground text-xs" key={problem}>
            {problem}
          </li>
        ))}
      </ul>
    </Fold>
  ));
}

/**
 * Beside the other answer, its label, checks, output and problems share rows with it, so both
 * outputs start level whatever sits above them.
 */
function OutputColumn({
  aligned,
  checksRow,
  criteria,
  failedChecks,
  imageIndex,
  images,
  label,
  observations,
  output,
}: {
  aligned: boolean;
  checksRow: boolean;
  criteria: CriterionLabels;
  failedChecks: FailedCheck[];
  imageIndex: number;
  images: ShownImage[];
  label: React.ReactNode;
  observations: NumberedObservation[];
  output: PacketOutput | null;
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col gap-3",
        aligned && "lg:grid lg:grid-rows-subgrid",
        aligned && (checksRow ? "lg:row-span-4" : "lg:row-span-3"),
      )}
    >
      <p className="text-sm font-medium">{label}</p>

      {checksRow && (
        <div className={cn("flex flex-col", failedChecks.length === 0 && "hidden lg:block")}>
          <FailedChecks checks={failedChecks} />
        </div>
      )}

      {imageIndex === -1 ? (
        <div className="rounded-xl border p-4">
          {typeof output === "string" ? (
            <ReadableOutput marks={marksFor(observations)} text={output} />
          ) : (
            <p className="text-muted-foreground text-sm">No output for this run.</p>
          )}
        </div>
      ) : (
        <OutputImage images={images} index={imageIndex} />
      )}

      {observations.length > 0 && (
        <div className="flex flex-col pt-3">
          <p className="text-muted-foreground text-xs">
            {observations.length === 1
              ? "1 problem found"
              : `${observations.length} problems found`}
          </p>
          <ul className="flex flex-col">
            {observations.map((view) => (
              <ProblemItem
                criteria={criteria}
                key={view.anchor}
                picture={imageIndex !== -1}
                view={view}
              />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function isImage(output: PacketOutput | null): output is { image: string } {
  return output !== null && typeof output !== "string";
}

function choiceLabel(choice: Side | "tie"): string {
  return choice === "tie" ? "Tie" : SIDE_LABELS[choice];
}

function orderText(order: ReadOrder): string {
  const second = order.first === "incumbent" ? "challenger" : "incumbent";
  return `A = ${SIDE_LABELS[order.first]}, B = ${SIDE_LABELS[second]}`;
}

function ReadRow({ criteria, read }: { criteria: CriterionLabels; read: ReadView }) {
  return (
    <li className="flex flex-col gap-1 border-t py-3 first:border-t-0">
      <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
        <span className="font-medium">{familyLabel(read.reader.family)}</span>
        {read.reader.channel !== "owner" && (
          <span className="text-muted-foreground font-mono text-xs">
            {modelName(read.reader.model)}
          </span>
        )}
        <span className="text-muted-foreground text-xs">{orderText(read.order)}</span>
        {read.overall && (
          <span className="ms-auto font-medium">Prefers {choiceLabel(read.overall.choice)}</span>
        )}
      </p>

      {read.overall && (
        <p className="text-muted-foreground max-w-3xl text-sm">{read.overall.reason}</p>
      )}

      {read.criteria.length > 0 && (
        <Fold title="By criterion">
          <ul className="flex max-w-3xl flex-col gap-2 pb-2">
            {read.criteria.map((entry) => (
              <li className="text-sm" key={entry.criterion}>
                <span className="font-medium">{criteria[entry.criterion] ?? entry.criterion}</span>
                {": "}
                {choiceLabel(entry.choice)}.
                {entry.reason && <span className="text-muted-foreground"> {entry.reason}</span>}
              </li>
            ))}
          </ul>
        </Fold>
      )}
    </li>
  );
}

function RunSection({
  caseId,
  criteria,
  manifest,
  run,
  showRun,
}: {
  caseId: string;
  criteria: CriterionLabels;
  manifest: Comparison["manifest"];
  run: RunView;
  showRun: boolean;
}) {
  const observations = numberObservations(caseId, run);
  const { challenger, incumbent } = manifest.variants;
  const sides: Side[] = incumbent ? ["incumbent", "challenger"] : ["challenger"];
  const preferences = run.reads.filter((read) => read.overall);

  const pictured = sides.flatMap((side) => {
    const output = run.outputs[side];

    return isImage(output)
      ? [
          {
            alt: `The ${SIDE_LABELS[side].toLowerCase()} model’s picture`,
            label: SIDE_LABELS[side],
            side,
            src: imagePath({ hash: output.image, id: manifest.id, taskId: manifest.taskId }),
          },
        ]
      : [];
  });

  return (
    <div className="flex flex-col gap-4">
      {showRun && <p className="text-muted-foreground font-mono text-xs">Run {run.run}</p>}

      <div
        className={cn("grid gap-6", sides.length === 2 ? "lg:grid-cols-2 lg:gap-y-3" : "max-w-3xl")}
      >
        {sides.map((side) => {
          const variant = side === "incumbent" ? incumbent : challenger;

          return (
            <OutputColumn
              aligned={sides.length === 2}
              checksRow={sides.some((entry) => run.failedChecks[entry].length > 0)}
              criteria={criteria}
              failedChecks={run.failedChecks[side]}
              imageIndex={pictured.findIndex((image) => image.side === side)}
              images={pictured}
              key={side}
              label={
                <>
                  {sides.length === 2 && `${SIDE_LABELS[side]} · `}
                  <span className="font-mono text-xs">{variant && variantName(variant)}</span>
                </>
              }
              observations={observations.filter((view) => view.side === side)}
              output={run.outputs[side]}
            />
          );
        })}
      </div>

      {preferences.length > 0 && (
        <div className="flex flex-col">
          <p className="text-muted-foreground text-xs">What each reader preferred</p>
          <ul className="flex flex-col">
            {preferences.map((read) => (
              <ReadRow criteria={criteria} key={read.key} read={read} />
            ))}
          </ul>
        </div>
      )}

      {run.reads.length === 0 && (
        <p className="text-muted-foreground text-sm">Nobody has read this run yet.</p>
      )}
    </div>
  );
}

/** A case's runs: the outputs side by side, the problems under the output they're about, then each reader's preference. */
export function CaseRuns({
  caseId,
  comparison,
  runs,
}: {
  caseId: string;
  comparison: Comparison;
  runs: RunView[];
}) {
  const criteria = Object.fromEntries(
    comparison.manifest.criteria.map((criterion) => [criterion.id, criterion.label]),
  );

  return (
    <div className="flex flex-col gap-8">
      {runs.map((run) => (
        <RunSection
          caseId={caseId}
          criteria={criteria}
          key={run.run}
          manifest={comparison.manifest}
          run={run}
          showRun={runs.length > 1}
        />
      ))}
    </div>
  );
}
