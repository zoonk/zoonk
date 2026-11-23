import { chooseServiceTier } from "@zoonk/ai/provider-options";
import {
  type LevelTestOutPreparationInput,
  finishLevelTestOutPreparation,
  readLevelTestOutPreparation,
  writeLevelTestOutListeningSet,
} from "@zoonk/core/language/level-test/test-out-prepare";
import { getWorkflowMetadata } from "workflow";
import { type ContentAnalytics, toContentAnalytics } from "../_shared/content-analytics";
import { storeKeyCheckedItemSet } from "../_shared/item-set-steps";
import { acquireRunToken } from "../_shared/run-token";
import { preparePlacementItems } from "../goals/placement-items";
import { voiceListeningRecording } from "../listening/voice-listening-recording";

const wait = "soon";

type Preparation = NonNullable<Awaited<ReturnType<typeof readLevelTestOutPreparation>>>;
type Context = { analytics: ContentAnalytics; workflowRunId: string };

async function readPreparationStep(input: LevelTestOutPreparationInput) {
  "use step";

  return readLevelTestOutPreparation(input);
}

async function writeListeningStep({
  analytics,
  level,
  language,
  scriptLanguage,
  topic,
}: Pick<Preparation, "level" | "language" | "scriptLanguage"> & {
  analytics: ReturnType<typeof toContentAnalytics>;
  topic: NonNullable<Preparation["topic"]>;
}) {
  "use step";

  return writeLevelTestOutListeningSet({
    analytics,
    language,
    level,
    scriptLanguage,
    serviceTier: chooseServiceTier({ wait }),
    topic,
  });
}

async function finishPreparationStep(input: LevelTestOutPreparationInput) {
  "use step";

  await finishLevelTestOutPreparation(input);
}

async function prepareListening({
  context,
  input,
  preparation,
}: {
  context: Context;
  input: LevelTestOutPreparationInput;
  preparation: Preparation;
}) {
  if (preparation.listening) {
    return;
  }

  const key = preparation.unvoicedSetId ?? preparation.topic?.id;

  if (!key) {
    return;
  }

  using claim = await acquireRunToken(`level-test-out-listening:${key}`);
  const current = await readPreparationStep(input);

  if (claim.conflict || !current || current.listening) {
    return;
  }

  const { language, level, scriptLanguage, topic } = current;
  const analytics = toContentAnalytics({ ...context, scope: { ownerId: null } });

  const setId =
    current.unvoicedSetId ??
    (topic?.id === key
      ? await storeKeyCheckedItemSet({
          analytics,
          set: await writeListeningStep({ analytics, language, level, scriptLanguage, topic }),
          wait,
        })
      : null);

  if (setId) {
    await voiceListeningRecording({ ...context, setId, wait });
  }
}

export async function levelTestOutPreparationWorkflow({
  skillIds,
  ...input
}: LevelTestOutPreparationInput & { skillIds: string[] }): Promise<void> {
  "use workflow";

  const preparation = await readPreparationStep(input);

  if (!preparation) {
    return;
  }

  const { goalId, userId } = input;

  const context = {
    analytics: { distinctId: userId, goalId },
    workflowRunId: getWorkflowMetadata().workflowRunId,
  };

  const stillEligible = new Set(preparation.skillIds);

  try {
    if (preparation.questions.length === 0) {
      const results = await Promise.allSettled([
        preparePlacementItems({
          ...context,
          exceptAnswered: true,
          formats: ["multipleChoice", "tap"],
          goalId,
          skillIds: skillIds.filter((id) => stillEligible.has(id)),
        }),
        prepareListening({ context, input, preparation }),
      ]);

      const failed = results.find((result) => result.status === "rejected");

      if (failed) {
        throw failed.reason;
      }
    }
  } finally {
    await finishPreparationStep(input);
  }
}
