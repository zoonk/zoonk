import { type CefrLevel } from "@zoonk/utils/cefr";
import {
  type SpeakingCriterionFormat,
  type SpeakingFormat,
  type SpeakingTaskFormat,
  evenPoints,
} from "../speaking-format";
import { CAMBRIDGE_TASKS } from "./cambridge-tasks";

/**
 * Cambridge English's Speaking paper: the assessor marks the analytic scales and the interlocutor
 * Global Achievement, all from 0 to 5 with half marks, across the whole test. Global Achievement
 * is a third of the raw marks and the analytic scales share the rest equally ("Converting practice
 * test scores", Nov 2023): A2 Key out of 45, B1 Preliminary 30, B2 First 60, C1 Advanced and C2
 * Proficiency 75. Band 3 describes the exam's own level and band 5 the next. There's no minimum
 * per paper: the overall score decides, and Cambridge publishes no conversion of live Speaking
 * marks to its scale. Pronunciation is graded for intelligibility: "even if the speaker has a
 * strong or unfamiliar accent".
 */

const MAX_BAND = 5;
const LEVEL_BAND = 3;

function criterion({
  key,
  name,
  sound = false,
  voiceOnly = sound,
}: {
  key: string;
  name: string;
  sound?: boolean;
  voiceOnly?: boolean;
}): SpeakingCriterionFormat {
  return {
    display: "band",
    halfBands: true,
    key,
    levelBand: LEVEL_BAND,
    maxBand: MAX_BAND,
    name,
    scope: "test",
    sound,
    voiceOnly,
  };
}

const GRAMMAR_VOCABULARY = criterion({ key: "grammarVocabulary", name: "Grammar and Vocabulary" });
const GRAMMAR = criterion({ key: "grammar", name: "Grammatical Resource" });
const LEXIS = criterion({ key: "lexis", name: "Lexical Resource" });
const DISCOURSE = criterion({ key: "discourse", name: "Discourse Management" });
const PRONUNCIATION = criterion({ key: "pronunciation", name: "Pronunciation", sound: true });

const INTERACTION = {
  ...criterion({ key: "interaction", name: "Interactive Communication" }),
  interactive: true,
};

const GLOBAL = criterion({ key: "global", name: "Global Achievement" });

/** Each analytic scale's raw marks are its band times `analytic`, Global Achievement's `global`. */
function cambridgeFormat({
  analytic,
  criteria,
  global,
  level,
  minutes,
  title,
  url,
}: {
  analytic: number;
  criteria: readonly SpeakingCriterionFormat[];
  global: number;
  level: Exclude<CefrLevel, "A1">;
  minutes: SpeakingFormat["minutes"];
  title: string;
  url: string;
}): SpeakingFormat {
  const tasks: readonly SpeakingTaskFormat[] = CAMBRIDGE_TASKS[level];

  const rows = [...criteria, GLOBAL].map((item) => ({
    criterion: item.key,
    points: evenPoints({
      max: MAX_BAND * (item === GLOBAL ? global : analytic),
      maxBand: MAX_BAND,
    }),
    task: null,
  }));

  return {
    criteria: [...criteria, GLOBAL],
    exam: "cambridge",
    level,
    minutes,
    paper: "Speaking",
    pass: { kind: "none" },
    prepMinutes: 0,
    prepTasks: [],
    rows,
    source: `https://www.cambridgeenglish.org/exams-and-tests/qualifications/${url}/format/`,
    tasks,
    title,
    total: rows.reduce((sum, row) => sum + (row.points.at(-1) ?? 0), 0),
  };
}

const ADVANCED_CRITERIA = [GRAMMAR, LEXIS, DISCOURSE, PRONUNCIATION, INTERACTION];

export const CAMBRIDGE_FORMATS: readonly SpeakingFormat[] = [
  cambridgeFormat({
    analytic: 2,
    criteria: [GRAMMAR_VOCABULARY, PRONUNCIATION, INTERACTION],
    global: 3,
    level: "A2",
    minutes: { max: 10, min: 8 },
    title: "A2 Key",
    url: "key",
  }),
  cambridgeFormat({
    analytic: 1,
    criteria: [GRAMMAR_VOCABULARY, DISCOURSE, PRONUNCIATION, INTERACTION],
    global: 2,
    level: "B1",
    minutes: { max: 12, min: 10 },
    title: "B1 Preliminary",
    url: "preliminary",
  }),
  cambridgeFormat({
    analytic: 2,
    criteria: [GRAMMAR_VOCABULARY, DISCOURSE, PRONUNCIATION, INTERACTION],
    global: 4,
    level: "B2",
    minutes: { max: 14, min: 14 },
    title: "B2 First",
    url: "first",
  }),
  cambridgeFormat({
    analytic: 2,
    criteria: ADVANCED_CRITERIA,
    global: 5,
    level: "C1",
    minutes: { max: 15, min: 15 },
    title: "C1 Advanced",
    url: "advanced",
  }),
  cambridgeFormat({
    analytic: 2,
    criteria: ADVANCED_CRITERIA,
    global: 5,
    level: "C2",
    minutes: { max: 16, min: 16 },
    title: "C2 Proficiency",
    url: "proficiency",
  }),
];
