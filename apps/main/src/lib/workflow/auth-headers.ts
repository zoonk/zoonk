type WorkflowAuthHeaders = { Authorization?: string };

let listening = false;
let token: Promise<string | undefined> | undefined;

/** Only this tab's sign-ins and sign-outs can leave the kept token stale: other tabs reload on them. */
async function loadAuthClient() {
  const auth = await import("@zoonk/auth/client");

  if (!listening) {
    listening = true;

    auth.authClient.$store.listen("$sessionSignal", () => {
      token = undefined;
    });
  }

  return auth.authClient;
}

function forget(read: Promise<string | undefined>) {
  if (token === read) {
    token = undefined;
  }
}

/**
 * A bearer token, since cross-origin cookies are unreliable for previews, custom domains and remote
 * devices. It's read once and kept: Better Auth limits session reads per network, and screens that
 * ask the API every few seconds would use that limit up. The auth client loads on the first call, so
 * pages that never call the API don't ship it.
 */
export async function getWorkflowAuthHeaders(): Promise<WorkflowAuthHeaders> {
  const client = await loadAuthClient();
  token ??= client.getSession().then(({ data }) => data?.session.token);
  const read = token;

  const value = await read.catch((error: unknown) => {
    forget(read);
    throw error;
  });

  if (!value) {
    forget(read);
    return {};
  }

  return { Authorization: `Bearer ${value}` };
}
