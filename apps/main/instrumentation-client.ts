import { initBotId } from "botid/client/core";

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
  ],
});
