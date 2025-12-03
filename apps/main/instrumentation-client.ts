import { initBotId } from "botid/client/core";

initBotId({
  protect: [
    {
      method: "GET",
      path: "/*/learn/*",
    },
    {
      method: "GET",
      path: "/learn/*",
    },
  ],
});
