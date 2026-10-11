export const PROJECTS = [
  {
    app: "api",
    get id() {
      return requiredEnv("VERCEL_PROJECT_ID_API");
    },
    name: "zoonk-api",
    productionDomain: "api.zoonk.com",
    stagingDomain: "api.zoonk.dev",
  },
  {
    app: "main",
    get id() {
      return requiredEnv("VERCEL_PROJECT_ID_MAIN");
    },
    name: "zoonk",
    productionDomain: "www.zoonk.com",
    stagingDomain: "main.zoonk.dev",
  },
  {
    app: "admin",
    get id() {
      return requiredEnv("VERCEL_PROJECT_ID_ADMIN");
    },
    name: "zoonk-admin",
    productionDomain: "admin.zoonk.com",
    stagingDomain: "admin.zoonk.dev",
  },
] as const;

export function requiredEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing ${name}`);
  }

  return value;
}
