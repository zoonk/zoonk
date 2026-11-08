type WorkflowAuthHeaders = { Authorization?: string };

let token: string | undefined;
let pending: ReturnType<typeof readSession> | undefined;

async function readSession() {
  const { authClient } = await import("@zoonk/auth/client");
  const session = await authClient.getSession();

  if (!session.error) {
    token = session.data?.session.token;
  }

  return session;
}

/**
 * Every browser read of the session goes through here, so API calls send the token of the session
 * the page saw last, such as a guest's made after the old session ended. Calls while a read is in
 * flight share it, so an older answer can't land after a newer one.
 */
export function readBrowserSession(): ReturnType<typeof readSession> {
  pending ??= readSession().finally(() => {
    pending = undefined;
  });

  return pending;
}

/**
 * A bearer token, since cross-origin cookies are unreliable for previews, custom domains and remote
 * devices. It's kept from the last session read: Better Auth limits session reads per network, and
 * screens that ask the API every few seconds would use that limit up. The auth client loads on the
 * first call, so pages that never call the API don't ship it.
 */
export async function getWorkflowAuthHeaders(): Promise<WorkflowAuthHeaders> {
  if (!token) {
    await readBrowserSession();
  }

  return token ? { Authorization: `Bearer ${token}` } : {};
}
