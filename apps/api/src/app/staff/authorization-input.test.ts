import { userFixture } from "@zoonk/testing/fixtures/users";
import * as logger from "@zoonk/utils/logger";
import { describe, expect, it, vi } from "vitest";
import { cliTokenFixture } from "../../../../../packages/auth/src/_test-utils/cli-tokens";
import { staffRequest } from "./_test-utils/requests";
import { sendStaffAuthorization } from "./_test-utils/staff-authorization";
import { POST as count } from "./records/count/route";
import { POST as get } from "./records/get/route";
import { POST as list } from "./records/list/route";
import { POST as find } from "./users/find/route";
import { POST as search } from "./users/search/route";

const routes = [
  { path: "/staff/records/get", post: get },
  { path: "/staff/records/list", post: list },
  { path: "/staff/records/count", post: count },
  { path: "/staff/users/find", post: find },
  { path: "/staff/users/search", post: search },
];

describe("staff authorization before input parsing", () => {
  it.each(routes)(
    "$path refuses and logs invalid bodies before reading them",
    async ({ path, post }) => {
      const learner = await userFixture();
      const { accessToken } = await cliTokenFixture({ user: learner });
      const log = vi.spyOn(logger, "logInfo");
      sendStaffAuthorization();
      const missingRequest = staffRequest({ body: null, path });
      const missing = await post(missingRequest);
      expect(missing.status).toBe(401);
      expect(missingRequest.bodyUsed).toBe(false);
      expect(log).toHaveBeenCalledOnce();

      sendStaffAuthorization(`Bearer ${accessToken}`);
      const forbidden = await post(staffRequest({ body: null, path }));
      expect(forbidden.status).toBe(403);
      expect(log).toHaveBeenCalledTimes(2);

      sendStaffAuthorization();

      const malformed = await post(
        new Request(`http://localhost${path}`, { body: "{broken", method: "POST" }),
      );

      expect(malformed.status).toBe(401);
      expect(log).toHaveBeenCalledTimes(3);
    },
  );
});
