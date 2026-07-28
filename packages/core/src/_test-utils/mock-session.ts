import { vi } from "vitest";
import { getSession } from "../users/get-session";

/** Selects the signed-in learner returned by the mocked core session resolver. */
export function mockSession(userId: string | null): void {
  vi.mocked(getSession).mockResolvedValue(
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Business tests only read the trusted identity field and should not duplicate Better Auth's complete session fixture.
    userId ? ({ user: { id: userId } } as Awaited<ReturnType<typeof getSession>>) : null,
  );
}

/** Makes the mocked session resolver surface an infrastructure failure. */
export function mockSessionFailure(error: Error): void {
  vi.mocked(getSession).mockRejectedValue(error);
}
