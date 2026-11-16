export type MockEntryHrefs = { choose: string; mock: (id: string) => string };

/**
 * Where the way into a mock exam leads: on with the one already running, or to the chooser.
 * `runningId` is a mock the plan started, which the chooser's own view doesn't know about.
 */
export function getMockEntryTarget({
  hrefs,
  runningId = null,
  view,
}: {
  hrefs: MockEntryHrefs;
  runningId?: string | null;
  view: { options: readonly unknown[]; running: { id: string } | null };
}): { href: string; resume: boolean } | null {
  const resumeId = runningId ?? view.running?.id ?? null;

  if (resumeId) {
    return { href: hrefs.mock(resumeId), resume: true };
  }

  return view.options.length > 0 ? { href: hrefs.choose, resume: false } : null;
}
