import "server-only";
import { suggestProfileTools } from "@zoonk/ai/tasks/profile/suggest-tools";
import { prisma } from "@zoonk/db";
import { revalidateCacheTags } from "../../cache/revalidate-cache-tags";
import { getLearningProfileCacheTag } from "../../cache/tags";
import { type OwedFollowUp } from "../../follow-ups/follow-up-contract";
import { unchanged, writeLearnerChange } from "../../learner/_utils/write-learner-change";
import { loadProfileQuestionState, savedProfileAnswer } from "./_utils/profile-question-state";
import { PROFILE_CONTENT } from "./profile-options";

type ToolsTask = Extract<OwedFollowUp, { kind: "suggestProfileTools" }>;

function currentAsk({ id, revision, userId }: ToolsTask) {
  return { failedAt: null, id, kind: "suggestProfileTools" as const, revision, userId };
}

export async function writeProfileToolSuggestions(task: ToolsTask): Promise<string[] | null> {
  const {
    input: { language },
    userId,
  } = task;

  if (!(await prisma.followUp.findUnique({ where: currentAsk(task) }))) {
    return null;
  }

  const [state, goals] = await Promise.all([
    loadProfileQuestionState({ userId }),
    prisma.goal.findMany({
      orderBy: { createdAt: "desc" },
      select: { title: true },
      where: { status: "active", userId },
    }),
  ]);

  if (state.profile?.memoryEnabled === false) {
    return null;
  }

  const work = savedProfileAnswer({ question: "work", state });
  const studies = savedProfileAnswer({ question: "studies", state });

  if (work.question !== "work" || studies.question !== "studies") {
    throw new Error("Could not read the saved work and studies answers");
  }

  const { data } = await suggestProfileTools({
    country: state.profile?.homeCountry ?? null,
    goals: goals.map(({ title }) => title),
    job: work.answer.job,
    language,
    studies: studies.answer.studies.map(({ field, subject }) => {
      const label = PROFILE_CONTENT[language].options.studies[field]?.label ?? field;
      return subject ? `${label}: ${subject}` : label;
    }),
    workStatus: work.answer.status,
  });

  const tools = [...new Set(data.tools.map((tool) => tool.trim()).filter(Boolean))];
  return tools.length > 0 ? tools : null;
}

export async function finishProfileToolSuggestions({
  task,
  result,
}: {
  task: ToolsTask;
  result: { status: "failed" } | { status: "generated"; tools: string[] | null };
}): Promise<void> {
  const { userId } = task;
  const where = currentAsk(task);

  if (result.status === "failed") {
    await prisma.followUp.updateMany({ data: { failedAt: new Date() }, where });
    return;
  }

  const changed = await writeLearnerChange({ userId }, async (tx) => {
    const { count } = await tx.followUp.deleteMany({ where });

    if (count === 0) {
      return unchanged(false);
    }

    const profile = await tx.userLearningProfile.findUnique({ where: { userId } });

    if (!result.tools || profile?.memoryEnabled === false) {
      return false;
    }

    const data = { suggestedTools: result.tools };

    await tx.userLearningProfile.upsert({
      create: { ...data, userId },
      update: data,
      where: { userId },
    });

    return true;
  });

  if (changed) {
    revalidateCacheTags([getLearningProfileCacheTag(userId)]);
  }
}
