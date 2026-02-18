import { initBotId } from "botid/client/core";

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
