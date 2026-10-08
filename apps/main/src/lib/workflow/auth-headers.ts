type WorkflowAuthHeaders = { Authorization?: string };

/**
 * Reads the current same-origin Better Auth session so browser workflow calls
 * can authenticate to the centralized API with Better Auth's bearer-token
 * contract. Cross-origin cookies are unreliable for previews, custom domains,
 * and remote-device testing, while the API already accepts this session token
 * through the Authorization header. The auth client loads on the first call, so pages that never
 * call the API (every page has the feedback form) don't ship it up front.
 */
export async function getWorkflowAuthHeaders(): Promise<WorkflowAuthHeaders> {
  const { authClient } = await import("@zoonk/auth/client");
  const { data } = await authClient.getSession();
  const token = data?.session.token;

  return token ? { Authorization: `Bearer ${token}` } : {};
}
