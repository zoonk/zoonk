import { vi } from "vitest";

vi.mock("next/cache");
vi.mock("server-only");
vi.mock("@zoonk/ai/course-suggestions", { spy: true });
