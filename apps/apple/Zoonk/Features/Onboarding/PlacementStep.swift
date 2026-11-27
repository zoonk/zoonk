import SwiftUI

/// Onboarding's test step, as core decides it: the offer of where to start (`offer`), the test the
/// learner already asked for (`direct`) or the one they came back to (`resume`).
struct OnboardingTestStep: Decodable, Equatable {
  enum Mode: String, Decodable {
    case offer, direct, resume
  }

  enum Kind: String, Decodable {
    case course, focus, language
  }

  let mode: Mode
  let kind: Kind
  /// A course's quick test and, with more than one part, its full test.
  let courseOffer: CoursePlacementOffer?
  /// The Focus test's sitting.
  let focusOffer: FocusTest.Offer?

  init(from decoder: any Decoder) throws {
    let container = try decoder.container(keyedBy: CodingKeys.self)
    mode = try container.decode(Mode.self, forKey: .mode)
    let test = try container.nestedContainer(keyedBy: CodingKeys.self, forKey: .test)
    kind = try test.decode(Kind.self, forKey: .kind)
    courseOffer =
      kind == .course ? try test.decodeIfPresent(CoursePlacementOffer.self, forKey: .offer) : nil
    focusOffer =
      kind == .focus ? try test.decodeIfPresent(FocusTest.Offer.self, forKey: .offer) : nil
  }

  private enum CodingKeys: String, CodingKey {
    case mode, test, kind, offer
  }
}

extension GoalOnboarding {
  var testStep: OnboardingTestStep? {
    placement.flatMap { try? PracticeJSON.recode($0, as: OnboardingTestStep.self) }
  }
}

/// A course's test in onboarding: "First lesson" or a test, then the same test the plan opens.
/// Main's course placement step.
struct PlacementStep: View {
  let view: GoalOnboarding
  let subject: String
  let onDone: (String?) async throws -> Void

  @Environment(OnboardingStore.self) private var onboarding
  /// The test the learner picked on the offer.
  @State private var chosen: PlacementLength?
  @State private var isSaving = false
  @State private var failed = false
  @State private var tasks = ScreenTasks()

  var body: some View {
    let step = view.testStep

    Group {
      if let chosen {
        flow(.start(chosen))
      } else if step?.mode == .offer, let offer = step?.courseOffer {
        TestOffer(
          rows: [TestCopy.firstLessonRow(statedLevel: view.statedLevel)]
            + TestCopy.courseRows(offer),
          title: Text(TestCopy.whereToStart), description: Text(TestCopy.findsSkips),
          preselected: .quick,
          context: AnalyticsEvent.TestContext(
            goalID: view.goal.id, test: .course, surface: .onboarding,
            parts: offer.wholeCourse?.parts, questions: offer.questions),
          isSaving: isSaving, failed: failed
        ) { row in
          switch row {
          case .firstLesson: firstLesson()
          case .wholeCourse: chosen = .wholeCourse
          default: chosen = .quick
          }
        }
      } else if step?.mode == .direct {
        flow(.start(.quick))
      } else {
        flow(.read)
      }
    }
    .onDisappear { tasks.cancel() }
  }

  private func flow(_ opening: PlacementTestFlow.Opening) -> some View {
    PlacementTestFlow(
      goalID: view.goal.id, subject: subject, opening: opening, onboarding: view,
      onOnboardingDone: onDone
    ) {
      try await onDone(nil)
    }
  }

  /// "First lesson": the plan starts at the level the learner gave, and setup goes on.
  private func firstLesson() {
    guard !isSaving else { return }

    isSaving = true
    failed = false

    tasks.run {
      defer { isSaving = false }

      do {
        try await onboarding.finishPlacement(goalID: view.goal.id, fromScratch: true)
        try await goOnUnlessLeft { try await onDone(nil) }
      } catch is CancellationError {
      } catch {
        failed = true
      }
    }
  }
}

/// Main's `TestOutcome`: the end of a test, what it found and the way on. A save that failed is said
/// over the bar, and Continue tries again.
struct TestOutcome<Lead: View>: View {
  /// A way on beside the main one, such as "Finish later".
  struct Secondary {
    let label: Text
    let action: () -> Void
  }

  var subject: String?
  let title: Text
  var description: Text?
  var facts: [String] = []
  var continueLabel: Text?
  var secondary: Secondary?
  var undo: PlacementResultUndo?
  var failureMessage: LocalizedStringResource?
  let isSaving: Bool
  let failed: Bool
  let onContinue: () -> Void
  @ViewBuilder var lead: () -> Lead

  var body: some View {
    ZoonkList {
      StepHeader(subject: subject, title: title, description: description)

      // Main's facts are what the test found, under the heading rather than in it.
      if !facts.isEmpty {
        FactSegments(facts)
          .typeStyle(.data)
          .foregroundStyle(.mutedForeground)
          .listRowBackground(Color.clear)
          .listRowSeparator(.hidden)
      }

      lead()
    }
    .bottomBar(
      note: undo?.failure
        ?? (failed && !isSaving ? BarNote(failureMessage ?? TestCopy.saveFailure) : nil)
    ) {
      undo?.button
      StepButtons(
        continueLabel: continueLabel, skipLabel: secondary?.label, onContinue: onContinue,
        onSkip: secondary?.action)
    }
    .onboardingColumn()
    .environment(\.isSavingAnswer, isSaving)
  }
}

extension TestOutcome where Lead == EmptyView {
  init(
    subject: String? = nil, title: Text, description: Text? = nil, facts: [String] = [],
    continueLabel: Text? = nil, secondary: Secondary? = nil, undo: PlacementResultUndo? = nil,
    failureMessage: LocalizedStringResource? = nil, isSaving: Bool, failed: Bool,
    onContinue: @escaping () -> Void
  ) {
    self.init(
      subject: subject, title: title, description: description, facts: facts,
      continueLabel: continueLabel, secondary: secondary, undo: undo,
      failureMessage: failureMessage, isSaving: isSaving, failed: failed,
      onContinue: onContinue, lead: { EmptyView() })
  }
}

/// No test could be made for the goal, which is fine: the first days show what the learner knows.
/// The short test's and the Focus test's.
struct PlacementUnavailable: View {
  /// Onboarding's Continue unless it's given.
  var continueLabel: Text?
  let isSaving: Bool
  let failed: Bool
  let onContinue: () -> Void

  var body: some View {
    TestOutcome(
      title: Text(
        "We'll see what you know in your first few days", tableName: "Onboarding",
        comment: "Title when no test could be made for a goal; nothing is wrong"),
      continueLabel: continueLabel, isSaving: isSaving, failed: failed, onContinue: onContinue)
  }
}

/// The ✕ of a test's screen during a sitting: what it reports as the learner leaves.
struct TestLeaveKey: PreferenceKey {
  static let defaultValue: AnalyticsEvent? = nil

  static func reduce(value: inout AnalyticsEvent?, nextValue: () -> AnalyticsEvent?) {
    value = nextValue() ?? value
  }
}

/// A question of any test, under its chip and its place in the test: "Question 5 of 12", or "Part 3
/// of 14 · Question 5 of 12" in a full test. A new question gets a fresh view (`.id`), so nothing
/// picked carries over.
struct PlacementQuestionScreen<Media: View>: View {
  /// What the question tests: its skill, chapter or subject.
  let subject: String
  let number: Int
  /// The ceiling promised before the first question.
  let total: Int
  /// The full test's part and its count of parts.
  var part: (number: Int, of: Int)?
  let question: PracticeQuestion
  var askedIn: String?
  var labels = PracticeTrueFalseLabels.trueFalse
  var dontKnowLabel = LocalizedStringResource(
    "I don't know yet", table: "Onboarding",
    comment: "Answers a placement question without guessing")
  /// A listening question's "Can't listen now".
  var defersAudio: (() -> Void)?
  let isSaving: Bool
  let failures: Int
  var saveFailure: LocalizedStringResource?
  /// Said right above Stop, when stopping is worth suggesting.
  var stopHint: LocalizedStringResource?
  /// What ✕ reports while this question shows.
  var context: AnalyticsEvent.TestContext?
  let onReport: () -> Void
  let onAnswer: (PracticeAnswer) -> Void
  /// "Stop and use my answers", from the second question; nil where stopping saves nothing yet.
  let onStop: (() -> Void)?
  @ViewBuilder var media: () -> Media

  @State private var draft: PracticeAnswer?
  @State private var submission: Submission?

  private enum Submission { case confirm, dontKnow, deferAudio, stop }

  var body: some View {
    PracticeTaskLayout {
      ChipRow(chip: Chip(Text(verbatim: subject)), position: Text(verbatim: position))

      media()

      // Under the voice message, where it's needed, as main's link.
      if let defersAudio {
        BusyButton(isBusy: isSaving && submission == .deferAudio) {
          submission = .deferAudio
          defersAudio()
        } label: {
          Text(TestCopy.cantListen)
            .underline()
        }
        .buttonStyle(.borderless)
        .disabled(isSaving && submission != .deferAudio)
      }

      asked.stimulus
    } response: {
      asked.response

      if let saveFailure, !isSaving {
        FailureLine(message: saveFailure)
      }

      if failures > 0, !isSaving {
        SaveFailureNotice(failures: failures, onReport: onReport)
      }

      if number > 1, let onStop {
        if let stopHint {
          Text(stopHint)
            .typeStyle(.note)
            .foregroundStyle(.mutedForeground)
        }

        BusyButton(isBusy: isSaving && submission == .stop) {
          submission = .stop
          onStop()
        } label: {
          Text(
            "Stop and use my answers", tableName: "Onboarding"
          )
          .underline()
        }
        .buttonStyle(.borderless)
        .disabled(isSaving && submission != .stop)
      }
    } actions: {
      let answer = question.answerToSubmit(draft)
      PracticeActionRow {
        QuestionDontKnowButton(
          title: dontKnowLabel, isBusy: isSaving && submission == .dontKnow,
          isDisabled: isSaving
        ) {
          submission = .dontKnow
          onAnswer(.dontKnow)
        }

        PracticeMainButton(
          title: LocalizedStringResource(
            "Confirm", table: "Onboarding", comment: "Sends a placement answer"),
          isBusy: isSaving && submission == .confirm,
          isDisabled: isSaving || answer == nil
        ) {
          if let answer {
            submission = .confirm
            onAnswer(answer)
          }
        }
      }
    }
    .preference(
      key: TestQuestionProgressKey.self, value: Double(number - 1) / Double(max(1, total))
    )
    .preference(
      key: TestLeaveKey.self, value: context.map { .testLeft($0, questionNumber: number) })
  }

  /// "Part 3 of 14 · Question 5 of 12": two facts, joined as facts are.
  private var position: String {
    let question = TestCopy.question(number, of: total)

    guard let part else { return question }
    return [TestCopy.part(part.number, of: part.of), question].joinedFacts()
  }

  private var asked: PracticeQuestionView {
    PracticeQuestionView(
      question: question, labels: labels, isLocked: isSaving, askedIn: askedIn, draft: $draft
    ) {
      answer in
      guard !isSaving else { return }
      submission = .confirm
      onAnswer(answer)
    }
  }
}

extension PlacementQuestionScreen where Media == EmptyView {
  init(
    subject: String,
    number: Int,
    total: Int,
    part: (number: Int, of: Int)? = nil,
    question: PracticeQuestion,
    askedIn: String? = nil,
    labels: PracticeTrueFalseLabels,
    isSaving: Bool,
    failures: Int,
    saveFailure: LocalizedStringResource? = nil,
    stopHint: LocalizedStringResource? = nil,
    context: AnalyticsEvent.TestContext? = nil,
    onReport: @escaping () -> Void,
    onAnswer: @escaping (PracticeAnswer) -> Void,
    onStop: @escaping () -> Void
  ) {
    self.init(
      subject: subject, number: number, total: total, part: part, question: question,
      askedIn: askedIn, labels: labels, isSaving: isSaving, failures: failures,
      saveFailure: saveFailure, stopHint: stopHint, context: context, onReport: onReport,
      onAnswer: onAnswer, onStop: onStop, media: { EmptyView() }
    )
  }
}
