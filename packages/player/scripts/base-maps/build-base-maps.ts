import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { activityBaseMaps } from "@zoonk/core/library/activities/base-maps";
import { MAP_SOURCES } from "./map-sources";
import { renderMap } from "./render-map";

const OUTPUT = join(import.meta.dirname, "../../src/activities/_assets/base-maps/generated");
const KILOBYTE = 1024;

/**
 * Draws every base map in core's catalog into `src/activities/_assets/base-maps/generated`.
 * Run it after changing a map: `pnpm --filter @zoonk/player maps:build`.
 */
for (const map of activityBaseMaps) {
  const drawing = renderMap(MAP_SOURCES[map.id]());
  const json = JSON.stringify(drawing);
  writeFileSync(join(OUTPUT, `${map.id}.json`), `${json}\n`);

  process.stdout.write(
    `${map.id}: ${drawing.regions.length} regions, ${Math.round(json.length / KILOBYTE)} KB\n`,
  );
}
