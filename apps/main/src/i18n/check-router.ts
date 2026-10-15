import { type TypedNavigationRouter } from "./navigation";

/**
 * A router that moves only while the page still belongs to the learner the browser holds
 * (`check`): a navigation, a refresh or a step through history is dropped once a departure was
 * decided (the page is covered and reloading). It calls the real router synchronously, so a
 * caller's own transition still holds what it starts (a screen waiting on its refresh keeps
 * waiting).
 */
export function checkRouter(
  router: TypedNavigationRouter,
  check: () => boolean,
): TypedNavigationRouter {
  return {
    ...router,
    back: () => {
      if (check()) {
        router.back();
      }
    },
    forward: () => {
      if (check()) {
        router.forward();
      }
    },
    push: (href, options) => {
      if (check()) {
        router.push(href, options);
      }
    },
    refresh: () => {
      if (check()) {
        router.refresh();
      }
    },
    replace: (href, options) => {
      if (check()) {
        router.replace(href, options);
      }
    },
  };
}
