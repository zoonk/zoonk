import { isDeepStrictEqual } from "node:util";
import { AdminJson } from "@/components/admin-json";
import { jsonObjects, textOf } from "@/components/content-words";
import { toWords } from "@/lib/format";
import { parseChallengeLessonSpec } from "@zoonk/core/library/challenges/lesson-spec";
import { parseStoredLessonSpec } from "@zoonk/core/library/lessons/stored-spec";
import { type StoredChange } from "@zoonk/core/staff/content-fixes/contract";
import { FACT_SEPARATOR } from "@zoonk/utils/facts";
import { NO_NAMES, ValueChange } from "./content-fix-values";

type StoredPlan = Extract<StoredChange, { op: "setPlan" }>;
type Fields = Record<string, unknown>;
type Passage = { fields: { after: unknown; before: unknown; key: string }[]; heading: string };

/** Kept by the server for its own planning; a fix never changes them. */
const SERVER_KEYS = new Set(["estimatedMinutes", "plannedAt", "sourcedProvisions"]);

const LABELS: Record<string, string> = {
  activityTemplate: "Activity",
  brief: "What the screen covers",
  canDo: "What learners can do after it",
  skills: "Skills it practices",
  useCase: "When it's used",
  visual: "Picture",
  visualKind: "Kind of picture",
};

function skillNames(plan: Fields): string[] {
  return jsonObjects(plan.skills).map((skill) =>
    typeof skill.name === "string" ? skill.name : "",
  );
}

/** A plan screen lists its skills by their place in the plan; the reviewer reads their names. */
function inWords({ key, plan, value }: { key: string; plan: Fields; value: unknown }): unknown {
  if (key === "skills" && Array.isArray(value)) {
    const names = skillNames(plan);

    return value
      .map((index: unknown) => (typeof index === "number" ? names[index] : String(index)))
      .join(", ");
  }

  if (Array.isArray(value) && value.every((entry) => typeof entry === "string")) {
    return value.join(", ");
  }

  return value;
}

function changedFields({
  after,
  afterPlan,
  before,
  beforePlan,
  skip = new Set(),
}: {
  after: Fields | undefined;
  afterPlan: Fields;
  before: Fields | undefined;
  beforePlan: Fields;
  skip?: ReadonlySet<string>;
}): Passage["fields"] {
  const keys = [...new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})])];

  return keys
    .filter((key) => !skip.has(key) && !isDeepStrictEqual(before?.[key], after?.[key]))
    .map((key) => ({
      after: inWords({ key, plan: afterPlan, value: after?.[key] }),
      before: inWords({ key, plan: beforePlan, value: before?.[key] }),
      key,
    }));
}

/** Each part of the plan that changes, named the way the plan reads: "Lesson plan · Screen 7 · Explanation". */
function planPassages(before: Fields, after: Fields): Passage[] {
  const lesson: Passage = {
    fields: changedFields({
      after,
      afterPlan: after,
      before,
      beforePlan: before,
      skip: new Set([...SERVER_KEYS, "screens", "skills"]),
    }),
    heading: "Lesson plan",
  };

  const parts = (key: "screens" | "skills") => {
    const [old, next] = [jsonObjects(before[key]), jsonObjects(after[key])];

    return Array.from({ length: Math.max(old.length, next.length) }, (_, index) => {
      const part = next[index] ?? old[index] ?? {};

      const name =
        key === "screens" ? textOf(part.kind) && toWords(String(part.kind)) : textOf(part.name);

      return {
        fields: changedFields({
          after: next[index],
          afterPlan: after,
          before: old[index],
          beforePlan: before,
        }),
        heading: [
          "Lesson plan",
          `${key === "screens" ? "Screen" : "Skill"} ${String(index + 1)}`,
          name,
          !old[index] && "New",
          !next[index] && "Removed",
        ]
          .filter(Boolean)
          .join(FACT_SEPARATOR),
      };
    });
  };

  return [lesson, ...parts("skills"), ...parts("screens")].filter(
    (passage) => passage.fields.length > 0,
  );
}

function normalizedPlan(plan: Fields) {
  return parseChallengeLessonSpec(plan) ?? parseStoredLessonSpec(plan) ?? plan;
}

/** The plan's passages that change, each in context, and the whole plan behind a toggle. */
export function PlanChange({ change }: { change: StoredPlan }) {
  const [spec] = change.fields;
  const passages = planPassages(normalizedPlan(spec.before), normalizedPlan(spec.after));

  const wholePlan = (
    <div className="grid gap-x-3 md:grid-cols-2">
      <AdminJson label="Whole plan before" value={spec.before} />
      <AdminJson label="Whole plan after" value={spec.after} />
    </div>
  );

  if (passages.length === 0) {
    return (
      <li className="flex flex-col gap-1">
        <h3 className="text-sm font-semibold">Lesson plan</h3>
        <p className="text-sm">Only how the plan is stored changes.</p>
        {wholePlan}
      </li>
    );
  }

  return passages.map((passage, index) => (
    <li className="flex flex-col gap-1" key={passage.heading}>
      <h3 className="text-sm font-semibold">{passage.heading}</h3>
      <ul className="divide-y">
        {passage.fields.map((field) => (
          <ValueChange
            after={field.after}
            before={field.before}
            key={field.key}
            label={LABELS[field.key] ?? toWords(field.key)}
            names={NO_NAMES}
          />
        ))}
      </ul>
      {index === passages.length - 1 && wholePlan}
    </li>
  ));
}
