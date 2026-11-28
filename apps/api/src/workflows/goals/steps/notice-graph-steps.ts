import { chooseServiceTier } from "@zoonk/ai/provider-options";
import { findUncoveredTopics } from "@zoonk/ai/tasks/curriculum/exam-outline";
import {
  type SkillGraphParams,
  type SkillsPart,
} from "@zoonk/ai/tasks/curriculum/skill-graph-calls";
import { normalizeNoticeSections } from "@zoonk/ai/tasks/curriculum/skill-graph-generation";
import { applyGraphCoverage } from "@zoonk/core/library/curriculum/add-coverage-skills";
import { type GoalCurriculumInputs } from "@zoonk/core/library/curriculum/goal-curriculum-inputs";
import {
  buildNoticeFramePrompt,
  extendNoticeFrame,
  listMissingNoticeSubjects,
} from "@zoonk/core/library/curriculum/notice-graph-sections";
import { type GoalSkillGraph } from "@zoonk/core/library/curriculum/save-goal-skills";
import { type CurriculumScope, getScopeModel } from "@zoonk/core/library/curriculum/scope";
import { toScopedGraphPrompt } from "@zoonk/core/library/curriculum/shared-graph-prompt";
import {
  writeSkillGraphFrame,
  writeSkillGraphSection,
} from "@zoonk/core/library/curriculum/write-skill-graph";
import { toContentAnalytics } from "../../_shared/content-analytics";
import { type GoalRunContext } from "../goal-run-context";
import { readGraphCoverage } from "./check-graph-coverage";

export type NoticeGraphParams = Omit<
  SkillGraphParams,
  "examBlueprint" | "findLibrarySkills" | "onSkillNamed"
> & { examBlueprint: NonNullable<SkillGraphParams["examBlueprint"]> };

type NoticeGraphCheck = {
  graph: GoalSkillGraph;
  params: NoticeGraphParams;
  references: GoalCurriculumInputs["references"];
};

export async function prepareGoalNoticeParamsStep({
  context,
  inputs,
  scope,
}: {
  context: GoalRunContext;
  inputs: GoalCurriculumInputs;
  scope: CurriculumScope;
}): Promise<NoticeGraphParams | null> {
  "use step";

  const prompt = toScopedGraphPrompt({ inputs, scope });

  return prompt.examBlueprint
    ? {
        ...prompt,
        analytics: toContentAnalytics({ ...context, scope }),
        examBlueprint: prompt.examBlueprint,
        model: getScopeModel(scope),
        serviceTier: chooseServiceTier({ wait: "learner" }),
      }
    : null;
}

export async function placeNoticeSkillsStep(input: NoticeGraphCheck) {
  "use step";

  const { graph, params } = input;
  const outline = params.examBlueprint;
  const { data, provenance } = await readGraphCoverage(input);

  const placed = applyGraphCoverage({
    coverage: { ...data, missing: [] },
    graph,
    outline: {
      ...outline,
      subjects: outline.subjects.map((subject) => ({ ...subject, topics: [] })),
    },
  });

  const missingSubjects = listMissingNoticeSubjects({ graph: placed.graph, outline });

  if (missingSubjects.length === 0) {
    return {
      ...applyGraphCoverage({ coverage: data, graph, outline }),
      missingSubjects,
      needsCoverage: false,
      provenance,
    };
  }

  return {
    ...placed,
    missingSubjects,
    needsCoverage: data.missing.some(
      (skill) =>
        !missingSubjects.some(
          (id) => skill.area === outline.subjects[Number(id.slice(1)) - 1]?.name,
        ),
    ),
    provenance,
  };
}

export async function extendNoticeFrameStep({
  graph,
  params,
  subjects,
}: Pick<NoticeGraphCheck, "graph" | "params"> & { subjects: readonly string[] }) {
  "use step";

  const { output } = await writeSkillGraphFrame(
    buildNoticeFramePrompt({ graph, outline: params.examBlueprint, params }),
  );

  return extendNoticeFrame({ draft: output, graph, subjects });
}

export async function writeNoticeSubjectStep({
  frame,
  params,
  subject,
}: {
  frame: SkillsPart["frame"];
  params: NoticeGraphParams;
  subject: string;
}) {
  "use step";

  const sections = frame.sections.filter((section) => section.subject === subject);

  const { output, provenance } = await writeSkillGraphSection({
    params: { ...params, librarySkills: false },
    part: { frame, library: null, sections },
  });

  if (output.skills.length === 0) {
    throw new Error(`No skills were written for notice subject ${subject}.`);
  }

  return { output, provenance };
}

export async function addNoticeSectionsStep({
  frame,
  graph,
  needsCoverage,
  outline,
  subjects,
  written,
}: {
  frame: SkillsPart["frame"];
  graph: GoalSkillGraph;
  needsCoverage: boolean;
  outline: NoticeGraphParams["examBlueprint"];
  subjects: readonly string[];
  written: Awaited<ReturnType<typeof writeNoticeSubjectStep>>[];
}) {
  "use step";

  const areas = new Set(
    frame.sections
      .filter((section) => subjects.includes(section.subject))
      .map((section) => section.area),
  );

  const skills = normalizeNoticeSections({
    frame,
    outline,
    skills: graph.skills,
    written: written.map(({ output }) => output),
  }).filter((skill) => areas.has(skill.area));

  if ([...areas].some((area) => !skills.some((skill) => skill.area === area))) {
    throw new Error("The graph writer must teach every missing notice subject.");
  }

  const used = new Set(skills.map((skill) => skill.course));
  const existing = new Set(graph.courses.map((course) => course.key));

  const extended = {
    ...graph,
    courses: [
      ...graph.courses,
      ...frame.courses.filter((course) => !existing.has(course.key) && used.has(course.key)),
    ],
    phases:
      graph.phases.length > 0
        ? graph.phases
        : frame.phases.map((phase) => ({ ...phase, estimatedHours: 0 })),
    skills: [...graph.skills, ...skills],
  };

  return {
    graph: extended,
    needsCoverage:
      needsCoverage || findUncoveredTopics({ outline, skills: extended.skills }).length > 0,
  };
}

export async function coverNoticeRemainderStep(input: NoticeGraphCheck) {
  "use step";

  const { data, provenance } = await readGraphCoverage(input);

  return {
    ...applyGraphCoverage({
      coverage: data,
      graph: input.graph,
      outline: input.params.examBlueprint,
    }),
    provenance,
  };
}
