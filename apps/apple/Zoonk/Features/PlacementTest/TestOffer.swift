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
  /// The plan's way out: "Not now", or "Finish later" for a test with parts left in onboarding.
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

                FactSegments(row.facts)
                  .typeStyle(.meta)
                  .foregroundStyle(.mutedForeground)
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
    "Where would you like to start?", table: "Onboarding",
    comment: "Title of onboarding's offer: the first lesson, or a short test first")

  static let findsSkips = LocalizedStringResource(
    "A test finds the lessons you can skip.", table: "Onboarding",
    comment: "Under the test offer's title")

  static let skipWhatYouKnow = LocalizedStringResource(
    "Skip what you already know", table: "Onboarding",
    comment: "Title of the test offer on the plan")

  static let firstLesson = LocalizedStringResource(
    "First lesson", table: "Onboarding",
    comment: "Onboarding's offer: start with the first lesson instead of a test")

  static let startsAtLevel = LocalizedStringResource(
    "Starts at the level you gave", table: "Onboarding",
    comment:
      "Under \"First lesson\" on onboarding's offer: lessons start at the level the learner chose")

  static let quickTest = LocalizedStringResource(
    "Quick test", table: "Onboarding",
    comment: "The short test: about six minutes of questions.")

  static let fullTest = LocalizedStringResource(
    "Full test", table: "Onboarding",
    comment: "The long test: it checks every topic still ahead, in parts.")

  static let continueTest = LocalizedStringResource(
    "Continue your test", table: "Onboarding",
    comment: "Title of a full test the learner came back to with parts left")

  static let continueLabel = LocalizedStringResource(
    "Continue", table: "Onboarding", comment: "Goes on with a test the learner came back to")

  static let keepGoing = LocalizedStringResource(
    "Keep going", table: "Onboarding", comment: "Starts the full test's next part")

  static let finishLater = LocalizedStringResource(
    "Finish later", table: "Onboarding",
    comment: "Leaves the full test between its parts; the rest waits in the plan")

  static let testTheRest = LocalizedStringResource(
    "Test the rest", table: "Onboarding",
    comment: "Button after the short test: goes on to test the rest of the course, in parts.")

  static let startLesson = LocalizedStringResource(
    "Start lesson", table: "Onboarding",
    comment: "Opens the plan's next lesson from a test's result")

  static let done = LocalizedStringResource(
    "Done", table: "Onboarding", comment: "Leaves a test's result")

  static let answersSaved = LocalizedStringResource(
    "Your answers are saved", table: "Onboarding",
    comment: "Title after the learner stopped a test midway, or once its answers wait to be saved")

  static let upNext = LocalizedStringResource(
    "Up next", table: "Onboarding", comment: "Over the lesson the plan goes on with")

  static let cantListen = LocalizedStringResource(
    "Can't listen now", table: "Onboarding",
    comment:
      "Button on a listening question for a learner who can't play sound right now, such as on a bus. It ends the listening questions for this test."
  )

  static let listeningLater = LocalizedStringResource(
    "You can test your listening later, from your plan.", table: "Onboarding",
    comment: "Under a level test's result when listening wasn't tested")

  static let notTested = LocalizedStringResource(
    "Not tested yet", table: "Onboarding",
    comment: "A language skill the level test didn't finish, in place of its level")

  static func questions(_ count: Int) -> String {
    String(
      localized: "\(count) questions", table: "Onboarding", locale: .appLanguage,
      comment: "How many questions a test asks, such as \"12 questions\"")
  }

  static func about(minutes: Int) -> String {
    String(
      localized: "About \(studyDuration(minutes: minutes))", table: "Onboarding",
      comment: "How long a test takes, such as \"About 6 min\"")
  }

  static func aboutLeft(minutes: Int) -> String {
    String(
      localized: "About \(studyDuration(minutes: minutes)) left", table: "Onboarding",
      comment: "How long the rest of a full test takes, such as \"About 1 hr 6 min left\"")
  }

  static func aboutEach(minutes: Int) -> String {
    String(
      localized: "About \(studyDuration(minutes: minutes)) each", table: "Onboarding",
      comment: "How long each part of the full test left takes, such as \"About 6 min each\"")
  }

  static func parts(_ count: Int) -> String {
    String(
      localized: "\(count) parts, any day you like", table: "Onboarding", locale: .appLanguage,
      comment: "How many parts the full test has; they can be taken on different days")
  }

  static func partsLeft(_ count: Int) -> String {
    String(
      localized: "\(count) parts left", table: "Onboarding", locale: .appLanguage,
      comment: "How many parts of the full test are left")
  }

  static func part(_ part: Int, of parts: Int) -> String {
    String(
      localized: "Part \(part) of \(parts)", table: "Onboarding",
      comment: "Which part of the full test this is, such as \"Part 3 of 14\"")
  }

  static func question(_ number: Int, of total: Int) -> String {
    String(
      localized: "Question \(number) of \(total)", table: "Onboarding",
      comment: "Which question of a test with a promised count this is")
  }

  static func partDone(_ part: Int, of parts: Int) -> String {
    String(
      localized: "Part \(part) of \(parts) done", table: "Onboarding",
      comment: "Title after a part of the full test, such as \"Part 3 of 14 done\"")
  }

  /// "This part skipped 2 lessons you already know."
  static func partSkipped(_ count: Int) -> String {
    count == 0
      ? String(
        localized: "No lessons skipped in this part.", table: "Onboarding",
        comment: "After a part of the full test that skipped no lesson")
      : String(
        localized: "This part skipped \(count) lessons you already know.", table: "Onboarding",
        locale: .appLanguage,
        comment: "After a part of the full test: how many lessons it took out of the plan")
  }

  static func nextTime(part: Int, of parts: Int, question: Int) -> String {
    String(
      localized: "Next time: part \(part) of \(parts), question \(question)", table: "Onboarding",
      comment:
        "Where a full test the learner stopped midway goes on, such as \"part 5 of 14, question 4\""
    )
  }

  /// A test's facts before it starts: "12 questions · About 6 min".
  static func testFacts(questions: Int, minutes: Int) -> [String] {
    [Self.questions(questions), about(minutes: minutes)]
  }

  /// The full test's facts before it starts: "14 parts, any day you like · About 1 hr 25 min".
  static func fullTestFacts(_ wholeCourse: CoursePlacementOffer.WholeCourse) -> [String] {
    [parts(wholeCourse.parts), about(minutes: wholeCourse.estimatedMinutes)]
  }

  static var firstLessonRow: TestOfferRow {
    TestOfferRow(
      id: .firstLesson, label: String(localized: firstLesson),
      facts: [String(localized: startsAtLevel)])
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
