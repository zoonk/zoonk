import { type Lang } from "../story";
import { Checkpoint } from "./buddy-checkpoint";
import { BuddyTab } from "./buddy-energy";
import { BuddyGrew } from "./buddy-grew";
import { EnergyStatsPage, LevelPage } from "./buddy-stats";

export type View = (p: { lang: Lang; state: string; q: URLSearchParams }) => any;

export const views: Record<string, View> = {
  energy: ({ lang, q }) => <BuddyTab lang={lang} q={q} />,
  "energy-page": ({ lang, q }) => <EnergyStatsPage lang={lang} q={q} />,
  level: ({ lang, q }) => <LevelPage lang={lang} q={q} />,
  "buddy-grew": ({ lang, q }) => <BuddyGrew lang={lang} q={q} />,
  checkpoint: ({ lang, q, state }) => (
    <Checkpoint lang={lang} q={q} state={q.get("state") ?? "intro"} />
  ),
};
