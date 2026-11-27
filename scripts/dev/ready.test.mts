import { expect, test } from "vitest";
import { formatServices, isAppAnswer, redirectsToItself, sortServices } from "./ready.mts";

test("an app counts as answering once the proxy passes its own response on", () => {
  const unregistered = JSON.stringify({
    error: "not_found",
    message: "No app registered for main.zoonk.localhost",
  });

  expect(isAppAnswer({ body: unregistered, status: 404 })).toBe(false);
  expect(isAppAnswer({ body: "Bad Gateway", status: 502 })).toBe(false);
  expect(isAppAnswer({ body: "<html>Page not found</html>", status: 404 })).toBe(true);
  expect(isAppAnswer({ body: "", status: 307 })).toBe(true);
});

test("an app that redirects its URL to that same URL can't be opened", () => {
  const url = "http://main.zoonk.localhost:1355/";

  expect(redirectsToItself({ location: "/", status: 307, url })).toBe(true);
  expect(redirectsToItself({ location: url, status: 308, url })).toBe(true);
  expect(redirectsToItself({ location: "/today", status: 307, url })).toBe(false);
  expect(redirectsToItself({ location: null, status: 200, url })).toBe(false);
});

test("the list leads with Main and the API and lines the URLs up", () => {
  const names = sortServices(["mailbox", "evals", "api", "main"]);

  expect(names).toStrictEqual(["main", "api", "evals", "mailbox"]);

  expect(
    formatServices(names.map((name) => ({ name, url: `http://${name}.zoonk.localhost:1355` }))),
  ).toBe(
    [
      "  Main     http://main.zoonk.localhost:1355",
      "  API      http://api.zoonk.localhost:1355",
      "  Evals    http://evals.zoonk.localhost:1355",
      "  Mailbox  http://mailbox.zoonk.localhost:1355",
    ].join("\n"),
  );
});
