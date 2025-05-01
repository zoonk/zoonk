// If you want to use Phoenix channels, run `mix help phx.gen.channel`
// to get started and then uncomment the line below.
// import "./user_socket.js"

// You can include dependencies in two ways.
//
// The simplest option is to put them in assets/vendor and
// import them using relative paths:
//
//     import "../vendor/some-package.js"
//
// Alternatively, you can `bun install some-package --cwd assets` and import
// them using a path starting with the package name:
//
//     import "some-package"
//

// Include phoenix_html to handle method=PUT/DELETE in forms and buttons.
import "phoenix_html";
// Establish Phoenix Socket and LiveView configuration.
import { Socket } from "phoenix";
import { LiveSocket } from "phoenix_live_view";
import topbar from "../vendor/topbar";
import { DelayLoading } from "./hooks/delay_loading";
import { DialogTrigger } from "./hooks/dialog_trigger";
import { preserveAttrsFromElement } from "./dom/preserve_state";
import "../vendor/posthog";

const csrfToken = document
  .querySelector("meta[name='csrf-token']")
  .getAttribute("content");

/**
 * We use the timezone when storing a user's choice
 * during an exercise.
 *
 * This is useful to show them a performance report,
 * helping them to understand what time of the day
 * they perform better.
 *
 * We're adding it to the liveSocket params so we can
 * get them using `get_connect_params` in the LiveView.
 */
const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

const liveSocket = new LiveSocket("/live", Socket, {
  hooks: { DelayLoading, DialogTrigger },
  longPollFallbackMs: 2500,
  disconnectedTimeout: 2000,
  params: { _csrf_token: csrfToken, timezone },
  metadata: {
    keydown: (e, _el) => {
      return { key: e.key, metaKey: e.metaKey, ctrlKey: e.ctrlKey };
    },
  },
  dom: {
    onBeforeElUpdated: (fromEl, toEl) => {
      preserveAttrsFromElement(fromEl, toEl);
    },
  },
});

// Show progress bar on live navigation and form submits
topbar.config({ barColors: { 0: "#29d" }, shadowColor: "rgba(0, 0, 0, .3)" });
window.addEventListener("phx:page-loading-start", (_info) => topbar.show(1000));
window.addEventListener("phx:page-loading-stop", (_info) => topbar.hide());

if (process.env.NODE_ENV !== "development") {
  // Initialize PostHog
  posthog.init(document.currentScript.dataset.phKey, {
    api_host: "https://ph.zoonk.com",
    person_profiles: "always",
  });

  // Identify the user
  posthog.identify(document.currentScript.dataset.userId);

  // Capture page views with PostHog
  window.addEventListener("phx:navigate", ({ detail: { href } }) =>
    posthog.capture("$pageview", {
      $current_url: href,
    }),
  );
}

// connect if there are any LiveViews on the page
liveSocket.connect();

// expose liveSocket on window for web console debug logs and latency simulation:
// >> liveSocket.enableDebug()
// >> liveSocket.enableLatencySim(1000)  // enabled for duration of browser session
// >> liveSocket.disableLatencySim()
window.liveSocket = liveSocket;
