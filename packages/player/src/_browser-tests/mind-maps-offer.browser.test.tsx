import {
  type GoalMindMapView,
  type GoalMindMapsView,
  type MindMapAllowanceStop,
} from "@zoonk/core/mind-maps/contract";
import { LearnProvider } from "@zoonk/learn/provider";
import { describe, expect, it, vi } from "vitest";
import { page } from "vitest/browser";
import { toMindMapsPage } from "../../../learn/src/mind-maps/_utils/mind-maps-page";
import { type MindMapLibraryActions } from "../../../learn/src/mind-maps/mind-map-actions";
import { MindMapsScreen } from "../../../learn/src/mind-maps/mind-maps-screen";
import { render } from "../_test-utils/render";

const ADAPTERS: React.ComponentProps<typeof LearnProvider>["adapters"] = {
  analytics: { track: vi.fn() },
  linkComponent: ({ children, className, href }) => (
    <a className={className} href={href}>
      {children}
    </a>
  ),
  loadCountries: async () => [],
  routes: { buddy: "/buddy", journey: "/plan", signUp: "/login", today: "/", upgrade: "/plus" },
};

const TITLES = ["Atoms", "Bonds", "Reactions"] as const;

function chapter(title: string, position: number): GoalMindMapView {
  return {
    chapterId: crypto.randomUUID(),
    image: null,
    lessonsToWrite: 0,
    outline: null,
    position,
    saved: false,
    status: "available",
    subject: null,
    title,
  };
}

const CHAPTERS = TITLES.map((title, index) => chapter(title, index + 1));

function rollingStop(availableAt: string): MindMapAllowanceStop {
  return { availableAt, period: "rolling30Days", reason: "limitReached", resource: "mindMap" };
}

function view(stop: MindMapAllowanceStop | null): GoalMindMapsView {
  return {
    chapters: CHAPTERS,
    createOffer: { eligible: 3, needLessons: 0, startable: stop ? 0 : 3, stop },
    firstTab: "chapters",
    goal: { displayName: "Chemistry", id: crypto.randomUUID(), title: "Chemistry" },
    lessonGroups: [],
    saved: [],
  };
}

/** The page with its last chapter writing its lessons, the first step of making its map. */
function writingView(stop: MindMapAllowanceStop | null): GoalMindMapsView {
  const served = view(stop);

  return {
    ...served,
    chapters: served.chapters.map((row, index) =>
      index === 2 ? { ...row, lessonsToWrite: 1, status: "writingLessons" } : row,
    ),
  };
}

function actionsWith(overrides: Partial<MindMapLibraryActions>): MindMapLibraryActions {
  return {
    list: vi.fn(async () => view(null)),
    request: vi.fn(async () => ({ status: "drawing" as const })),
    requestAll: vi.fn(async () => ({ accepted: [], joined: [], stop: null, unstarted: [] })),
    save: vi.fn(async () => true),
    ...overrides,
  };
}

function Screen({ actions, served }: { actions: MindMapLibraryActions; served: GoalMindMapsView }) {
  return (
    <LearnProvider adapters={ADAPTERS}>
      <MindMapsScreen
        actions={actions}
        hrefs={{ back: "/plan", page: "/mind-maps", study: "/mind-maps/study" }}
        mindMaps={toMindMapsPage(served)}
        subject={null}
        tab="chapters"
        tier="free"
      />
    </LearnProvider>
  );
}

const notMade = () => page.getByRole("region", { name: "Other chapters" });
const usedUp = () => notMade().getByText("You've used your mind maps");
const createAll = () => notMade().getByRole("button", { name: "Create all" });

const onTheWay = () => notMade().getByText("1 on the way.", { exact: false });

const writingRow = () =>
  notMade()
    .getByRole("listitem")
    .filter({ hasText: "Reactions" })
    .getByText("Writing the lessons, then the mind map…");

const rowCreate = (title: string) =>
  notMade()
    .getByRole("listitem")
    .filter({ hasText: title })
    .getByRole("button", { name: "Create" });

describe("the Mind maps page's gate is the list's offer", () => {
  it.each([
    ["the newer read answers first", ["newer", "older"]],
    ["the older read answers first", ["older", "newer"]],
  ] as const)(
    "a newer read that allows maps wins over Create all's refusal: %s",
    async (_name, order) => {
      const reads = {
        newer: Promise.withResolvers<GoalMindMapsView>(),
        older: Promise.withResolvers<GoalMindMapsView>(),
      };

      const queue = [reads.older, reads.newer];
      const list = vi.fn(() => queue.shift()?.promise ?? Promise.resolve(view(null)));

      const actions = actionsWith({
        list,
        requestAll: async () => ({
          accepted: [],
          joined: [],
          stop: rollingStop(new Date(Date.now() - 60_000).toISOString()),
          unstarted: [],
        }),
      });

      const screen = render(<Screen actions={actions} served={view(null)} />);
      await createAll().click();
      await expect.element(usedUp()).toBeVisible();
      await expect.poll(() => list.mock.calls.length).toBe(1);

      // A newer copy of the page starts a newer read of the list.
      screen.rerender(<Screen actions={actions} served={view(null)} />);
      await expect.poll(() => list.mock.calls.length).toBe(2);

      for (const which of order) {
        reads[which].resolve(
          which === "older"
            ? view(rollingStop(new Date(Date.now() - 60_000).toISOString()))
            : view(null),
        );
      }

      await expect.element(usedUp()).not.toBeInTheDocument();
      await expect.element(createAll()).toBeVisible();
      await expect.element(rowCreate("Bonds")).toBeVisible();
    },
  );

  it("holds the gate for a stop in the offer whose day this device already shows as past, with no day and no read of its own, until a read allows", async () => {
    const read = Promise.withResolvers<GoalMindMapsView>();
    const list = vi.fn(() => read.promise);
    const actions = actionsWith({ list });
    const past = view(rollingStop(new Date(Date.now() - 60_000).toISOString()));

    const screen = render(<Screen actions={actions} served={past} />);

    await expect.element(usedUp()).toBeVisible();
    await expect.element(notMade().getByRole("link", { name: "Subscribe" })).toBeVisible();
    await expect.element(notMade().getByText(/More (?:on|later)/u)).not.toBeInTheDocument();
    await expect.element(notMade().getByText("You can try again now.")).not.toBeInTheDocument();
    expect(rowCreate("Atoms").query()).toBeNull();

    await new Promise((resolve) => {
      setTimeout(resolve, 300);
    });

    expect(list).not.toHaveBeenCalled();

    // A newer copy of the page reads the list, and that read lifts the gate.
    screen.rerender(<Screen actions={actions} served={{ ...past }} />);
    read.resolve(view(null));

    await expect.element(usedUp()).not.toBeInTheDocument();
    await expect.element(rowCreate("Atoms")).toBeVisible();
    expect(list).toHaveBeenCalledOnce();
  });

  it("reads the list once when the offer's day comes, and Create comes back", async () => {
    const actions = actionsWith({});

    render(
      <Screen
        actions={actions}
        served={view(rollingStop(new Date(Date.now() + 2500).toISOString()))}
      />,
    );

    await expect.element(usedUp()).toBeVisible();
    await expect.element(notMade().getByText(/subscribe to keep going\.$/u)).toBeVisible();

    await expect.element(rowCreate("Atoms"), { timeout: 8000 }).toBeVisible();
    expect(actions.list).toHaveBeenCalledOnce();
    expect(actions.request).not.toHaveBeenCalled();
    expect(actions.requestAll).not.toHaveBeenCalled();
  });

  it("shows a refusal for every chapter over a chapter on its way, whose row still says it's being made", async () => {
    const read = Promise.withResolvers<GoalMindMapsView>();

    const actions = actionsWith({
      list: () => read.promise,
      request: async () => ({
        limit: {
          availableAt: null,
          period: "rolling30Days",
          resource: "mindMap",
          status: "limitReached",
          tier: "free",
        },
        status: "refused",
      }),
    });

    render(<Screen actions={actions} served={writingView(null)} />);
    await expect.element(onTheWay()).toBeVisible();

    await rowCreate("Atoms").click();

    await expect.element(usedUp()).toBeVisible();
    await expect.element(onTheWay()).not.toBeInTheDocument();
    await expect.element(writingRow()).toBeVisible();

    read.resolve(writingView(rollingStop(new Date(Date.now() + 86_400_000).toISOString())));

    await expect.element(notMade().getByRole("link", { name: "Subscribe" })).toBeVisible();
    await expect.element(usedUp()).toBeVisible();
    await expect.element(onTheWay()).not.toBeInTheDocument();
    await expect.element(writingRow()).toBeVisible();
  });

  it.each([
    {
      hidden: onTheWay,
      line: usedUp,
      name: "with a stop, the line is the stop's notice",
      stop: rollingStop(new Date(Date.now() + 86_400_000).toISOString()),
    },
    {
      hidden: usedUp,
      line: onTheWay,
      name: "without one, the line is the maps on their way",
      stop: null,
    },
  ])(
    "opens the group a map on its way sits in, on arrival: $name",
    async ({ hidden, line, stop }) => {
      render(<Screen actions={actionsWith({})} served={writingView(stop)} />);

      await expect
        .element(notMade().getByRole("button", { name: "Other chapters" }))
        .toHaveAttribute("aria-expanded", "true");

      await expect.element(writingRow()).toBeVisible();
      await expect.element(line()).toBeVisible();
      await expect.element(hidden()).not.toBeInTheDocument();
    },
  );

  it("leaves the page alone for a refusal only its row gets", async () => {
    const actions = actionsWith({
      request: async () => ({
        limit: {
          availableAt: null,
          period: "rolling30Days",
          resource: "chapterLessons",
          status: "limitReached",
          tier: "free",
        },
        status: "refused",
      }),
    });

    render(<Screen actions={actions} served={view(null)} />);
    await rowCreate("Atoms").click();

    await expect
      .element(
        notMade()
          .getByRole("listitem")
          .filter({ hasText: "Atoms" })
          .getByRole("link", { name: "Subscribe" }),
      )
      .toBeVisible();

    await expect.element(rowCreate("Bonds")).toBeVisible();
    await expect.element(createAll()).toBeVisible();
    expect(actions.list).not.toHaveBeenCalled();
  });
});
