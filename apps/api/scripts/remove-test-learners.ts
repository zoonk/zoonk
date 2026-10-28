/** Lists the test learners by default; `--yes` removes them. */
import { parseArgs } from "node:util";
import { prisma } from "@zoonk/db";
import { logError, logInfo } from "@zoonk/utils/logger";
import {
  clearTestLeftovers,
  countOnboardedLearners,
  countSharedLibrary,
  countTestLeftovers,
  findTestLearners,
  getTestLearnerRefusal,
  removeTestLearner,
} from "./_utils/test-learners";

type TestLearner = Awaited<ReturnType<typeof findTestLearners>>[number];

function describeLearner({ _count, email, isAnonymous }: TestLearner): string {
  const kind = isAnonymous ? "guest" : "account";

  return `  ${email} (${kind}): goals ${_count.goals}, private courses ${_count.ownedCourses}, private lessons ${_count.ownedLessons}`;
}

async function describePlan(learners: TestLearner[]) {
  const [shared, leftovers, onboarded] = await Promise.all([
    countSharedLibrary(),
    countTestLeftovers(),
    countOnboardedLearners(),
  ]);

  logInfo(
    [
      `Test learners to remove: ${learners.length} (guests ${learners.filter((learner) => learner.isAnonymous).length})`,
      ...learners.map((learner) => describeLearner(learner)),
      `Leftovers to clear: guest AI spend days ${leftovers.guestSpendDays}, account-deletion log entries ${leftovers.accountDeletions}`,
      `Kept: the seeded learners, onboarded learners to copy from (${onboarded}) and the shared Library (courses ${shared.courses}, lessons ${shared.lessons}, skills ${shared.skills})`,
    ].join("\n"),
  );
}

/** Removes each learner on its own, so one failure doesn't stop the rest and a rerun finishes it. */
async function removeLearners(learners: TestLearner[]): Promise<boolean> {
  const results = await Promise.allSettled(learners.map((learner) => removeTestLearner(learner)));

  const failures = results.flatMap((result, index) =>
    result.status === "rejected" ? [`${learners[index]?.email}: ${String(result.reason)}`] : [],
  );

  if (failures.length > 0) {
    logError(`Couldn't remove these learners; run it again to finish:\n${failures.join("\n")}`);
    return false;
  }

  const cleared = await clearTestLeftovers();

  logInfo(
    `Removed: test learners ${learners.length}, guest AI spend days ${cleared.guestSpendDays}, account-deletion log entries ${cleared.accountDeletions}`,
  );

  return true;
}

async function removeTestLearners(): Promise<boolean> {
  const { values } = parseArgs({ options: { yes: { default: false, type: "boolean" } } });
  const refusal = getTestLearnerRefusal();

  if (refusal) {
    throw new Error(`Refusing to remove test learners: ${refusal}`);
  }

  const learners = await findTestLearners();
  await describePlan(learners);

  if (!values.yes) {
    logInfo("Dry run: nothing was removed. Run it again with --yes to remove them.");
    return true;
  }

  return removeLearners(learners);
}

try {
  process.exitCode = (await removeTestLearners()) ? 0 : 1;
} catch (error) {
  logError(error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
