import { authClient } from "@zoonk/core/auth/client";

type WorkflowAuthHeaders = { Authorization?: string };

/**
 * Reads the current same-origin Better Auth session so browser workflow calls
 * can authenticate to the centralized API with Better Auth's bearer-token
 * contract. Cross-origin cookies are unreliable for previews, custom domains,
 * and remote-device testing, while the API already accepts this session token
 * through the Authorization header.
 */
export async function getWorkflowAuthHeaders(): Promise<WorkflowAuthHeaders> {
  const { data } = await authClient.getSession();
  const token = data?.session.token;

  return token ? { Authorization: `Bearer ${token}` } : {};
}
