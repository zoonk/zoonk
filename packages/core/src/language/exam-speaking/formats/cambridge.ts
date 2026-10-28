import { type CefrLevel } from "@zoonk/utils/cefr";
import {
  type SpeakingCriterionFormat,
  type SpeakingFormat,
  type SpeakingTaskFormat,
  evenPoints,
  speakingCriteria,
} from "../speaking-format";
import { CAMBRIDGE_TASKS } from "./cambridge-tasks";

const MAX_BAND = 5;
const LEVEL_BAND = 3;

const criterion = speakingCriteria({
  display: "band",
  halfBands: true,
  levelBand: LEVEL_BAND,
  maxBand: MAX_BAND,
  scope: "test",
});

const GRAMMAR_VOCABULARY = criterion({ key: "grammarVocabulary", name: "Grammar and Vocabulary" });
const GRAMMAR = criterion({ key: "grammar", name: "Grammatical Resource" });
const LEXIS = criterion({ key: "lexis", name: "Lexical Resource" });
const DISCOURSE = criterion({ key: "discourse", name: "Discourse Management" });
const PRONUNCIATION = criterion({ key: "pronunciation", name: "Pronunciation", sound: true });

const INTERACTION = criterion({
  interactive: true,
  key: "interaction",
  name: "Interactive Communication",
});

const GLOBAL = criterion({ key: "global", name: "Global Achievement" });

/** Cambridge gives Global Achievement one third of the raw marks; analytic scales share the rest. */
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
