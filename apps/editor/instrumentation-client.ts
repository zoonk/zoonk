import { reportError } from "@zoonk/error-reporter/client";

globalThis.addEventListener("error", (event) => {
  reportError(event.error);
});

globalThis.addEventListener("unhandledrejection", (event) => {
  reportError(event.reason);
});
