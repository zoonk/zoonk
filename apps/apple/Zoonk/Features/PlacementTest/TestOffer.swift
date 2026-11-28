import SwiftUI

/// One way to start: a test with its size and time, or the first lesson by its name.
struct TestOfferCard: Equatable {
  let id: AnalyticsEvent.TestRow
  let label: String
  /// One quiet line under the name: the most questions a test asks, a lesson's name.
  var line: String?
  /// A test's mark in its kind's hue, or a lesson's.
  var kind = LearnKind.mock
  /// How long it takes, as the card's readout.
  var minutes: Int?
}

/// Main's test offer, one piece for the three tests: each way to start is a card with its mark,
/// and a test's card says how many questions it asks and how long it takes. With two cards one
/// comes picked and the main action starts the picked one; a test offered alone is its card and
/// the way in. The plan's has "Not now" beside the main action; onboarding's none, since "First
/// lesson" is its way to decline.
struct TestOffer: View {
  let cards: [TestOfferCard]
  let title: Text
  var description: Text?
  let preselected: AnalyticsEvent.TestRow
  /// For the offer's analytics, sent once per presentation.
  let context: AnalyticsEvent.TestContext
  let isSaving: Bool
  let failed: Bool
  /// "Not now", on the plan.
  var onNotNow: (() -> Void)?
  let onStart: (AnalyticsEvent.TestRow) -> Void

  @State private var picked: AnalyticsEvent.TestRow?
  @State private var offered = false
  /// Each card's own height, so every card takes the tallest and they read as a pair.
  @State private var heights: [AnalyticsEvent.TestRow: CGFloat] = [:]

  var body: some View {
    let picked = self.picked ?? preselected

    ZoonkList {
      StepHeader(title: title, description: description)

      Section {
        ForEach(cards, id: \.id) { card in
          if cards.count > 1 {
            Button {
              self.picked = card.id
            } label: {
              TestOfferCardView(
                card: card, isPicked: picked == card.id, picks: true,
                minHeight: heights.values.max()
              ) { heights[card.id] = $0 }
            }
            .buttonStyle(.plain)
            .accessibilityAddTraits(picked == card.id ? .isSelected : [])
          } else {
            TestOfferCardView(card: card, isPicked: false, picks: false)
          }
        }
        .listRowBackground(Color.clear)
        .listRowSeparator(.hidden)
        .listRowInsets(.vertical, 4)
      }
      .locksWhileSaving()
    }
    .bottomBar(note: failed && !isSaving ? BarNote(TestCopy.saveFailure) : nil) {
      StepButtons(
        continueLabel: Text(mainLabel(picked)),
        skipLabel: Text(PlacementTestCopy.notNow),
        onContinue: { onStart(picked) }, onSkip: onNotNow)
    }
    .onboardingColumn()
    .environment(\.isSavingAnswer, isSaving)
    .onAppear {
      guard !offered else { return }
      offered = true
      UsageAnalytics.track(
        .testOffered(context, rows: cards.map(\.id), preselected: preselected))
    }
  }

  /// "Start" for a test; "Continue" for onboarding's first lesson, since the daily time and the
  /// plan still follow.
  private func mainLabel(_ row: AnalyticsEvent.TestRow) -> LocalizedStringResource {
    row == .firstLesson ? TestCopy.continueSetup : TestCopy.start
  }
}

/// An offer's card: its mark, its name over one quiet line, its minutes as a readout and, where
/// there's a choice, its ring. The picked one sits on the pick's tint; the others are outlined.
private struct TestOfferCardView: View {
  let card: TestOfferCard
  let isPicked: Bool
  let picks: Bool
  var minHeight: CGFloat?
  var onHeight: (CGFloat) -> Void = { _ in }

  var body: some View {
    let shape = RoundedRectangle(cornerRadius: Radius.option, style: .continuous)

    HStack(spacing: 16) {
      // The mark centers on the name and its line, as a list row's does (craft E5).
      HStack(spacing: 16) {
        KindMark(kind: card.kind)
          .markColumn()

        VStack(alignment: .leading, spacing: 2) {
          Text(verbatim: card.label)
            .typeStyle(.reading)
            .fontWeight(.medium)
            .foregroundStyle(Color(.foreground))

          if let line = card.line {
            Text(verbatim: line)
              .typeStyle(.meta)
              .foregroundStyle(.mutedForeground)
          }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .multilineTextAlignment(.leading)
      }

      if let minutes = card.minutes {
        BigQuantity(studyDuration(minutes: minutes))
          .fixedSize()
      }

      if picks {
        ChoiceMark(isPicked: isPicked)
      }
    }
    .onGeometryChange(for: CGFloat.self) {
      $0.size.height
    } action: {
      onHeight($0)
    }
    .frame(minHeight: minHeight)
    .padding(16)
    .contentShape(shape)
    .background {
      if isPicked {
        shape.fill(.selectedTint)
      } else {
        shape.strokeBorder(.input, lineWidth: 1)
      }
    }
    .accessibilityElement(children: .combine)
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

  static let finishLater = LocalizedStringResource(
    "Finish later", table: "Onboarding")

  static let stopAndUseAnswers = LocalizedStringResource(
    "Stop and use my answers", table: "Onboarding")

  static let startLesson = LocalizedStringResource(
    "Start lesson", table: "Onboarding")

  /// Its own key: a wait's finished step says "Done" too, which some languages word otherwise.
  static let done = LocalizedStringResource(
    "leaveTestResult", defaultValue: "Done", table: "Onboarding",
    comment: "Leaves a test's result")

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

  /// "Up to 8 questions": a test can end sooner than its ceiling.
  static func upToQuestions(_ count: Int) -> String {
    String(
      localized: "Up to \(count) questions", table: "Onboarding", locale: .appLanguage,
      comment: "The most questions a test asks. It can end sooner.")
  }

  static func about(minutes: Int) -> String {
    String(
      localized: "About \(studyDuration(minutes: minutes))", table: "Onboarding")
  }

  static func question(_ number: Int, of total: Int) -> String {
    String(
      localized: "Question \(number) of \(total)", table: "Onboarding")
  }

  /// A test's card: the most it asks, and how long it takes as the card's readout.
  static func testCard(
    _ id: AnalyticsEvent.TestRow = .quick, label: String, questions: Int?, minutes: Int?
  ) -> TestOfferCard {
    TestOfferCard(
      id: id, label: label, line: questions.map(upToQuestions), kind: .mock, minutes: minutes)
  }

  /// The other way to start, by the lesson's name where onboarding knows it.
  static func firstLessonCard(title: String?) -> TestOfferCard {
    TestOfferCard(
      id: .firstLesson, label: String(localized: firstLesson), line: title, kind: .lesson)
  }

  /// A course's test card.
  static func courseCard(_ offer: CoursePlacementOffer?) -> TestOfferCard {
    testCard(
      label: String(
        localized: "Test", table: "Onboarding",
        comment: "The name of a course's placement test, on the card that offers it."),
      questions: offer?.questions, minutes: offer?.estimatedMinutes)
  }
}
