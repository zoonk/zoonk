type WorkflowAuthHeaders = { Authorization?: string };

/**
 * A bearer token, since cross-origin cookies are unreliable for previews, custom domains and remote
 * devices. The auth client loads on the first call, so pages that never call the API don't ship it.
 */
export async function getWorkflowAuthHeaders(): Promise<WorkflowAuthHeaders> {
  const { authClient } = await import("@zoonk/auth/client");
  const { data } = await authClient.getSession();
  const token = data?.session.token;

  return token ? { Authorization: `Bearer ${token}` } : {};
}
