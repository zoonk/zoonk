import { request } from "@playwright/test";
import { prisma } from "@zoonk/db";
import { guestSessionResponseSchema } from "../../src/lib/openapi/schemas/guests";
import { createAuthenticatedApiContext } from "./auth";
import { readBody } from "./response";

const CREATED = 201;

function createBearerContext({ baseURL, token }: { baseURL: string; token: string }) {
  return request.newContext({ baseURL, extraHTTPHeaders: { Authorization: `Bearer ${token}` } });
}

/** A learner with a bearer session, the way native clients call the API. */
export async function createBearerLearner({
  baseURL,
  prefix,
}: {
  baseURL: string;
  prefix: string;
}) {
  const { apiContext, token, user } = await createAuthenticatedApiContext({ baseURL, prefix });
  await apiContext.dispose();

  return { api: await createBearerContext({ baseURL, token }), userId: user.id };
}

/** A learner promoted to admin; the bearer context reads the session again, with the new role. */
export async function createBearerAdmin({ baseURL, prefix }: { baseURL: string; prefix: string }) {
  const { apiContext, token, user } = await createAuthenticatedApiContext({ baseURL, prefix });

  await Promise.all([
    prisma.user.update({ data: { role: "admin" }, where: { id: user.id } }),
    apiContext.dispose(),
  ]);

  return createBearerContext({ baseURL, token });
}

/** A guest with a bearer session, started the way the apps start one. */
export async function createGuest(baseURL: string) {
  const anonymous = await request.newContext({ baseURL });

  const { token } = await readBody({
    response: await anonymous.post("/v1/guests"),
    schema: guestSessionResponseSchema,
    status: CREATED,
  });

  await anonymous.dispose();

  const [guestApi, user] = await Promise.all([
    createBearerContext({ baseURL, token }),
    prisma.user.findFirstOrThrow({ where: { sessions: { some: { token } } } }),
  ]);

  return { guestApi, token, userId: user.id };
}
