import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { actionAsyncStorage } from "next/dist/server/app-render/action-async-storage.external.js";
import { workAsyncStorage } from "next/dist/server/app-render/work-async-storage.external.js";
import { workUnitAsyncStorage } from "next/dist/server/app-render/work-unit-async-storage.external.js";
import { createRequestStore } from "next/dist/server/async-storage/request-store.js";
import { createWorkStore } from "next/dist/server/async-storage/work-store.js";
import { defaultConfig } from "next/dist/server/config-shared.js";
import { getImplicitTags } from "next/dist/server/lib/implicit-tags.js";
import { IncrementalCache } from "next/dist/server/lib/incremental-cache/index.js";
import { nodeFs } from "next/dist/server/lib/node-fs-methods.js";
import { withExecuteRevalidates } from "next/dist/server/revalidation-utils.js";
import { CloseController, trackBodyConsumed } from "next/dist/server/web/web-on-close.js";

type FlowHandler = (request: Request) => Promise<Response>;

const FLOW_PAGE = "/.well-known/workflow/v1/flow/route";
const PRERENDER_MANIFEST_VERSION = 4;

/**
 * Next 16.4's real route stores and filesystem cache execute tag invalidation without a dev
 * server. These installed internal entrypoints are confined to the runtime test harness.
 */
export function withNextRouteContext({
  handler,
  root,
}: {
  handler: FlowHandler;
  root: string;
}): FlowHandler {
  const previewProps = {
    previewModeEncryptionKey: randomUUID(),
    previewModeId: randomUUID(),
    previewModeSigningKey: randomUUID(),
  };

  const incrementalCache = new IncrementalCache({
    dev: false,
    flushToDisk: true,
    fs: nodeFs,
    prerenderManifest: {
      dynamicRoutes: {},
      notFoundRoutes: [],
      // oxlint-disable-next-line typescript/no-deprecated -- Next's IncrementalCache still requires this PrerenderManifest field.
      preview: previewProps,
      routes: {},
      version: PRERENDER_MANIFEST_VERSION,
    },
    previewProps,
    requestHeaders: {},
    serverDistDir: resolve(root, "next", "server"),
  });

  return async (request) => {
    const closeController = new CloseController();
    const url = new URL(request.url);
    const implicitTags = await getImplicitTags(FLOW_PAGE, url.pathname, null);

    const requestStore = createRequestStore({
      headers: request.headers,
      hmrRefreshHash: undefined,
      implicitTags,
      isHmrRefresh: false,
      onUpdateCookies: undefined,
      phase: "action",
      previewProps,
      resumeDataCache: null,
      rootParams: {},
      serverComponentsHmrCache: undefined,
      stagedFallbackParams: null,
      url: { pathname: url.pathname, search: url.search },
    });

    const workStore = createWorkStore({
      buildId: "workflow-runtime-test",
      deploymentId: "workflow-runtime-test",
      page: FLOW_PAGE,
      previouslyRevalidatedTags: [],
      renderOpts: {
        cacheComponents: true,
        cacheLifeProfiles: {
          ...defaultConfig.cacheLife,
          default: {
            ...defaultConfig.cacheLife.default,
            stale: defaultConfig.experimental.staleTimes.static,
          },
        },
        experimental: {
          authInterrupts: true,
          durableUseCacheEntries: false,
          isRoutePPREnabled: false,
          useCacheTimeout: defaultConfig.staticPageGenerationTimeout,
        },
        incrementalCache,
        isBuildTimePrerendering: false,
        onAfterTaskError: undefined,
        onClose: closeController.onClose.bind(closeController),
        staticPageGenerationTimeout: defaultConfig.staticPageGenerationTimeout,
        validationLevel: "manual-warning",
        waitUntil: undefined,
      },
    });

    const response = await actionAsyncStorage.run({ isAppRoute: true }, () =>
      workUnitAsyncStorage.run(requestStore, () =>
        workAsyncStorage.run(workStore, () =>
          withExecuteRevalidates(workStore, () => handler(request)),
        ),
      ),
    );

    if (!response.body) {
      closeController.dispatchClose();
      return response;
    }

    return new Response(
      trackBodyConsumed(response.body, closeController.dispatchClose.bind(closeController)),
      response,
    );
  };
}
