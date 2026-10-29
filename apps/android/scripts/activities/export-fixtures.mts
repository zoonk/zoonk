import { writeFile } from "node:fs/promises";
import { ACTIVITY_FIXTURES_FILE, activityFixtures } from "./activity-fixtures.mts";

await writeFile(ACTIVITY_FIXTURES_FILE, `${JSON.stringify(activityFixtures(), null, 2)}\n`);
