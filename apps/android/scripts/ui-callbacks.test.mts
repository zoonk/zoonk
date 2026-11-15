import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { describe, it } from "vitest";

/**
 * View-model and store functions that take a function, and why none is a screen's callback called
 * later (the rule in `apps/android/AGENTS.md`: a function in a view model or store that suspends,
 * launches or listens takes no function from the UI to call later; it publishes an outcome for the
 * visit, and the screen's current frame acts on it). A call in the same frame, before anything
 * suspends, is a reason; a call after a suspension or from a listener is not: publish a
 * `VisitOutcome` instead. A new function fails until it's listed here with its reason, and a listed
 * one that's gone fails too.
 *
 * It guards against a mistake, not a determined workaround. It reads a member function's parameters
 * typed as a function (`() -> Unit`, `suspend (T) -> R`), as a function-type alias (an alias of an
 * alias too) or as a `fun interface`, in a class extending `ViewModel` or named `…Store`, member
 * extensions included. It doesn't read a function-valued property a frame sets, a lambda inside a
 * data class or another parameter type, a constructor's parameters, or a class that is neither.
 */
const REASONS: Record<string, string> = {
  "core/data DraftStore.follow(transition)":
    "SessionStore's own transition, run under the drafts' lock and awaited by it; no screen passes one.",
  "core/data DraftStore.launch(block)": "The store's own work on its scope, from other stores.",
  "core/data LearningProfileStore.update(optimistic)":
    "Private: the store's own change to its cached profile.",
  "core/data MemoryStore.edit(optimistic, write)":
    "Private: the store's own change to its cached memory and its write.",
  "core/data MindMapStore.read(chapters, fetch)": "Private: the store's own read and its fetch.",
  "core/data MindMapStore.watchReads(arrived)":
    "MindMapViewModel's own listener on its maps' state, held by the view model, never a frame.",
  "core/data MockRunStore.step(write)": "Private: the store's own write.",
  "core/data OnboardingStore.write(replacing, write)":
    "Private: the store's own write and cache replacement.",
  "core/data PlanStore.saveGoal(write, saved)":
    "Private: the store's own write and what it records once saved.",
  "core/data PlanStore.write(write)": "Private: the store's own write.",
  "core/data SessionStore.install(isStillWanted)": "Private: the store's own check.",
  "core/data SessionStore.signIn(obtain)":
    "AccountStore's own token call (guest, email code, Google), awaited by its caller.",
  "core/data StatsStore.read(fetch)": "Private: the store's own read.",
  "core/data StudyReminderStore.save(write)": "Private: the store's own write.",
  "core/data SubscriptionStore.buy(host)":
    "The Checkout view model's own window holder, asked for when Play's sheet opens; no frame passes it.",
  "feature/account PreferencesViewModel.save(write)": "Private: the view model's own write.",
  "feature/account RemindersViewModel.save(settle, write)":
    "Private: the view model's own write and its state reset after it.",
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
  "feature/plan TutorViewModel.applyOffer(write, saved)":
    "Private: the view model's own write and the state it records once saved.",
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

  for (let index = 0; index < list.length; index += 1) {
    const character = list[index] ?? "";
    // The `>` of a function type's `->` closes nothing.
    const arrow = character === ">" && list[index - 1] === "-";

    if ("(<".includes(character)) {
      depth += 1;
    } else if (")>".includes(character) && !arrow) {
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

/**
 * The names that stand for a function type: a `typealias` of one (`typealias LeaveTest = suspend () -> …`), an alias
 * of such an alias, and a `fun interface`.
 */
export function functionAliases(sources: string[]): Set<string> {
  const aliases = sources.flatMap((source) =>
    [...source.matchAll(/typealias (?<name>\w+)(?:<[^=]*>)?\s*=\s*(?<type>[^\n]+)/gu)].map(
      (match) => ({ name: match.groups?.name ?? "", type: (match.groups?.type ?? "").trim() }),
    ),
  );

  const names = new Set(
    sources.flatMap((source) =>
      [...source.matchAll(/fun interface (?<name>\w+)/gu)].map((match) => match.groups?.name ?? ""),
    ),
  );

  let grew = true;

  while (grew) {
    const before = names.size;

    for (const { name, type } of aliases) {
      if (type.includes("->") || names.has(type.replaceAll(/[?\s]|<.*>/gu, ""))) {
        names.add(name);
      }
    }

    grew = names.size > before;
  }

  return names;
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
        /\n {4}(?:(?:private|internal|public|suspend|override|inline|operator)\s+)*fun (?:<[^>]*>\s*)?(?:[\w.?]+(?:<[^>]*>)?\??\.)?(?<fun>\w+)\s*\(/gu,
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
  const kinds = [
    "typealias Callback = () -> Unit",
    "typealias Chained = Callback",
    "fun interface Done { fun run() }",
    "data class Input(val done: () -> Unit)",
  ].join("\n");

  function found(member: string): string[] {
    const source = `${kinds}\nclass ProbeViewModel : ViewModel() {\n${member}\n}`;
    return sitesIn(source, "feature/probe", functionAliases([source]));
  }

  it.each([
    ["a lambda", "    suspend fun save(done: () -> Unit) { done() }", "save(done)"],
    [
      "a lambda with a default",
      "    suspend fun save(done: () -> Unit = {}) { done() }",
      "save(done)",
    ],
    ["an alias", "    suspend fun save(done: Callback) { done() }", "save(done)"],
    ["an alias of an alias", "    suspend fun save(done: Chained) { done() }", "save(done)"],
    ["a fun interface", "    suspend fun save(done: Done) { done.run() }", "save(done)"],
    [
      "a member extension",
      "    suspend fun String.save(done: () -> Unit) { done() }",
      "save(done)",
    ],
    [
      "two lambdas",
      "    suspend fun save(first: () -> Unit, second: () -> Unit) { second() }",
      "save(first, second)",
    ],
  ])("reads %s", (_, member, key) => {
    assert.deepEqual(found(member), [`feature/probe ProbeViewModel.${key}`]);
  });

  it.each([
    [
      "a function-valued property",
      "    var done: () -> Unit = {}\n    suspend fun save() { done() }",
    ],
    ["a lambda inside a data class", "    suspend fun save(input: Input) { input.done() }"],
  ])("doesn't read %s, as the header says", (_, member) => {
    assert.deepEqual(found(member), []);
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
