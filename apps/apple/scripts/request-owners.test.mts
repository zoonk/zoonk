import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { describe, it } from "vitest";
import { REQUEST_STATES } from "./request-owner-exemptions.mts";
import { looseRoutesIn, screenFailuresIn, sitesIn } from "./request-owners.mts";

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
  "Features/Account/ProfileEditorView.swift: saving":
    "The profile, a page of the account sheet's stack, which keeps its identity beside the list or alone.",
  "Features/Activities/Music/RhythmTapperActivity.swift: calibration":
    "Audio calibration on the device, not a request.",
  "Features/Buddy/BuddyEditor.swift: saving": "The glasses' own sheet: closing it is leaving.",
  "Features/Buddy/BuddyScreen.swift: missionTap, saving":
    "Zu's page, which holds its PaneBeside: above the day's pane.",
  "Features/Certificates/CertificateCeremony.swift: nameSave":
    "The certificate moment, which holds its PaneSplit.",
  "Features/Certificates/CertificateScreen.swift: nameSave, printing":
    "A certificate's page has no split.",
  "Features/Courses/CatalogStartActions.swift: goalSwitch":
    "The course, chapter and lesson pages' goal switch, attached to the view that holds their PaneSplit.",
  "Features/Essay/EssayScreen.swift: finishing":
    "A written task's screen has no split; closing it is leaving the task.",
  "Features/Essay/WritingStartView.swift: asking":
    "The written question's wait has no split; closing it ends following the run, which goes on.",
  "Features/Exam/ExamScreen.swift: callStart, dateChange, resultSave":
    "The exam page, which holds its PaneSplit.",
  "Features/Exam/WrittenProjection.swift: writing":
    "Write's own button, in a bottom bar or a sheet's footer, outside any split.",
  "Features/FocusTest/FocusTestFlow.swift: tasks": "The focus test has no split.",
  "Features/GoalContent/ChapterScreen.swift: practicing":
    "The chapter page, which holds its PaneSplit.",
  "Features/GoalContent/LanguageUnitScreen.swift: callSetup.start":
    "The unit page, which holds its PaneSplit.",
  "Features/GoalContent/SubjectScreen.swift: restoring":
    "The subject page, which holds its PaneSplit; the notice drawn in a pane only borrows it.",
  "Features/Mock/MockChooserScreen.swift: starting": "The mock chooser, which holds its PaneSplit.",
  "Features/Onboarding/CourseStartScreen.swift: startTask": "A course's start has no split.",
  "Features/Onboarding/GoalSetupScreen.swift: startingOver": "Goal setup's steps have no split.",
  "Features/Onboarding/GoalStartScreen.swift: creation":
    "The draft's visit (DraftCreation): leaving it is the end its create waits for.",
  "Features/Onboarding/GoalStartScreen.swift: materialDraft, sending":
    "The start flow has no split.",
  "Features/Onboarding/LevelTestStep.swift: finishing": "The level test has no split.",
  "Features/Onboarding/PlacementStep.swift: tasks":
    "Placement is the onboarding aside's PaneBeside content, which keeps its identity.",
  "Features/Onboarding/PlanStep.swift: starting":
    "The plan reveal, which holds its onboarding pane column; Start's request is its own.",
  "Features/PlacementTest/LevelTestFlow.swift: tasks, undoRequest": "The level test has no split.",
  "Features/PlacementTest/PlacementTestFlow.swift: tasks, undoRequest":
    "The test taken from the plan has no split.",
  "Features/Plan/AdjustPlanSections.swift: saving":
    "A sheet of the Adjust plan sheet, presented above the Plan's split.",
  "Features/Plan/AdjustPlanSheet.swift: editor":
    "The Adjust plan sheet, presented above the Plan's split.",
  "Features/Plan/GoalOptionsToolbar.swift: changes": "The Plan's options, applied above its split.",
  "Features/Plan/GoalOptionsToolbar.swift: saving": "The Plan's bar, outside its split.",
  "Features/Plan/PlanBasesView.swift: saving":
    "In the Adjust plan sheet, presented above the Plan's split.",
  "Features/Plan/PlanScreen.swift: alphabetSkip, rebuildRetry, slotAnswer?.editor, slotChecks, testedOutUndo":
    "The Plan, which holds its PaneSplit.",
  "Features/PlanLink/PlanLinkScreen.swift: startTask": "A shared plan's page has no split.",
  "Features/Player/Views/LessonEndViews.swift: offerDismissal, stopping":
    "The lesson's end, which holds its PaneSplit.",
  "Features/Player/Views/LessonEndViews.swift: starting":
    "The guest gate, shown in the lesson's place, not in a split.",
  "Features/Player/Views/LessonPlayerScreen.swift: store":
    "The lesson's screen, above its stage's split.",
  "Features/Player/Views/LessonSpokenWordsView.swift: playing":
    "Playback of the spoken words, not a request.",
  "Features/Practice/Challenge/ChallengeScreen.swift: action":
    "The challenge's action, owned above its layout.",
  "Features/Practice/QuestionBlock/QuestionBlockScreen.swift: stopping":
    "The question block, above the question's split.",
  "Features/Reminders/RemindersView.swift: emailSave, pushSetup, timeSave":
    "Reminders, a page of the account sheet's stack, which keeps its identity beside the list or alone.",
  "Features/Search/SearchScreen.swift: goalSwitch": "Search, which holds its PaneSplit.",
  "Features/Session/SessionScreen.swift: action":
    "The next stop, above the split NextStopWait draws.",
  "Features/Session/SessionScreen.swift: playback": "The session's screen, which has no split.",
  "Features/Session/SessionSummaryView.swift: action, visit":
    "The session's summary owns the visit and its study actions, above its PaneSplit.",
  "Features/Settings/MemoryView.swift: changes":
    "Memory, a page of the account sheet's stack, which keeps its identity beside the list or alone.",
  "Features/Settings/PreferencesView.swift: buddySave, homeSave, soundsSave":
    "Preferences, a page of the account sheet's stack, which keeps its identity beside the list or alone.",
  "Features/Settings/PrivacyView.swift: saving":
    "Privacy, a page of the account sheet's stack, which keeps its identity beside the list or alone.",
  "Features/Today/TodayDayView.swift: examChoice, focusTestDismissal, insightAnswer, suggestedGoalAnswer, tapTask, uploadDismissal, uploadDraft":
    "Today's day, which holds its PaneSplit: the notices and their requests sit in its panes.",
  "Features/Today/TodayScreen.swift: answer": "Today with no goal has no split.",
  "Features/Today/TodayScreen.swift: materialDraft":
    "Today with no goal, which holds its PaneBeside, above the goal box's pane and rows.",
  "Features/Today/TodayScreen.swift: resuming": "A paused goal's Today has no split.",
  "Features/Tutor/TutorThreadView.swift: pendingAsk":
    "An offer is its panel's: dropped when the panel leaves; a panel drawn in its place takes it over once the thread is read (TutorConversation.ask).",
  "Features/Tutor/TutorToolOfferCard.swift: start":
    "The practice call's own sheet, which the router presents above any pane: closing it is leaving.",
  "Features/Tutor/TutorTurnView.swift: blockOpen":
    "The answer owns its link. Its disappearance cancels it, including on resize; another tap is the accepted cost.",
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

describe("request outcomes have an owner", () => {
  it("rejects screen failure state beside a raw task, even at a listed disappearance", async () => {
    const files = await sources();

    assert.deepEqual(
      files
        .flatMap(({ source, relative }) => screenFailuresIn(source, relative))
        .filter((site) => !(site in REQUEST_STATES)),
      [],
      "Keep the request and its outcome in VisitRequest or a feature owner, never separate @State beside Task",
    );
  });

  it("keeps only exemptions the source still needs", async () => {
    const files = await sources();

    const found = new Set(
      files.flatMap(({ source, relative }) => screenFailuresIn(source, relative)),
    );

    assert.deepEqual(
      Object.keys(REQUEST_STATES).filter((site) => !found.has(site)),
      [],
    );
  });

  it("checks each view separately and accepts owned outcomes", () => {
    assert.deepEqual(
      screenFailuresIn(
        `struct Card: View {
      @State private var failed = false
      @State private var saving: Task<Void, Never>?
      func save() { saving = Task { if case .failed = await write() { failed = true } } }
    }`,
        "Card.swift",
      ),
      ["Card.swift: Card"],
    );

    assert.deepEqual(
      screenFailuresIn(
        `struct Card: View {
      @State private var saving = VisitRequest<Bool>()
    }
    struct Other: View { @State private var failed = false }`,
        "Card.swift",
      ),
      [],
    );
  });
});
