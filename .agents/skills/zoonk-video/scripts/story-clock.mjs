import { readFileSync } from "node:fs";

// Screens that count days from now (days left, review dates) read the same on any capture date.
const story = readFileSync(new URL("../realui/story.ts", import.meta.url), "utf8");
const STORY_NOW = new Date(story.match(/export const TODAY = "([^"]+)"/)[1]);

export const pinStoryClock = (context) => context.clock.setFixedTime(STORY_NOW);
