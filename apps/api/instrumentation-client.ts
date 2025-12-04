import { initBotId } from "botid/client/core";

initBotId({
  protect: [
    {
      method: "POST",
      path: "/v1/auth/*",
    },
  ],
});
