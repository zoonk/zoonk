import { readFileSync } from "node:fs";
import { join } from "node:path";

type Manifest = Record<string, Record<string, { exportedName?: string; filename?: string }>>;

const MANIFESTS = [".next/server", ".next/dev/server"].map((directory) =>
  join("apps/main", directory, "server-reference-manifest.json"),
);

export function readActionNames(repository: string): Map<string, string> {
  const names = new Map<string, string>();

  for (const path of MANIFESTS) {
    try {
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Next.js's own manifest shape.
      const manifest = JSON.parse(readFileSync(join(repository, path), "utf8")) as Manifest;

      for (const [id, action] of Object.entries({ ...manifest.edge, ...manifest.node })) {
        names.set(id, `${action.exportedName ?? "action"} in ${action.filename ?? "?"}`);
      }
    } catch {
      // That build doesn't exist in this checkout.
    }
  }

  return names;
}
