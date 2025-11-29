import { auth } from "@zoonk/auth/testing";

/**
 * Allow signing in as a user and returning the authentication headers.
 *
 * This is useful for simulating authenticated requests in tests.
 */
export async function signInAs(email: string, password: string) {
  const response = await auth.api.signInEmail({
    asResponse: true,
    body: { email, password },
  });

  const cookie = response.headers.get("set-cookie");

  if (!cookie) {
    throw new Error("No set-cookie header found in sign-in response");
  }

  return new Headers({ cookie });
}
