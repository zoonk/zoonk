import { reportError } from "@zoonk/error-reporter/client";
import { initBotId } from "botid/client/core";

globalThis.addEventListener("error", (event) => {
  reportError(event.error);
});

globalThis.addEventListener("unhandledrejection", (event) => {
  reportError(event.reason);
});

initBotId({
  protect: [
    {
      method: "POST",
      path: "/v1/*",
    },
    {
      method: "GET",
      path: "/v1/*",
    },
    {
      method: "PATCH",
      path: "/v1/*",
    },
  ],
});
