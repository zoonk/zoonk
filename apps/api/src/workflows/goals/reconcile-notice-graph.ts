import {
  addNoticeSectionsStep,
  coverNoticeRemainderStep,
  extendNoticeFrameStep,
  placeNoticeSkillsStep,
  writeNoticeSubjectStep,
} from "./steps/notice-graph-steps";

export async function reconcileNoticeGraph(input: Parameters<typeof placeNoticeSkillsStep>[0]) {
  const placed = await placeNoticeSkillsStep(input);

  if (placed.missingSubjects.length === 0) {
    return { ...placed, provenanceByKey: {} };
  }

  const frame = await extendNoticeFrameStep({
    ...input,
    graph: placed.graph,
    subjects: placed.missingSubjects,
  });

  const written = await Promise.all(
    placed.missingSubjects.map((subject) =>
      writeNoticeSubjectStep({ frame, params: input.params, subject }),
    ),
  );

  const added = await addNoticeSectionsStep({
    frame,
    graph: placed.graph,
    needsCoverage: placed.needsCoverage,
    outline: input.params.examBlueprint,
    subjects: placed.missingSubjects,
    written,
  });

  const checked = added.needsCoverage
    ? await coverNoticeRemainderStep({ ...input, graph: added.graph })
    : { graph: added.graph, provenance: placed.provenance };

  const provenanceByArea = new Map(
    frame.sections.flatMap((section) => {
      const part = written[placed.missingSubjects.indexOf(section.subject)];
      return part ? [[section.area, part.provenance]] : [];
    }),
  );

  const existing = new Set(placed.graph.skills.map((skill) => skill.key));

  const provenanceByKey = Object.fromEntries(
    added.graph.skills.flatMap((skill) => {
      const provenance = provenanceByArea.get(skill.area);
      return !existing.has(skill.key) && provenance ? [[skill.key, provenance]] : [];
    }),
  );

  return { ...checked, changed: true, provenanceByKey };
}
