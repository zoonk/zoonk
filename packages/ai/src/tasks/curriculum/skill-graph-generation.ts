import {
  combineTaskProvenance,
  sumLanguageModelUsage,
} from "../../provenance/combine-task-provenance";
import { draftAgainWhenFlawed } from "../_utils/draft-again";
import { EmptySkillGraphError } from "./_utils/empty-skill-graph-error";
import { findRedraftProblems, redraftFlawedSections } from "./_utils/graph-drafts";
import { addLibraryCourses, formatLibrarySkills } from "./_utils/library-skills";
import { toKey } from "./_utils/normalize-skill-graph";
import {
  type GraphFrameSection,
  shouldWriteInSections,
  toSectionCalls,
} from "./_utils/skill-graph-sections";
import {
  type SkillGraphParams,
  type SkillsPart,
  type generateSkillGraphFrame,
  type generateSkillGraphSection,
  type generateWholeSkillGraph,
} from "./skill-graph-calls";

type Generation = {
  params: SkillGraphParams;
  tasks: {
    frame: typeof generateSkillGraphFrame;
    section: typeof generateSkillGraphSection;
    whole: (
      params: SkillGraphParams,
    ) => Promise<Awaited<ReturnType<typeof generateWholeSkillGraph>> | null>;
  };
};

function generateCheckedWholeGraph({ params, tasks }: Generation) {
  return draftAgainWhenFlawed({
    countProblems: ({ data }) => findRedraftProblems({ data, params }).length,
    draft: async () => {
      const whole = await tasks.whole(params);

      if (!whole) {
        throw new EmptySkillGraphError();
      }

      return { ...whole, courseIdsByKey: {} };
    },
  });
}

/**
 * Written in sections at once, so it takes about as long as its largest part (a public-service
 * exam's 13,500 tokens took three minutes in one call).
 */
async function generateSectionedGraph({ params, tasks }: Generation) {
  const frame = await tasks.frame(params);

  const output = {
    ...frame.output,
    courses: frame.output.courses.map((course) => ({ ...course, key: toKey(course.key) })),
    sections: frame.output.sections.map((section) => ({
      ...section,
      course: toKey(section.course),
    })),
  };

  const calls = toSectionCalls(output.sections);

  if (calls.length === 0) {
    return generateCheckedWholeGraph({ params, tasks });
  }

  const courses = output.courses.map(({ key, title }) => ({ key, title }));
  const library = await params.findLibrarySkills?.({ courses, provenance: frame.provenance });
  const framed = library ? addLibraryCourses({ frame: output, library }) : output;
  const listed = library ? formatLibrarySkills(library.skills) : null;

  const toPart = (sections: readonly GraphFrameSection[]): SkillsPart => ({
    frame: framed,
    library: listed,
    sections,
  });

  const written = await Promise.all(
    calls.map((sections) => tasks.section({ params, part: toPart(sections) })),
  );

  const { rewrites, ...draft } = await redraftFlawedSections({
    frame: framed,
    library: library?.skills ?? [],
    params,
    rewrite: (index) => tasks.section({ params, part: toPart(calls[index] ?? []) }),
    written,
  });

  const parts = [frame, ...written, ...rewrites];

  return {
    ...draft,
    courseIdsByKey: library?.courseIdsByKey ?? {},
    provenance: combineTaskProvenance(parts.map((part) => part.provenance)),
    systemPrompt: frame.systemPrompt,
    usage: sumLanguageModelUsage(parts.map((part) => part.usage)),
    userPrompt: parts.map((part) => part.userPrompt).join("\n"),
  };
}

/**
 * Code repairs what it can and reports it in `repaired`. A graph it still finds flawed is written
 * once more; a big exam's only in its flawed sections, unless the flaw is in its phases.
 */
export function runSkillGraphGeneration({ params, tasks }: Generation) {
  // A shared exam's courses are found before its skills are written, so it always has a frame.
  if (!shouldWriteInSections(params) && !params.findLibrarySkills) {
    return generateCheckedWholeGraph({ params, tasks });
  }

  return draftAgainWhenFlawed({
    countProblems: ({ data }) =>
      findRedraftProblems({ data, params }).filter((problem) => problem.keys.length === 0).length,
    draft: () => generateSectionedGraph({ params, tasks }),
  });
}
