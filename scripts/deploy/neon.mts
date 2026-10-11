import { z } from "zod";
import { request } from "./api.mts";
import { requiredEnv } from "./config.mts";

export function neon({
  path,
  query,
  method,
}: {
  path: string;
  query?: Record<string, string>;
  method?: "GET" | "DELETE";
}): Promise<unknown> {
  const url = new URL(
    `/api/v2/projects/${requiredEnv("NEON_PROJECT_ID")}${path}`,
    "https://console.neon.tech",
  );

  url.search = new URLSearchParams(query).toString();
  return request({ method, token: requiredEnv("NEON_API_KEY"), url });
}

export async function findBranch(name: string): Promise<{ id: string; name: string } | undefined> {
  const response = await neon({ path: "/branches", query: { limit: "10000", search: name } });

  const { branches } = z
    .object({ branches: z.array(z.object({ id: z.string(), name: z.string() })) })
    .parse(response);

  return branches.find((item) => item.name === name || item.id === name);
}
