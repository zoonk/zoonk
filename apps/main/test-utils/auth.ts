import { signInAs } from "@zoonk/testing/fixtures/auth";
import { headers } from "next/headers";
import { vi } from "vitest";

/** Signs in a fixture user and exposes that session through the current request headers. */
export async function signInAsCurrentUser({
  email,
  password,
}: {
  email: string;
  password: string;
}) {
  const requestHeaders = await signInAs(email, password);

  vi.mocked(headers).mockResolvedValue(requestHeaders);

  return requestHeaders;
}
