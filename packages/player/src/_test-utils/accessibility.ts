import {
  describeViolations,
  resumeAnimations,
  settleAnimations,
  stillAnimations,
} from "@zoonk/testing/accessibility/scan";
import {
  MIN_TARGET_PX,
  TARGET_SELECTOR,
  findSmallTargets,
  sampleTargets,
} from "@zoonk/testing/accessibility/target-size";
import axe from "axe-core";
import { expect } from "vitest";
import { onDevice } from "./device-media";

const MAX_ANIMATION_WAIT_MS = 3000;

const ANIMATIONS_TIMEOUT_MS = 15_000;

// The host app owns the document title and language; scanning them here would test the harness.
const HOST_DOCUMENT_RULES = {
  "document-title": { enabled: false },
  "html-has-lang": { enabled: false },
};

async function waitForAnimations() {
  await expect
    .poll(() => settleAnimations(MAX_ANIMATION_WAIT_MS), { timeout: ANIMATIONS_TIMEOUT_MS })
    .toBe(0);
}

async function scanScreen(where: string): Promise<string[]> {
  await waitForAnimations();

  const results = await axe.run(document, {
    resultTypes: ["violations"],
    rules: HOST_DOCUMENT_RULES,
  });

  const smallTargets = findSmallTargets(sampleTargets(TARGET_SELECTOR)).map(
    (target) => `${where}: [target-size] ${target} (needs ${MIN_TARGET_PX} px)`,
  );

  return [...describeViolations(results.violations, where).failing, ...smallTargets];
}

async function scanInEachScheme(label: string): Promise<string[]> {
  const light = await onDevice({ colorScheme: "light", contrast: "more" }, () =>
    scanScreen(`${label} (light)`),
  );

  const dark = await onDevice({ colorScheme: "dark", contrast: "more" }, () =>
    scanScreen(`${label} (dark)`),
  );

  return [...light, ...dark];
}

async function scanCurrentScreen(label: string): Promise<string[]> {
  stillAnimations();

  try {
    return await scanInEachScheme(label);
  } finally {
    resumeAnimations();
  }
}

export async function expectAccessibleScreen(label: string) {
  await expect(scanCurrentScreen(label)).resolves.toStrictEqual([]);
}
