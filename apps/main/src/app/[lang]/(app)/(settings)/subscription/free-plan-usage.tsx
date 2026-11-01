import { PLAN_ACTION_NOTE_CLASS } from "@/components/pricing/plus-cta";
import { type Allowance } from "@zoonk/core/entitlements/contract";
import { getExtracted } from "next-intl/server";

function renderCount(chunks: React.ReactNode) {
  return <span className="font-mono tabular-nums">{chunks}</span>;
}

export async function FreePlanUsage({ allowance }: { allowance: Allowance }) {
  const t = await getExtracted();
  const messages = allowance.items.find((item) => item.kind === "tutorMessage");

  if (messages?.dailyLimit === null || messages?.dailyLimit === undefined) {
    return null;
  }

  return (
    <p className={PLAN_ACTION_NOTE_CLASS}>
      {t.rich("<mono>{used, number}/{limit, number}</mono> buddy messages used today", {
        limit: messages.dailyLimit,
        mono: renderCount,
        used: messages.usedToday,
      })}
    </p>
  );
}
