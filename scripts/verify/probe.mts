/**
 * What `pnpm verify:pages` watches inside the page. Every function here runs in the browser and
 * reads nothing outside itself, so Playwright can send it with `addInitScript` or `evaluate`; that
 * is why helpers live inside the function that uses them. Times are milliseconds since the
 * document's navigation started (`performance.now()`).
 */
export type ProbeState = {
  clicks: number[];
  fcp: number | null;
  lastMutationAt: number;
  lcp: number | null;
  shifts: { at: number; sources: string[]; value: number }[];
  /** Frames on which a loading skeleton was visible. */
  skeletonFrames: number[];
  urls: { at: number; href: string }[];
};

declare global {
  // oxlint-disable-next-line no-var -- A page global is declared with `var`.
  var zoonkVerify: ProbeState | undefined;
}

/** Starts watching before the page's own scripts run: layout shifts, paints, skeletons, URLs. */
export function installProbe() {
  const MAX_FRAMES = 2000;
  const TEXT_LENGTH = 30;

  const state: ProbeState = {
    clicks: [],
    fcp: null,
    lastMutationAt: 0,
    lcp: null,
    shifts: [],
    skeletonFrames: [],
    urls: [{ at: 0, href: location.href }],
  };

  globalThis.zoonkVerify = state;

  // oxlint-disable-next-line unicorn/consistent-function-scoping -- The probe is sent as one function.
  function describe(node: Node | null | undefined): string {
    if (!(node instanceof HTMLElement || node instanceof SVGElement)) {
      return "#text";
    }

    const id = node.id ? `#${node.id}` : "";
    const slot = node.dataset.slot ? `[data-slot=${node.dataset.slot}]` : "";
    const className = node.classList[0] ? `.${node.classList[0]}` : "";
    const text = node.textContent?.trim().slice(0, TEXT_LENGTH);
    return `${node.tagName.toLowerCase()}${id}${slot}${className}${text ? ` "${text}"` : ""}`;
  }

  /** The DOM library doesn't type layout shifts yet. */
  type ShiftEntry = PerformanceEntry & {
    hadRecentInput: boolean;
    sources?: { node?: Node | null }[];
    value: number;
  };

  new PerformanceObserver((list) => {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- A layout-shift observer only lists layout shifts.
    for (const entry of list.getEntries() as ShiftEntry[]) {
      if (!entry.hadRecentInput) {
        state.shifts.push({
          at: entry.startTime,
          sources: (entry.sources ?? []).map((source) => describe(source.node)),
          value: entry.value,
        });
      }
    }
  }).observe({ buffered: true, type: "layout-shift" });

  new PerformanceObserver((list) => {
    state.lcp = list.getEntries().at(-1)?.startTime ?? state.lcp;
  }).observe({ buffered: true, type: "largest-contentful-paint" });

  new PerformanceObserver((list) => {
    state.fcp = list.getEntriesByName("first-contentful-paint")[0]?.startTime ?? state.fcp;
  }).observe({ buffered: true, type: "paint" });

  new MutationObserver(() => {
    state.lastMutationAt = performance.now();
  }).observe(document, { characterData: true, childList: true, subtree: true });

  document.addEventListener("click", () => state.clicks.push(performance.now()), true);

  function watchFrame() {
    const now = performance.now();
    const skeletons = [...document.querySelectorAll('[data-slot="skeleton"]')];

    if (
      state.skeletonFrames.length < MAX_FRAMES &&
      skeletons.some((element) => element.checkVisibility() && element.getClientRects().length > 0)
    ) {
      state.skeletonFrames.push(now);
    }

    if (state.urls.at(-1)?.href !== location.href) {
      state.urls.push({ at: now, href: location.href });
    }

    requestAnimationFrame(watchFrame);
  }

  requestAnimationFrame(watchFrame);
}

/** The probe's state, with the document's start (`timeOrigin`, ms since the epoch) and now. */
export function readProbe(): (ProbeState & { now: number; timeOrigin: number }) | null {
  const state = globalThis.zoonkVerify;
  return state ? { ...state, now: performance.now(), timeOrigin: performance.timeOrigin } : null;
}

/** Bytes the page load transferred: its HTML, its scripts, and everything together. */
export function transferredBytes() {
  const [navigation] = performance.getEntriesByType("navigation");
  const html = navigation instanceof PerformanceNavigationTiming ? navigation.transferSize : 0;

  const resources = performance
    .getEntriesByType("resource")
    .filter((entry) => entry instanceof PerformanceResourceTiming);

  // oxlint-disable-next-line unicorn/consistent-function-scoping -- The probe is sent as one function.
  const sum = (entries: PerformanceResourceTiming[]) =>
    entries.reduce((total, entry) => total + entry.transferSize, 0);

  return {
    html,
    scripts: sum(resources.filter((entry) => entry.initiatorType === "script")),
    total: html + sum(resources),
  };
}

/** Whether this is `next dev`: its dev tools mount a `nextjs-portal`, a production build doesn't. */
export function isNextDev(): boolean {
  return document.querySelector("nextjs-portal") !== null;
}

/**
 * The page's width against the viewport's and, when it scrolls sideways, the outermost elements
 * that stick out past the viewport outside any scroller that clips them (a carousel doesn't count).
 */
export function findOverflow() {
  const MAX_OFFENDERS = 5;
  const TEXT_LENGTH = 30;
  const viewportWidth = document.documentElement.clientWidth;
  const { scrollWidth } = document.documentElement;

  if (scrollWidth <= viewportWidth) {
    return { offenders: [], scrollWidth, viewportWidth };
  }

  // oxlint-disable-next-line unicorn/consistent-function-scoping -- The probe is sent as one function.
  function clipped(element: Element): boolean {
    for (let parent = element.parentElement; parent && parent !== document.body;) {
      if (getComputedStyle(parent).overflowX !== "visible") {
        return true;
      }

      parent = parent.parentElement;
    }

    return false;
  }

  const sticking = [...document.body.querySelectorAll<HTMLElement>("*")].filter((element) => {
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.right > viewportWidth + 1 && !clipped(element);
  });

  const outermost = sticking.filter(
    (element) => !sticking.some((other) => other !== element && other.contains(element)),
  );

  return {
    offenders: outermost.slice(0, MAX_OFFENDERS).map((element) => {
      const slot = element.dataset.slot ? `[data-slot=${element.dataset.slot}]` : "";
      const text = element.textContent?.trim().slice(0, TEXT_LENGTH);
      const right = Math.round(element.getBoundingClientRect().right);
      return `${element.tagName.toLowerCase()}${slot}${text ? ` "${text}"` : ""} (right edge ${right} px)`;
    }),
    scrollWidth,
    viewportWidth,
  };
}

/** This site's links someone can see on screen now (path and query), other than the page's own. */
export function visibleLinks(): string[] {
  const links = [...document.querySelectorAll<HTMLAnchorElement>("a[href]")].filter((link) => {
    const rect = link.getBoundingClientRect();

    return (
      link.origin === location.origin &&
      link.pathname + link.search !== location.pathname + location.search &&
      link.checkVisibility() &&
      rect.bottom > 0 &&
      rect.top < innerHeight &&
      rect.right > 0 &&
      rect.left < innerWidth
    );
  });

  return [...new Set(links.map((link) => link.pathname + link.search))];
}

/** Marks the first visible link to `path` (path and query, and no other) for Playwright to tap. */
export function markLinkTo(path: string): boolean {
  const links = [...document.querySelectorAll<HTMLAnchorElement>("a[href]")];

  for (const link of links) {
    delete link.dataset.zoonkVerifyTarget;
  }

  const target = links.find(
    (link) =>
      link.origin === location.origin &&
      link.pathname + link.search === path &&
      link.checkVisibility(),
  );

  if (target) {
    target.dataset.zoonkVerifyTarget = "";
  }

  return Boolean(target);
}
