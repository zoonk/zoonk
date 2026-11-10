import { toIsoDate } from "../../plans/planner/plan-calendar";
import { type ChallengeView } from "../challenge-contract";
import { readBossOffer } from "./challenge-offer";
import { type ChallengeTiming } from "./challenge-timing";
import { type OwnedChallenge } from "./owned-challenge";

export function getWaitingTiming({
  challenge,
  due,
  status,
  timing,
}: {
  challenge: OwnedChallenge;
  due: boolean;
  status: ChallengeView["status"];
  timing: ChallengeTiming | null | undefined;
}): Pick<ChallengeView, "date" | "status"> {
  const { item } = challenge;

  if (item.kind !== "boss") {
    return { date: item.scheduledFor ? toIsoDate(item.scheduledFor) : null, status };
  }

  const offer = readBossOffer(challenge);
  const dated = status === "waiting" && timing?.when === "date" && offer && !offer.waiting;

  return {
    date: due && timing?.when === "date" ? timing.date : null,
    status: dated ? "upcoming" : status,
  };
}
