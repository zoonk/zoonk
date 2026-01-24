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
      path: "/api/auth/*",
    },
    {
      method: "GET",
      path: "/*/learn/*",
    },
    {
      method: "GET",
      path: "/learn/*",
    },
    {
      method: "GET",
      path: "/*/generate/*",
    },
    {
      method: "GET",
      path: "/generate/*",
    },
    {
      method: "GET",
      path: "/api/workflows/*",
    },
    {
      method: "POST",
      path: "/api/workflows/*",
    },
  ],
});
