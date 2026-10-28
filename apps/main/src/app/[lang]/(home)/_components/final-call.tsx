import { Stop, StopEyebrow, StopHeader, StopMark, StopTitle } from "@/components/public/stop";
import { FlagIcon } from "lucide-react";
import { getExtracted } from "next-intl/server";
import { FINAL_GOAL_ID } from "./home-ids";
import { LandingGoalBox } from "./landing-goal-box";

const CLOSE_TITLE_ID = "landing-close-title";

export async function FinalCall({ startPath }: { startPath: string }) {
  const t = await getExtracted();

  return (
    <Stop aria-labelledby={CLOSE_TITLE_ID} className="pb-20 sm:pb-28 lg:pb-32" rail>
      <StopHeader>
        <StopEyebrow>
          <StopMark>
            <FlagIcon className="size-3.5" />
          </StopMark>
          {t("The big day")}
        </StopEyebrow>

        <StopTitle id={CLOSE_TITLE_ID}>{t("What's your big day?")}</StopTitle>
      </StopHeader>

      <div className="max-w-column mt-7 w-full lg:mt-8">
        <LandingGoalBox action={startPath} id={FINAL_GOAL_ID} />
      </div>
    </Stop>
  );
}
