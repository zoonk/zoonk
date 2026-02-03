import { ApiReference } from "@scalar/nextjs-api-reference";

// oxlint-disable-next-line new-cap
export const GET = ApiReference({
  darkMode: true,
  theme: "default",
  url: "/v1/docs/openapi.json",
});
