type WorkflowAuthHeaders = { Authorization?: string };

let token: string | undefined;
let pending: ReturnType<typeof readSession> | undefined;

async function readSession() {
  const { authClient } = await import("@zoonk/auth/client");
  const session = await authClient.getSession();

  if (session.data) {
    token = session.data.session.token;
  }

  return session;
}

/**
 * API calls send the last session the page learned of: from this read, which every browser read of
 * the session goes through, or from a guest sign-in, which hands its token to `keepSessionToken`. A
 * read that finds no session keeps the token, so one sent during a guest sign-in can't erase the
 * guest's. Calls while a read is in flight share it, so an older answer can't land after a newer one.
 */
export function readBrowserSession(): ReturnType<typeof readSession> {
  pending ??= readSession().finally(() => {
    pending = undefined;
  });

  return pending;
}

export function keepSessionToken(value: string) {
  token = value;
}

/**
 * A bearer token, since cross-origin cookies are unreliable for previews, custom domains and remote
 * devices. It's kept from the last session the page learned of: Better Auth limits session reads per
 * network, and screens that ask the API every few seconds would use that limit up. The auth client
 * loads on the first call, so pages that never call the API don't ship it.
 */
export async function getWorkflowAuthHeaders(): Promise<WorkflowAuthHeaders> {
  if (!token) {
    await readBrowserSession();
  }

  return token ? { Authorization: `Bearer ${token}` } : {};
}
