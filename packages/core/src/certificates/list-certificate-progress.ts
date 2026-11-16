import "server-only";
import { prisma } from "@zoonk/db";
import { cacheTag } from "next/cache";
import { getCertificatesCacheTag, getGoalsCacheTag, getUserProgressCacheTag } from "../cache/tags";
import { getGoalLanguageFlag } from "../goals/_utils/goal-language-flag";
import { getSession } from "../users/get-session";
import { UNIT_PLAN_SELECT, loadCertificateUnits } from "./_utils/load-certificate-units";
import { type CertificateProgress } from "./certificate-contract";

export type CertificateProgressResult =
  | { status: "ready"; upNext: CertificateProgress[] }
  | { status: "unauthorized" };

export async function listCurrentUserCertificateProgress(): Promise<CertificateProgressResult> {
  "use cache: private";
  const session = await getSession();

  if (!session) {
    return { status: "unauthorized" };
  }

  const userId = session.user.id;

  cacheTag(
    getCertificatesCacheTag(userId),
    getGoalsCacheTag(userId),
    getUserProgressCacheTag(userId),
  );

  const goals = await prisma.goal.findMany({
    include: { plan: { select: UNIT_PLAN_SELECT } },
    orderBy: { createdAt: "asc" },
    where: { kind: { in: ["learn", "exam", "language"] }, status: "active", userId },
  });

  const measured = await Promise.all(
    goals.map(async (goal): Promise<CertificateProgress | null> => {
      if (goal.kind !== "language" && !goal.plan) {
        return null;
      }

      const loaded =
        goal.kind !== "language" && goal.plan
          ? await loadCertificateUnits({ goal, plan: goal.plan })
          : null;

      const held = new Set(loaded?.held.map((unit) => unit.key));
      const unit = loaded?.earnable.find((entry) => !held.has(entry.key));

      if (goal.kind !== "language" && !unit) {
        return null;
      }

      return {
        displayName: goal.displayName,
        id: goal.id,
        languageFlag: getGoalLanguageFlag(goal),
        progress: unit?.progress ?? null,
        targetLanguage: goal.targetLanguage,
        targetRegion: goal.targetRegion,
      };
    }),
  );

  const upNext = measured.filter((goal) => goal !== null);

  return { status: "ready", upNext };
}
