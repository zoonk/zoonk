import { type APIResponse } from "@playwright/test";
import { expect } from "@zoonk/e2e/fixtures";
import { type ZodType } from "zod";

const OK = 200;

export async function readBody<Body>({
  response,
  schema,
  status = OK,
}: {
  response: APIResponse;
  schema: ZodType<Body>;
  status?: number;
}): Promise<Body> {
  expect(response.status(), await response.text()).toBe(status);
  const body: unknown = await response.json();
  const parsed = schema.parse(body);

  expect.soft({ body: parsed }, response.url()).toMatchObject({ body });

  return parsed;
}
