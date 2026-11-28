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
  /// A course's test before it starts.
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

/// A course's test in onboarding: the test or "First lesson", then the same test the plan opens.
/// Main's course placement step.
struct PlacementStep: View {
  let view: GoalOnboarding
  let subject: String
  let onDone: (String?) async throws -> Void

  @Environment(OnboardingStore.self) private var onboarding
  /// The learner picked the test on the offer.
  @State private var started = false
  @State private var isSaving = false
  @State private var failed = false
  @State private var tasks = ScreenTasks()

  var body: some View {
    let step = view.testStep

    Group {
      if started || step?.mode == .direct {
        flow(.start)
      } else if step?.mode == .offer, let offer = step?.courseOffer {
        TestOffer(
          cards: [
            TestCopy.courseCard(offer), TestCopy.firstLessonCard(title: view.firstLesson?.title),
          ],
          title: Text(TestCopy.whereToStart), description: Text(TestCopy.findsSkips),
          preselected: .quick,
          context: AnalyticsEvent.TestContext(
            goalID: view.goal.id, test: .course, surface: .onboarding,
            questions: offer.questions),
          isSaving: isSaving, failed: failed
        ) { row in
          if row == .firstLesson {
            firstLesson()
          } else {
            started = true
          }
        }
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
  /// A quiet line under the facts, such as why a test has fewer parts than it said.
  var footnote: LocalizedStringResource?
  var continueLabel: Text?
  var secondary: Secondary?
  var undo: PlacementResultUndo?
  var failureMessage: LocalizedStringResource?
  /// What belongs to the title, under it in the heading, such as a result's course line.
  var underTitle: AnyView?
  let isSaving: Bool
  let failed: Bool
  let onContinue: () -> Void
  @ViewBuilder var lead: () -> Lead

  var body: some View {
    ZoonkList {
      StepHeader(subject: subject, title: title, description: description, below: underTitle)

      // Main's facts are what the test found, under the heading rather than in it.
      if !facts.isEmpty || footnote != nil {
        VStack(alignment: .leading, spacing: 4) {
          if !facts.isEmpty {
            FactSegments(facts)
              .typeStyle(.data)
          }

          if let footnote {
            Text(footnote)
              .typeStyle(.meta)
          }
        }
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
    .testTop(.open)
  }
}

extension TestOutcome where Lead == EmptyView {
  init(
    subject: String? = nil, title: Text, description: Text? = nil, facts: [String] = [],
    footnote: LocalizedStringResource? = nil, continueLabel: Text? = nil,
    secondary: Secondary? = nil, undo: PlacementResultUndo? = nil,
    failureMessage: LocalizedStringResource? = nil, isSaving: Bool, failed: Bool,
    onContinue: @escaping () -> Void
  ) {
    self.init(
      subject: subject, title: title, description: description, facts: facts,
      footnote: footnote, continueLabel: continueLabel, secondary: secondary, undo: undo,
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

/// A question's second button in the bar where the question has its own, such as a listening
/// question's "Can't listen now". It keeps the width of the widest label it shows in turn, so
/// Confirm beside it never moves.
struct QuestionSecondAction {
  let label: LocalizedStringResource
  var steadyAmong: [LocalizedStringResource] = []
  /// Pressed in place of answering "I don't know yet".
  var action: (() -> Void)?
}

/// A question of any test, under the test's task top: what it tests as the bar's title over one
/// segment a question. A new question gets a fresh view (`.id`), so nothing picked carries over.
struct PlacementQuestionScreen<Media: View>: View {
  /// What the question tests: its skill, chapter or subject.
  let subject: String
  let number: Int
  /// The ceiling promised before the first question.
  let total: Int
  /// The sizes of the test's sections in order, where it has them.
  var groups: [Int] = []
  let question: PracticeQuestion
  var askedIn: String?
  var labels = PracticeTrueFalseLabels.trueFalse
  var second: QuestionSecondAction?
  let isSaving: Bool
  let failures: Int
  var saveFailure: LocalizedStringResource?
  /// Said over the ways out behind ✕, when stopping is worth suggesting.
  var stopHint: LocalizedStringResource?
  /// What ✕ reports while this question shows.
  var context: AnalyticsEvent.TestContext?
  let onReport: () -> Void
  let onAnswer: (PracticeAnswer) -> Void
  /// "Stop and use my answers", behind ✕ from the second question; nil where stopping saves
  /// nothing yet.
  let onStop: (() -> Void)?
  @ViewBuilder var media: () -> Media

  @State private var draft: PracticeAnswer?
  @State private var submission: Submission?

  private enum Submission { case confirm, second, stop }

  static var dontKnow: LocalizedStringResource {
    LocalizedStringResource(
      "I don't know yet", table: "Onboarding",
      comment: "Answers a placement question without guessing")
  }

  var body: some View {
    PracticeTaskLayout {
      media()
      asked.stimulus
    } response: {
      asked.response

      if let saveFailure, !isSaving {
        FailureLine(message: saveFailure)
      }

      if failures > 0, !isSaving {
        SaveFailureNotice(failures: failures, onReport: onReport)
      }
    } actions: {
      let answer = question.answerToSubmit(draft)
      PracticeActionRow {
        QuestionDontKnowButton(
          title: second?.label ?? Self.dontKnow, steadyAmong: second?.steadyAmong ?? [],
          isBusy: isSaving && submission == .second, isDisabled: isSaving
        ) {
          submission = .second

          if let action = second?.action {
            action()
          } else {
            onAnswer(.dontKnow)
          }
        }

        PracticeMainButton(
          title: LocalizedStringResource(
            "Confirm", table: "Onboarding", comment: "Sends a placement answer"),
          // A stop sent from behind ✕ has no button of its own on this screen.
          isBusy: isSaving && (submission == .confirm || submission == .stop),
          isDisabled: isSaving || answer == nil
        ) {
          if let answer {
            submission = .confirm
            onAnswer(answer)
          }
        }
      }
    }
    .testTop(.question(top))
  }

  private var top: TestQuestionTop {
    TestQuestionTop(
      title: subject, answered: number - 1, total: total, groups: groups,
      leaving: context.map { .testLeft($0, questionNumber: number) },
      stop: number > 1
        ? onStop.map { onStop in
          TestStop(id: question.itemId, hint: stopHint, waits: isSaving) {
            submission = .stop
            onStop()
          }
        } : nil)
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
    onStop: (() -> Void)?
  ) {
    self.init(
      subject: subject, number: number, total: total, question: question, askedIn: askedIn,
      labels: labels, isSaving: isSaving, failures: failures, saveFailure: saveFailure,
      stopHint: stopHint, context: context, onReport: onReport, onAnswer: onAnswer,
      onStop: onStop, media: { EmptyView() }
    )
  }
}
