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
  return schema.parse(await response.json());
}
