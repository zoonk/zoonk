import { initBotId } from "botid/client/core";

initBotId({
  protect: [
    {
      path: "/api/auth/email-otp/*",
      method: "POST",
    },
    {
      path: "/*/feedback",
      method: "POST",
    },
    {
      path: "/feedback",
      method: "POST",
    },
    {
      path: "/*/help",
      method: "POST",
    },
    {
      path: "/help",
      method: "POST",
    },
  ],
});
