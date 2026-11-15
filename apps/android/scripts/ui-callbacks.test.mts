import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { describe, it } from "vitest";

/**
 * Every view-model or store function that takes a function, and why it isn't a screen's callback
 * called later (the rule in `apps/android/AGENTS.md`: a function in a view model or store that
 * suspends, launches or listens takes no function from the UI to call later; it publishes an outcome
 * for the visit, and the screen's current frame acts on it). A call in the same frame, before
 * anything suspends, is a reason; a call after a suspension or from a listener is not: publish a
 * `VisitOutcome` instead. A new function fails until it's listed here with its reason, and a listed
 * one that's gone fails too.
 */
const REASONS: Record<string, string> = {
  "core/data DraftStore.follow(transition)":
    "SessionStore's own transition, run under the drafts' lock and awaited by it; no screen passes one.",
  "core/data DraftStore.launch(block)": "The store's own work on its scope, from other stores.",
  "core/data LearningProfileStore.update(optimistic)":
    "Private: the store's own change to its cached profile.",
  "core/data MemoryStore.edit(optimistic)": "Private: the store's own change to its cached memory.",
  "core/data MindMapStore.read(chapters)": "Private: the store's own read.",
  "core/data MindMapStore.watchReads(arrived)":
    "MindMapViewModel's own listener on its maps' state, held by the view model, never a frame.",
  "core/data MockRunStore.step(write)": "Private: the store's own write.",
  "core/data OnboardingStore.write(replacing)": "Private: the store's own cache replacement.",
  "core/data PlanStore.saveGoal(write)": "Private: the store's own write.",
  "core/data PlanStore.write(write)": "Private: the store's own write.",
  "core/data SessionStore.install(isStillWanted)": "Private: the store's own check.",
  "core/data SessionStore.signIn(obtain)":
    "AccountStore's own token call (guest, email code, Google), awaited by its caller.",
  "core/data StatsStore.read(fetch)": "Private: the store's own read.",
  "core/data StudyReminderStore.save(write)": "Private: the store's own write.",
  "core/data SubscriptionStore.buy(host)":
    "The Checkout view model's own window holder, asked for when Play's sheet opens; no frame passes it.",
  "feature/account PreferencesViewModel.save(write)": "Private: the view model's own write.",
  "feature/account RemindersViewModel.save(settle)":
    "Private: the view model's own state reset after its write.",
  "feature/account SignInViewModel.run(block)": "Private: the view model's own sign-in call.",
  "feature/exam MockRunnerViewModel.step(request)": "Private: the view model's own request.",
  "feature/onboarding FocusTestViewModel.save(action)": "Private: the view model's own save.",
  "feature/onboarding GoalSetupViewModel.reveal(opened)":
    "Private: the view model's own continuation, run only while the visit that asked lasts.",
  "feature/onboarding LevelTestViewModel.finish(then)":
    "Private: the view model's own continuation (the setup's save, given at construction).",
  "feature/onboarding StartGoalViewModel.attach(add)": "Private: the view model's own attach call.",
  "feature/onboarding StartGoalViewModel.settle(explanation)":
    "Called in the same frame, before anything suspends: it builds the goal's input.",
  "feature/onboarding StartGoalViewModel.update(transform)":
    "Private: the view model's own state change.",
  "feature/onboarding UploadRequestViewModel.send(attach)":
    "Private: the view model's own attach call.",
  "feature/onboarding UploadRequestViewModel.update(change)":
    "Private: the view model's own state change.",
  "feature/plan FarTopicViewModel.update(transform)": "Private: the view model's own state change.",
  "feature/plan MemoryViewModel.save(write)": "Private: the view model's own write.",
  "feature/plan PlanViewModel.save(write)": "Private: the view model's own write.",
  "feature/plan PlanViewModel.saveGoal(write)": "Private: the view model's own write.",
  "feature/plan PlanViewModel.update(transform)": "Private: the view model's own state change.",
  "feature/plan TutorViewModel.applyOffer(write)": "Private: the view model's own write.",
  "feature/plan TutorViewModel.update(change)": "Private: the view model's own state change.",
  "feature/player LessonWritingViewModel.launchWork(block)":
    "Private: the view model's own work on its scope.",
  "feature/practice CheckpointViewModel.update(change)":
    "Private: the view model's own state change.",
  "feature/practice MistakePracticeViewModel.updateRun(change)":
    "Private: the view model's own state change.",
  "feature/practice PatternViewModel.change(transform)":
    "Private: the view model's own state change.",
  "feature/today ReminderOfferViewModel.save(write)": "Private: the view model's own write.",
  "feature/today SessionViewModel.followLesson(readDay)":
    "A suspend function the screen's own coroutine awaits: readDay runs in it and ends with it.",
  "feature/today SessionViewModel.run(write)": "Private: the view model's own write.",
  "feature/today TodayViewModel.answerExamOver(write)": "Private: the view model's own write.",
  "feature/today TodayViewModel.run(write)": "Private: the view model's own write.",
};

const ROOT = path.join(import.meta.dirname, "..");

async function kotlinFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });

  const nested = await Promise.all(
    entries.map((entry) => {
      const full = path.join(directory, entry.name);

      if (entry.isDirectory()) {
        return entry.name === "build" || entry.name.startsWith(".")
          ? Promise.resolve([])
          : kotlinFiles(full);
      }

      return Promise.resolve(
        full.includes(`${path.sep}src${path.sep}main${path.sep}`) && entry.name.endsWith(".kt")
          ? [full]
          : [],
      );
    }),
  );

  return nested.flat();
}

/** The text from [from] to the bracket that closes the one open there. */
function closing(text: string, from: number, open: string, close: string): number {
  let depth = 1;

  for (let index = from; index < text.length; index += 1) {
    if (text[index] === open) {
      depth += 1;
    } else if (text[index] === close) {
      depth -= 1;
    }

    if (depth === 0) {
      return index;
    }
  }

  return text.length;
}

/** A parameter list split at its top-level commas. */
function parameters(list: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = "";

  for (const character of list) {
    if ("(<".includes(character)) {
      depth += 1;
    } else if (")>".includes(character)) {
      depth -= 1;
    }

    if (character === "," && depth === 0) {
      parts.push(current);
      current = "";
    } else {
      current += character;
    }
  }

  return [...parts, current];
}

/** Type aliases for function types (`typealias LeaveTest = suspend () -> …`). */
export function functionAliases(sources: string[]): Set<string> {
  return new Set(
    sources.flatMap((source) =>
      [...source.matchAll(/typealias (?<name>\w+)\s*=\s*(?<type>[^\n]+)/gu)]
        .filter((match) => match.groups?.type?.includes("->"))
        .map((match) => match.groups?.name ?? ""),
    ),
  );
}

/** Each function of a view model (a class extending `ViewModel`) or a store (a class named `…Store`) that takes a function. */
export function sitesIn(source: string, module: string, aliases: Set<string>): string[] {
  const classes = [...source.matchAll(/^(?:[a-z]+ )*class (?<name>\w+)\b/gmu)];

  return classes.flatMap((match, position) => {
    const start = match.index ?? 0;
    const end = classes[position + 1]?.index ?? source.length;
    const name = match.groups?.name ?? "";
    let headerEnd = start;
    let depth = 0;

    while (headerEnd < end) {
      const character = source[headerEnd];

      if (character === "(") {
        depth += 1;
      } else if (character === ")") {
        depth -= 1;
      } else if (character === "{" && depth === 0) {
        break;
      }

      headerEnd += 1;
    }

    const header = source.slice(start, headerEnd);

    if (!/:\s*[\w.]*ViewModel\(/u.test(header) && !name.endsWith("Store")) {
      return [];
    }

    const body = source.slice(headerEnd, end);

    return [
      ...body.matchAll(
        /\n {4}(?:(?:private|internal|public|suspend|override|inline|operator)\s+)*fun (?:<[^>]*>\s*)?(?<fun>\w+)\s*\(/gu,
      ),
    ].flatMap((found) => {
      const open = (found.index ?? 0) + found[0].length;
      const list = body.slice(open, closing(body, open, "(", ")"));

      const functions = parameters(list)
        .filter((parameter) => parameter.includes(":"))
        .filter((parameter) => {
          const type = parameter.slice(parameter.indexOf(":") + 1);
          const declared = type.split("=")[0]?.replaceAll(/[?\s]/gu, "") ?? "";
          return type.includes("->") || aliases.has(declared);
        })
        .map((parameter) => parameter.split(":")[0]?.trim().split(/\s+/u).at(-1) ?? "");

      return functions.length === 0
        ? []
        : [`${module} ${name}.${found.groups?.fun}(${functions.join(", ")})`];
    });
  });
}

async function sites(): Promise<string[]> {
  const folders = await Promise.all(
    ["core", "feature"].map((folder) => kotlinFiles(path.join(ROOT, folder))),
  );

  const sources = await Promise.all(
    folders.flat().map(async (file) => ({ file, source: await readFile(file, "utf8") })),
  );

  const aliases = functionAliases(sources.map(({ source }) => source));

  return [
    ...new Set(
      sources.flatMap(({ file, source }) => {
        const owner = path.relative(ROOT, file).split(`${path.sep}src${path.sep}`)[0] ?? "";
        return sitesIn(source, owner.split(path.sep).join("/"), aliases);
      }),
    ),
  ].toSorted();
}

describe("view-model and store functions that take a function", () => {
  it("say why none is a screen's callback called later", async () => {
    const found = await sites();

    assert.deepEqual(
      found.filter((site) => !(site in REASONS)),
      [],
      "A view model or store takes a function: list it in REASONS with why it isn't a screen's callback called after a suspension, or publish a VisitOutcome the screen acts on instead",
    );

    assert.deepEqual(
      Object.keys(REASONS).filter((site) => !found.includes(site)),
      [],
      "A listed function is gone: remove it from REASONS",
    );
  });
});

describe(sitesIn, () => {
  it("finds a view model's lambda, and one behind a function-type alias", () => {
    const source = [
      "internal class SetupViewModel(",
      "    private val store: Store,",
      ") : ViewModel() {",
      "    fun save(",
      "        input: Input,",
      "        onSaved: () -> Unit,",
      "    ) = Unit",
      "",
      "    fun leave(onDone: LeaveTest) = Unit",
      "",
      "    fun plain(input: Input) = Unit",
      "}",
    ].join("\n");

    assert.deepEqual(sitesIn(source, "feature/x", new Set(["LeaveTest"])), [
      "feature/x SetupViewModel.save(onSaved)",
      "feature/x SetupViewModel.leave(onDone)",
    ]);
  });

  it("reads a store by its name and leaves other classes out", () => {
    const source = [
      "class PlanStore(private val api: Api) {",
      "    private suspend fun <T> write(write: suspend (Session) -> T): T = TODO()",
      "}",
      "",
      "class Formatter {",
      "    fun format(map: (String) -> String) = Unit",
      "}",
    ].join("\n");

    assert.deepEqual(sitesIn(source, "core/data", new Set()), ["core/data PlanStore.write(write)"]);
  });
});
