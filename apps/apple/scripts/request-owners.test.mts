import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { describe, it } from "vitest";

/**
 * Every view that cancels or leaves work as it disappears, and why that disappearance is the right
 * end for it (the rule in `apps/apple/AGENTS.md`, "Requests outlive a layout change"). A view a
 * `PaneSplit`, a `PaneBeside` pane or a size-class switch draws again disappears on a resize while
 * its screen stays, so it must not end a request; the screen that holds the split owns it. A new
 * site fails until it's listed here with its reason, and a listed site that's gone fails too.
 */
const OWNERS: Record<string, string> = {
  "DesignSystem/Characters/CharacterActor.swift: cueTask":
    "An animation cue the character plays, not a request.",
  "Features/Activities/Music/RhythmTapperActivity.swift: calibration":
    "Audio calibration on the device, not a request.",
  "Features/Buddy/BuddyScreen.swift: missionTap":
    "Zu's page, which holds its PaneBeside: above the day's pane.",
  "Features/Certificates/CertificateScreen.swift: printing": "A certificate's page has no split.",
  "Features/Courses/CatalogStartActions.swift: goalSwitch":
    "The course, chapter and lesson pages' goal switch, attached to the view that holds their PaneSplit.",
  "Features/Exam/ExamScreen.swift: callStart": "The exam page, which holds its PaneSplit.",
  "Features/FocusTest/FocusTestFlow.swift: tasks": "The focus test has no split.",
  "Features/GoalContent/ChapterScreen.swift: practiceTask":
    "The chapter page, which holds its PaneSplit.",
  "Features/GoalContent/LanguageUnitScreen.swift: callStart":
    "The unit page, which holds its PaneSplit.",
  "Features/Mock/MockChooserScreen.swift: starting": "The mock chooser, which holds its PaneSplit.",
  "Features/Onboarding/CourseStartScreen.swift: startTask": "A course's start has no split.",
  "Features/Onboarding/GoalSetupScreen.swift: startingOver": "Goal setup's steps have no split.",
  "Features/Onboarding/GoalStartScreen.swift: creation":
    "The draft's visit (DraftCreation): leaving it is the end its create waits for.",
  "Features/Onboarding/GoalStartScreen.swift: sending": "The start flow has no split.",
  "Features/Onboarding/LevelTestStep.swift: finishing": "The level test has no split.",
  "Features/Onboarding/PlacementStep.swift: tasks":
    "Placement is the onboarding aside's PaneBeside content, which keeps its identity.",
  "Features/Onboarding/PlanStep.swift: opening": "The plan reveal, which holds its PaneSplit.",
  "Features/Plan/AdjustPlanSections.swift: saving":
    "A sheet of the Adjust plan sheet, presented above the Plan's split.",
  "Features/Plan/AdjustPlanSheet.swift: editor":
    "The Adjust plan sheet, presented above the Plan's split.",
  "Features/Plan/GoalOptionsToolbar.swift: saving": "The Plan's bar, outside its split.",
  "Features/Plan/GoalOptionsToolbar.swift: statusChange":
    "The Plan's options, applied above its split.",
  "Features/Plan/PlanBasesView.swift: saving":
    "In the Adjust plan sheet, presented above the Plan's split.",
  "Features/Plan/PlanScreen.swift: certificateClaim, slotAnswer?.editor, slotChecks":
    "The Plan, which holds its PaneSplit.",
  "Features/PlanLink/PlanLinkScreen.swift: startTask": "A shared plan's page has no split.",
  "Features/Player/Views/LessonEndViews.swift: starting":
    "The guest gate, shown in the lesson's place, not in a split.",
  "Features/Player/Views/LessonEndViews.swift: stopping":
    "The lesson's end, which holds its PaneSplit.",
  "Features/Player/Views/LessonPlayerScreen.swift: store":
    "The lesson's screen, above its stage's split.",
  "Features/Player/Views/LessonSpokenWordsView.swift: playing":
    "Playback of the spoken words, not a request.",
  "Features/Practice/Challenge/ChallengeScreen.swift: action":
    "The challenge's action, owned above its layout.",
  "Features/Practice/QuestionBlock/QuestionBlockScreen.swift: stopping":
    "The question block, above the question's split.",
  "Features/Search/SearchScreen.swift: goalSwitch": "Search, which holds its PaneSplit.",
  "Features/Session/SessionScreen.swift: action":
    "The next stop, above the split NextStopWait draws.",
  "Features/Session/SessionScreen.swift: playback": "The session's screen, which has no split.",
  "Features/Session/SessionSummaryView.swift: action":
    "The session's summary, which holds its PaneSplit.",
  "Features/Today/TodayDayView.swift: examChoice, suggestedGoalAnswer, tapTask":
    "Today's day, which holds its PaneSplit.",
  "Features/Today/TodayScreen.swift: answer": "Today with no goal has no split.",
  "Features/Today/TodayScreen.swift: resumeTask": "A paused goal's Today has no split.",
  "Features/Tutor/TutorThreadView.swift: pendingAsk":
    "An offer is its panel's: dropped when the panel leaves; a panel drawn in its place takes it over once the thread is read (TutorConversation.ask).",
  "Features/Tutor/TutorToolOfferCard.swift: start":
    "The practice call's own sheet, which the router presents above any pane: closing it is leaving.",
  "Features/Voice/Audio/VoiceAnswerRecorder.swift: grading, recorder":
    "The level test's recorder, which has no split.",
  "Features/Voice/Conversation/CheckpointCallIntro.swift: starting":
    "Above the split ConversationIntro draws.",
  "Features/Voice/Conversation/ConversationResultView.swift: again":
    "A call's result has no split.",
  "Features/Voice/Conversation/ConversationScreen.swift: call, restarting":
    "The live call, above the split ConversationLiveView draws.",
  "Features/Voice/Pronunciation/PronunciationScreen.swift: recorder":
    "A pronunciation round's recording; the round view has no split.",
  "Features/Voice/Speaking/SpeakingScreen.swift: start":
    "The speaking paper, which holds its PaneSplit.",
  "Navigation/MakeRoomSheet.swift: start": "A sheet the router presents.",
};

/**
 * Every `Task {}` nobody keeps (not assigned, so nothing can cancel it) that routes after an
 * `await`, and why routing then is right: the screen that started it may be gone by the time it
 * lands, and what it opens covers wherever the learner went. Keep the task in an owner that ends it
 * as the screen closes instead (`apps/apple/AGENTS.md`, "Requests outlive a layout change").
 */
const LOOSE_ROUTES: Record<string, string> = {
  "App/ZoonkApp.swift: router.openStudyReminder":
    "A study reminder the learner tapped, opened from the app's root, which never leaves.",
  "Navigation/FeatureHooks.swift: router.open":
    "A mission with a block never reaches the hooks: Zu's page opens it through BuddyMissionTap.",
  "Navigation/ShellToolbar.swift: router.popToRoots":
    "The top bar's goal menu: the shell never leaves, and a switch changes every tab's goal.",
};

const SOURCES = path.join(import.meta.dirname, "../Zoonk");

async function swiftFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });

  const nested = await Promise.all(
    entries.map((entry) => {
      const full = path.join(directory, entry.name);

      if (entry.isDirectory()) {
        return swiftFiles(full);
      }

      return Promise.resolve(entry.name.endsWith(".swift") ? [full] : []);
    }),
  );

  return nested.flat();
}

/**
 * What `onDisappear` is given, from the modifier to the bracket that closes it: its closure, or its
 * `perform:` argument.
 */
function closureAt(lines: string[], start: number): string {
  let text = "";
  let depth = 0;
  let opened = false;

  for (let index = start; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    const from = index === start ? line.indexOf(".onDisappear") : 0;

    for (const character of line.slice(from)) {
      text += character;

      if (character === "{" || character === "(") {
        depth += 1;
        opened = true;
      } else if (character === "}" || character === ")") {
        depth -= 1;
      }

      if (opened && depth === 0) {
        return text;
      }
    }

    text += " ";
  }

  return text;
}

/** What each `onDisappear` in one file ends: the receivers of its `cancel…()` and `leave(…)` calls. */
function sitesIn(source: string, relative: string): string[] {
  const lines = source.split("\n");

  return counted(
    lines.flatMap((line, index) => {
      if (!line.includes(".onDisappear")) {
        return [];
      }

      const receivers = [
        ...closureAt(lines, index).matchAll(
          /(?<receiver>[\w?.]+?)\??\.(?:cancel\w*|leave)(?=\s*[()])/gu,
        ),
      ].map((match) => match.groups?.receiver ?? "");

      return receivers.length === 0
        ? []
        : [`${relative}: ${[...new Set(receivers)].toSorted().join(", ")}`];
    }),
  );
}

/** Each site once: a second site that ends the same things in one file is `… #2`, its own entry. */
function counted(keys: string[]): string[] {
  const seen = new Map<string, number>();

  return keys.map((key) => {
    const count = (seen.get(key) ?? 0) + 1;
    seen.set(key, count);
    return count === 1 ? key : `${key} #${count}`;
  });
}

/** The text of the braces that open at `start`, without them. */
function bracesAt(source: string, start: number): string {
  let depth = 0;

  for (let index = start; index < source.length; index += 1) {
    if (source[index] === "{") {
      depth += 1;
    } else if (source[index] === "}") {
      depth -= 1;

      if (depth === 0) {
        return source.slice(start + 1, index);
      }
    }
  }

  return source.slice(start + 1);
}

/** The router calls each unkept `Task {}` in one file makes after its first `await`. */
function looseRoutesIn(source: string, relative: string): string[] {
  return counted(
    [...source.matchAll(/^(?<before>[^\n]*?)\bTask\s*\{/gmu)].flatMap((match) => {
      if (/[=]|\breturn\b/u.test(match.groups?.before ?? "")) {
        return [];
      }

      const body = bracesAt(source, (match.index ?? 0) + match[0].length - 1);
      const awaited = body.indexOf("await");

      if (awaited === -1) {
        return [];
      }

      const routes = [...body.slice(awaited).matchAll(/\brouter\.(?<call>\w+)\(/gu)].map(
        (route) => `router.${route.groups?.call ?? ""}`,
      );

      return routes.length === 0
        ? []
        : [`${relative}: ${[...new Set(routes)].toSorted().join(", ")}`];
    }),
  );
}

async function sources(): Promise<{ relative: string; source: string }[]> {
  const files = await swiftFiles(SOURCES);

  return Promise.all(
    files.map(async (file) => ({
      relative: path.relative(SOURCES, file),
      source: await readFile(file, "utf8"),
    })),
  );
}

async function sites(): Promise<string[]> {
  const files = await sources();
  return files.flatMap(({ source, relative }) => sitesIn(source, relative)).toSorted();
}

async function looseRoutes(): Promise<string[]> {
  const files = await sources();
  return files.flatMap(({ source, relative }) => looseRoutesIn(source, relative)).toSorted();
}

describe("what a view ends as it disappears", () => {
  it("says why that disappearance is its owner's", async () => {
    const found = await sites();

    assert.deepEqual(
      found.filter((site) => !(site in OWNERS)),
      [],
      "A view ends work in onDisappear: list it in OWNERS with why its disappearance is the end of that work, or move the work to the screen that holds the split",
    );

    assert.deepEqual(
      Object.keys(OWNERS).filter((site) => !found.includes(site)),
      [],
      "A listed site is gone: remove it from OWNERS",
    );
  });
});

describe("what a task nobody keeps opens after it waits", () => {
  it("says why routing then is right", async () => {
    const found = await looseRoutes();

    assert.deepEqual(
      found.filter((site) => !(site in LOOSE_ROUTES)),
      [],
      "A Task nobody keeps routes after an await: keep it in an owner that ends it as its screen closes, or list it in LOOSE_ROUTES with why routing then is right",
    );

    assert.deepEqual(
      Object.keys(LOOSE_ROUTES).filter((site) => !found.includes(site)),
      [],
      "A listed site is gone: remove it from LOOSE_ROUTES",
    );
  });
});

describe(looseRoutesIn, () => {
  it("reads a router call after the task's await", () => {
    const source = `
      func pick() {
        Task {
          if await save() { router.showRoot(of: .today) }
        }
      }
    `;

    assert.deepEqual(looseRoutesIn(source, "Card.swift"), ["Card.swift: router.showRoot"]);
  });

  it("leaves a kept task, and a call before the await, to the owners list", () => {
    const source = `
      func pick() {
        task = Task {
          if await save() { router.showRoot(of: .today) }
        }
        Task {
          router.open(.today)
          await save()
        }
      }
    `;

    assert.deepEqual(looseRoutesIn(source, "Card.swift"), []);
  });
});

describe(sitesIn, () => {
  it("counts a second site in a file that already has one", () => {
    const source = `
      struct Sheet: View {
        var body: some View { Text("a").onDisappear { start.cancel() } }
      }
      struct Card: View {
        var body: some View { Text("b").onDisappear { start.cancel() } }
      }
    `;

    assert.deepEqual(sitesIn(source, "Card.swift"), ["Card.swift: start", "Card.swift: start #2"]);
  });

  it("reads a cancellation passed as onDisappear's perform", () => {
    const source = `
      struct Card: View {
        var body: some View { Text("b").onDisappear(perform: start.cancel) }
      }
    `;

    assert.deepEqual(sitesIn(source, "Card.swift"), ["Card.swift: start"]);
  });
});
