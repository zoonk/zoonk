import "server-only";
import { type ItemSetTarget, pickItemSetTargets } from "../../lookahead/item-set-targets";
import { type MockFormatShortfall } from "./mock-shortfall";
import { loadMockWritingSkills } from "./mock-writing-skills";

export async function pickMockSetTargets({
  goalId,
  quickFormat,
  writes,
}: { quickFormat: ItemSetTarget["format"]; writes: readonly MockFormatShortfall[] } & {
  goalId: string;
}): Promise<ItemSetTarget[]> {
  const groups = Map.groupBy(
    writes.filter((write) => write.format.writer.kind === "quick"),
    (write) => write.format.key,
  );

  const targets = await Promise.all(
    [...groups.values()].map(async (group) => {
      const format = group[0]?.format;

      if (!format || format.writer.kind !== "quick") {
        return [];
      }

      const skillIds = [...new Set(group.flatMap((write) => write.skillIds))];

      if (skillIds.length < 2) {
        return [];
      }

      const sets = await pickItemSetTargets({ goalId, mockSkillIds: skillIds });

      const skills = await loadMockWritingSkills({
        goalId,
        skillIds: sets.flatMap((set) => set.skills.map((skill) => skill.id)),
      });

      const byId = new Map(skills.map((skill) => [skill.id, skill]));
      const { choice } = format.writer;

      return sets
        .map((target) => ({
          ...target,
          format: choice?.kind ?? quickFormat,
          skills: target.skills.flatMap((old) => {
            const skill = byId.get(old.id);

            if (!skill) {
              return [];
            }

            const exam = skill.exam && {
              ...skill.exam,
              optionCount: choice?.options ?? skill.exam.optionCount,
              style: [
                format.style ?? skill.exam.style,
                skill.wrongPenalty && `Wrong answer penalty: ${skill.wrongPenalty}.`,
              ]
                .filter(Boolean)
                .join(" "),
            };

            return [{ ...old, exam, usedSituations: skill.usedSituations }];
          }),
        }))
        .filter((target) => target.skills.length >= 2);
    }),
  );

  return targets.flat();
}
