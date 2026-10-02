import { AdminSection, AdminSectionEmpty } from "@/components/admin-section";
import { getSkill } from "@/data/skills/get-skill";
import {
  type GraphSkill,
  MAX_GRAPH_SKILLS,
  MAX_PREREQUISITE_DEPTH,
  getSkillGraph,
} from "@/data/skills/get-skill-graph";
import { cn } from "@zoonk/ui/lib/utils";
import { ChevronRightIcon } from "lucide-react";
import Link from "next/link";
import { Fragment } from "react";

type GraphColumn = { key: string; skills: GraphSkill[]; title: string };

/** Direct prerequisites sit next to the skill; earlier layers move left. */
function getPrerequisiteColumnTitle(layerIndex: number): string {
  return layerIndex === 0 ? "Direct prerequisites" : `${layerIndex + 1} steps back`;
}

/**
 * Deepest prerequisites on the left, then each layer closer to the skill, the
 * skill itself, and the skills that build on it on the right.
 */
function buildGraphColumns({
  currentSkill,
  dependents,
  prerequisiteLayers,
}: {
  currentSkill: GraphSkill | null;
  dependents: GraphSkill[];
  prerequisiteLayers: GraphSkill[][];
}): GraphColumn[] {
  const prerequisiteColumns = prerequisiteLayers
    .map((skills, index) => ({
      key: `layer-${index}`,
      skills,
      title: getPrerequisiteColumnTitle(index),
    }))
    .toReversed();

  return [
    ...prerequisiteColumns,
    { key: "current", skills: currentSkill ? [currentSkill] : [], title: "This skill" },
    ...(dependents.length > 0
      ? [{ key: "dependents", skills: dependents, title: "Builds toward" }]
      : []),
  ];
}

export async function SkillGraph({ skillId }: { skillId: string }) {
  "use cache: private";

  const [graph, skill] = await Promise.all([getSkillGraph(skillId), getSkill(skillId)]);
  const isEmpty = graph.prerequisiteLayers.length === 0 && graph.dependents.length === 0;

  return (
    <AdminSection
      description={`Prerequisites up to ${MAX_PREREQUISITE_DEPTH} steps back and the skills that list this one as a prerequisite, at most ${MAX_GRAPH_SKILLS} per side.`}
      title="Prerequisite graph"
    >
      {isEmpty ? (
        <AdminSectionEmpty>
          This skill has no prerequisites and nothing builds on it.
        </AdminSectionEmpty>
      ) : (
        <div className="flex items-stretch gap-2 overflow-x-auto pb-2">
          {buildGraphColumns({ ...graph, currentSkill: skill }).map((column, index) => (
            <Fragment key={column.key}>
              {index > 0 ? (
                <ChevronRightIcon
                  aria-hidden
                  className="text-muted-foreground size-4 shrink-0 self-center"
                />
              ) : null}
              <SkillGraphColumn column={column} currentSkillId={skillId} />
            </Fragment>
          ))}
        </div>
      )}
    </AdminSection>
  );
}

function SkillGraphColumn({
  column,
  currentSkillId,
}: {
  column: GraphColumn;
  currentSkillId: string;
}) {
  return (
    <div className="flex w-52 shrink-0 flex-col gap-2">
      <span className="text-muted-foreground text-xs">{column.title}</span>

      {column.skills.map((skill) =>
        skill.id === currentSkillId ? (
          <span
            className="bg-primary text-primary-foreground rounded-md px-2 py-1.5 text-xs font-medium"
            key={skill.id}
          >
            {skill.name}
          </span>
        ) : (
          <SkillGraphNode key={skill.id} skill={skill} />
        ),
      )}
    </div>
  );
}

/** Merged skills stay on the graph, struck through, so a stale edge is easy to spot. */
function SkillGraphNode({ skill }: { skill: GraphSkill }) {
  return (
    <Link
      className={cn(
        "hover:bg-muted rounded-md border px-2 py-1.5 text-xs",
        skill.mergedIntoId && "text-muted-foreground line-through",
      )}
      href={`/skills/${skill.id}`}
      prefetch={false}
      title={skill.mergedIntoId ? "Merged into another skill" : undefined}
    >
      {skill.name}
      {skill.level ? (
        <span className="text-muted-foreground block capitalize">{skill.level}</span>
      ) : null}
    </Link>
  );
}
