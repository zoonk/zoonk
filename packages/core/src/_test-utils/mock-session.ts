import { vi } from "vitest";
import { getSession } from "../users/get-session";

export function mockSession(userId: string | null): void {
  vi.mocked(getSession).mockResolvedValue(
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Business tests only read the trusted identity field and should not duplicate Better Auth's complete session fixture.
    userId ? ({ user: { id: userId } } as Awaited<ReturnType<typeof getSession>>) : null,
  );
}

export function mockGuestSession(userId: string): void {
  vi.mocked(getSession).mockResolvedValue(
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Business tests only read the identity and guest flag.
    { user: { id: userId, isAnonymous: true } } as Awaited<ReturnType<typeof getSession>>,
  );
}

export function mockSessionFailure(error: Error): void {
  vi.mocked(getSession).mockRejectedValue(error);
}

export function mockAccountSession({
  expiresAt = new Date("2099-01-01T00:00:00.000Z"),
  isAnonymous = false,
  signedInAt = new Date("2026-01-01T00:00:00.000Z"),
  user,
}: {
  expiresAt?: Date;
  isAnonymous?: boolean;
  signedInAt?: Date;
  user: { email: string; id: string; name: string };
}): void {
  const session = {
    session: { createdAt: signedInAt, expiresAt },
    user: { email: user.email, id: user.id, image: null, isAnonymous, name: user.name },
  };

  vi.mocked(getSession).mockResolvedValue(
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Reads that show the account need its fields and the session's times, not Better Auth's whole session.
    session as Awaited<ReturnType<typeof getSession>>,
  );
}
