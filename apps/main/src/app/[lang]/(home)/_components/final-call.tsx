import { ClosingCall } from "@/components/public/closing-call";
import { getExtracted } from "next-intl/server";
import { GoalBox } from "./goal-box";
import { FINAL_GOAL_ID } from "./home-ids";

/** The page ends where it started: the goal box, with nothing else to decide. */
export async function FinalCall({ startPath }: { startPath: string }) {
  const t = await getExtracted();

  return (
    <ClosingCall
      lead={t("Write it the way you'd say it. Your plan and first lesson come next.")}
      note={t("Free to start. No account needed for your first lesson.")}
      title={t("What do you want to get ready for?")}
    >
      <GoalBox action={startPath} id={FINAL_GOAL_ID} variant="pill" />
    </ClosingCall>
  );
}
