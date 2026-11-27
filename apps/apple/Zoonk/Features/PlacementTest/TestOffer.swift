import SwiftUI

/// One of the offer's rows: a test with its facts, or onboarding's "First lesson".
struct TestOfferRow: Equatable {
  let id: AnalyticsEvent.TestRow
  let label: String
  let facts: [String]
}

/// Main's test offer, one piece for the three tests: where to start in onboarding ("First lesson"
/// or a test), which test to take on the plan, or the one test with its facts. The main action
/// follows the picked row; the plan's has "Not now" beside it, onboarding's none, since "First
/// lesson" is its way to decline.
struct TestOffer: View {
  let rows: [TestOfferRow]
  /// A screen with one test names it over the title; rows name themselves.
  var chip: String?
  let title: Text
  var description: Text?
  let preselected: AnalyticsEvent.TestRow
  /// For the offer's analytics, sent once per presentation.
  let context: AnalyticsEvent.TestContext
  /// The plan's way out: "Not now", or "Finish later" for a test with parts left.
  var notNowLabel = PlacementTestCopy.notNow
  let isSaving: Bool
  let failed: Bool
  /// "Not now", on the plan.
  var onNotNow: (() -> Void)?
  let onStart: (AnalyticsEvent.TestRow) -> Void

  @State private var picked: AnalyticsEvent.TestRow?
  @State private var offered = false

  var body: some View {
    let picked = self.picked ?? preselected

    ZoonkList {
      StepHeader(
        subject: rows.count == 1 ? chip : nil,
        position: rows.count == 1 ? Text(verbatim: rows[0].facts.joinedFacts()) : nil,
        title: title, description: description)

      if rows.count > 1 {
        Section {
          ForEach(rows, id: \.id) { row in
            ChoiceRow(isPicked: picked == row.id) {
              self.picked = row.id
            } words: {
              VStack(alignment: .leading, spacing: 2) {
                Text(verbatim: row.label)
                  .typeStyle(.rowTitle)
                  .foregroundStyle(Color(.foreground))

                if !row.facts.isEmpty {
                  FactSegments(row.facts)
                    .typeStyle(.meta)
                    .foregroundStyle(.mutedForeground)
                }
              }
            }
          }
        }
        .locksWhileSaving()
      }
    }
    .bottomBar(note: failed && !isSaving ? BarNote(TestCopy.saveFailure) : nil) {
      StepButtons(
        continueLabel: Text(mainLabel(picked)),
        skipLabel: Text(notNowLabel),
        onContinue: { onStart(picked) }, onSkip: onNotNow)
    }
    .onboardingColumn()
    .environment(\.isSavingAnswer, isSaving)
    .onAppear {
      guard !offered else { return }
      offered = true
      UsageAnalytics.track(
        .testOffered(context, rows: rows.map(\.id), preselected: preselected))
    }
  }
}

extension TestOffer {
  /// "Start" for a test; "Continue" for onboarding's first lesson, since the daily time and the
  /// plan still follow, and for a test the learner comes back to.
  fileprivate func mainLabel(_ row: AnalyticsEvent.TestRow) -> LocalizedStringResource {
    switch row {
    case .firstLesson: TestCopy.continueSetup
    case .continue: TestCopy.continueLabel
    default: TestCopy.start
    }
  }
}

/// The words every placement test's screens share, from main's copy deck.
enum TestCopy {
  static let saveFailure = LocalizedStringResource(
    "That didn't save. Try again.", table: "Onboarding", comment: "A change couldn't be saved")

  static let start = LocalizedStringResource(
    "Start", table: "Onboarding", comment: "Starts the test the learner picked")

  /// Onboarding still asks the daily time and builds the plan, so "First lesson" can't say Start.
  static let continueSetup = LocalizedStringResource(
    "Continue", table: "Onboarding", comment: "Saves an onboarding answer")

  static let whereToStart = LocalizedStringResource(
    "Where would you like to start?", table: "Onboarding")

  static let findsSkips = LocalizedStringResource(
    "A test finds the lessons you can skip.", table: "Onboarding",
    comment: "Under the test offer's title")

  static let skipWhatYouKnow = LocalizedStringResource(
    "Skip what you already know", table: "Onboarding")

  static let firstLesson = LocalizedStringResource(
    "First lesson", table: "Onboarding")

  static let startsAtLevel = LocalizedStringResource(
    "Starts at the level you gave", table: "Onboarding")

  static let quickTest = LocalizedStringResource(
    "Quick test", table: "Onboarding",
    comment: "The short test: about six minutes of questions.")

  static let fullTest = LocalizedStringResource(
    "Full test", table: "Onboarding",
    comment: "The long test: it checks every topic still ahead, in parts.")

  static let continueTest = LocalizedStringResource(
    "Continue your test", table: "Onboarding")

  static let continueLabel = LocalizedStringResource(
    "Continue", table: "Onboarding", comment: "Goes on with a test the learner came back to")

  static let keepGoing = LocalizedStringResource(
    "Keep going", table: "Onboarding", comment: "Starts the full test's next part")

  static let finishLater = LocalizedStringResource(
    "Finish later", table: "Onboarding")

  static let testTheRest = LocalizedStringResource(
    "Test the rest", table: "Onboarding",
    comment: "Button after the short test: goes on to test the rest of the course, in parts.")

  static let startLesson = LocalizedStringResource(
    "Start lesson", table: "Onboarding")

  static let done = LocalizedStringResource(
    "Done", table: "Onboarding", comment: "Leaves a test's result")

  static let answersSaved = LocalizedStringResource(
    "Your answers are saved", table: "Onboarding")

  static let upNext = LocalizedStringResource(
    "Up next", table: "Onboarding", comment: "Over the lesson the plan goes on with")

  static let cantListen = LocalizedStringResource(
    "Can't listen now", table: "Onboarding",
    comment:
      "Button on a listening question for a learner who can't play sound right now, such as on a bus. It ends the listening questions for this test."
  )

  static let testAgainLater = LocalizedStringResource(
    "You can take the test again later, from your plan.", table: "Onboarding",
    comment:
      "On a level test's result when listening wasn't tested, such as after the learner said they can't listen now."
  )

  static let notTested = LocalizedStringResource(
    "Not tested yet", table: "Onboarding")

  /// "Up to 12 questions": a test can end sooner than its ceiling.
  static func upToQuestions(_ count: Int) -> String {
    String(
      localized: "Up to \(count) questions", table: "Onboarding", locale: .appLanguage,
      comment: "The most questions a test asks. It can end sooner.")
  }

  static func about(minutes: Int) -> String {
    String(
      localized: "About \(studyDuration(minutes: minutes))", table: "Onboarding")
  }

  static func aboutLeft(minutes: Int) -> String {
    String(
      localized: "About \(studyDuration(minutes: minutes)) left", table: "Onboarding")
  }

  static func parts(_ count: Int) -> String {
    String(
      localized: "\(count) parts, any day you like", table: "Onboarding", locale: .appLanguage,
      comment:
        "How many parts the long test has. The learner can take each part on a different day.")
  }

  static func partsLeft(_ count: Int) -> String {
    String(
      localized: "\(count) parts left", table: "Onboarding", locale: .appLanguage,
      comment: "How many parts of a test the learner still has to take.")
  }

  static func part(_ part: Int, of parts: Int) -> String {
    String(
      localized: "Part \(part) of \(parts)", table: "Onboarding",
      comment: "Where the learner is in a test split into parts, such as “Part 3 of 14”.")
  }

  static func question(_ number: Int, of total: Int) -> String {
    String(
      localized: "Question \(number) of \(total)", table: "Onboarding")
  }

  static func partDone(_ part: Int, of parts: Int) -> String {
    String(
      localized: "Part \(part) of \(parts) done", table: "Onboarding",
      comment: "The title after one part of a test split into parts, such as “Part 3 of 14 done”.")
  }

  /// "This part skipped 2 lessons you already know."
  static func partSkipped(_ count: Int) -> String {
    count == 0
      ? String(
        localized: "No lessons skipped in this part.", table: "Onboarding",
        comment:
          "After one part of a test: how many lessons that part took out of the learner's plan.")
      : String(
        localized: "This part skipped \(count) lessons you already know.", table: "Onboarding",
        locale: .appLanguage,
        comment:
          "After one part of a test: how many lessons that part took out of the learner's plan.")
  }

  static func nextTime(part: Int, of parts: Int, question: Int) -> String {
    String(
      localized: "Next time: part \(part) of \(parts), question \(question)", table: "Onboarding",
      comment:
        "Where a learner who stopped a test picks it up: the part of the test and the question in it."
    )
  }

  /// A test's facts before it starts: "Up to 12 questions · About 6 min".
  static func testFacts(questions: Int, minutes: Int) -> [String] {
    [upToQuestions(questions), about(minutes: minutes)]
  }

  /// The full test's facts before it starts: "14 parts, any day you like · About 1 hr 25 min".
  static func fullTestFacts(_ wholeCourse: CoursePlacementOffer.WholeCourse) -> [String] {
    [parts(wholeCourse.parts), about(minutes: wholeCourse.estimatedMinutes)]
  }

  /// "First lesson", with where it starts when the learner gave a level.
  static func firstLessonRow(statedLevel: Bool) -> TestOfferRow {
    TestOfferRow(
      id: .firstLesson, label: String(localized: firstLesson),
      facts: statedLevel ? [String(localized: startsAtLevel)] : [])
  }

  /// A course's rows: its quick test, and the full test when it has more than one part.
  static func courseRows(_ offer: CoursePlacementOffer) -> [TestOfferRow] {
    [
      TestOfferRow(
        id: .quick, label: String(localized: quickTest),
        facts: testFacts(questions: offer.questions, minutes: offer.estimatedMinutes))
    ]
      + (offer.wholeCourse.map {
        [
          TestOfferRow(
            id: .wholeCourse, label: String(localized: fullTest), facts: fullTestFacts($0))
        ]
      } ?? [])
  }
}
