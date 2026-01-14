import { reportError } from "@zoonk/error-reporter/client";

window.addEventListener("error", (event) => {
  reportError(event.error);
});

window.addEventListener("unhandledrejection", (event) => {
  reportError(event.reason);
});
