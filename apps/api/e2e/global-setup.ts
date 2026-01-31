import { mkdir } from "node:fs/promises";

export default async function globalSetup(): Promise<void> {
  await mkdir("e2e/.auth", { recursive: true });
}
