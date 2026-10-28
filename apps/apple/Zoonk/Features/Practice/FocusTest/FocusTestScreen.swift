import SwiftUI

/// A plan's focus test: a few questions on each subject worth the most, no feedback until the end;
/// the weakest of them get the plan's focus, with an undo on the result. Questions still missing
/// are written on the learner's Start, and the test asks the ones it has while the rest arrive.
struct FocusTestScreen: View {
  let goalId: String

  @Environment(SessionStore.self) private var session
  @Environment(PracticeStore.self) private var practice
  @Environment(\.practiceHooks) private var hooks
  @Environment(\.dismiss) private var dismiss
  @State private var load: PracticeLoad<FocusTestQuestions> = .loading
  @State private var started = false
  @State private var isWriting = false
  @State private var writingEnded = false
  @State private var writeFailure: (any Error)?
  @State private var questions: [PracticeQuestion] = []
  @State private var isSubmitting = false
  @State private var submitFailed = false
  @State private var result: Components.Schemas.FocusTestResult?
  @State private var undone = false
  @State private var undoFailed = false

  private var draftKey: String { "focus-test:\(goalId)" }

  var body: some View {
    NavigationStack {
      Group {
        if let result {
          resultView(result)
        } else {
          switch load {
          case .loading:
            ProgressView().frame(maxWidth: .infinity, maxHeight: .infinity)
          case .failed(let error):
            PracticeLoadFailureView(error: error) { Task { await read() } }
          case .loaded(let test):
            if started, !questions.isEmpty {
              GradedAtEndRun(
                questions: questions, labels: test.trueFalseLabels, draftKey: draftKey,
                hint: { $0.area ?? "" },
                upcomingTotal: test.needsItems.isEmpty
                  ? nil : test.areas.count * test.questionsPerArea,
                upcomingEnded: writingEnded, isPending: isSubmitting, failed: submitFailed
              ) { answers in Task { await submit(answers) } }
            } else {
              intro(test)
            }
          }
        }
      }
      .navigationTitle(
        Text("Focus test", tableName: "Practice", comment: "Title of a plan's focus test.")
      )
      .navigationBarTitleDisplayMode(.inline)
      .toolbar {
        ToolbarItem(placement: .cancellationAction) {
          PracticeCloseButton { dismiss() }
        }.keepsVisibleInBar()
      }
    }
    // Loads once the session (and the active goal) is known, and again if it changes: a screen
    // opened at launch can appear before the session is restored.
    .task(id: session.authenticatedSession) { await read() }
  }

  private func intro(_ test: FocusTestQuestions) -> some View {
    let count = test.areas.count * test.questionsPerArea
    let minutes = max(1, Int((Double(count) * 30 / 60).rounded()))

    return PracticeQuestionsPreparingView(
      title: LocalizedStringResource(
        "Where should you focus?", table: "Practice", comment: "Title of a focus test's start."),
      detail: LocalizedStringResource(
        "A few questions on each subject. The ones you need most come first and get more depth.",
        table: "Practice",
        comment: "What a focus test does."),
      writingDetail: LocalizedStringResource(
        "We're writing the rest of the test. It goes on here when they're ready.",
        table: "Practice",
        comment: "A test waits for the questions still being written."),
      facts: [
        String(
          localized: "\(test.areas.count) subjects", table: "Practice",
          comment: "How many subjects a focus test asks about."),
        String(
          localized: "\(count) questions", table: "Practice",
          comment: "How many questions a test asks."),
        String(
          localized:
            "About \(Duration.seconds(minutes * 60).formatted(.units(allowed: [.minutes], width: .wide)))",
          table: "Practice", comment: "About how long a test takes."),
      ],
      isWriting: isWriting && questions.isEmpty, failure: writeFailure
    ) { Task { await start(test) } }
  }

  private func resultView(_ result: Components.Schemas.FocusTestResult) -> some View {
    let chosen = result.areas.filter(\.chosen).map(\.label)

    return PracticeTaskLayout {
      if undone {
        Text(
          "Your plan is back as it was", tableName: "Practice",
          comment: "After undoing a focus test's change."
        )
        .font(.largeTitle.bold())
      } else {
        VStack(alignment: .leading, spacing: 6) {
          Text(
            "Your new focus", tableName: "Practice",
            comment: "Eyebrow over a focus test's chosen subjects."
          )
          .font(.subheadline.weight(.medium)).foregroundStyle(.secondary)
          Text(chosen.formatted(.list(type: .and))).font(.largeTitle.bold())
          Text(
            "These subjects count a lot, and they're where you missed most. Your plan now gives them more depth, and every other topic stays in it.",
            tableName: "Practice", comment: "Why a focus test chose its subjects."
          )
          .foregroundStyle(.secondary)
        }
      }

      VStack(alignment: .leading, spacing: 12) {
        Text(
          "How you did", tableName: "Practice",
          comment: "Heading over a focus test's results by subject."
        )
        .font(.headline)

        ForEach(result.areas, id: \.name) { area in
          HStack(spacing: 12) {
            Text(area.label).frame(maxWidth: .infinity, alignment: .leading)
            HStack(spacing: 3) {
              ForEach(Array(area.answers.enumerated()), id: \.offset) { _, isCorrect in
                Capsule().fill(isCorrect ? Color.success : Color.destructive).frame(
                  width: 14, height: 4)
              }
            }
            Text("\(area.correct)/\(area.total)").font(.subheadline.monospacedDigit())
              .foregroundStyle(.secondary)
          }
          .accessibilityElement(children: .combine)
        }
      }

      if undoFailed {
        Text(
          "We couldn't undo it. Try again.", tableName: "Practice",
          comment: "Undoing a focus test's change failed."
        )
        .font(.subheadline).foregroundStyle(.destructive)
      }
    } actions: {
      if let changeId = result.changeId, !undone {
        Button {
          Task { await undo(changeId) }
        } label: {
          Text(
            "Undo", tableName: "Practice",
            comment: "Puts the plan back as it was before a focus test."
          )
          .frame(maxWidth: .infinity)
        }
        .buttonStyle(.glass)
        .controlSize(.large)
      }

      PracticeMainButton(
        title: LocalizedStringResource(
          "See your plan", table: "Practice", comment: "Leaves a focus test's result for the plan.")
      ) {
        dismiss()
      }
    }
  }

  // MARK: Requests

  private func read() async {
    guard let identity = session.authenticatedSession else { return }

    do {
      let test = try await practice.api.focusTest(token: identity.bearerToken, goalId: goalId)
      guard session.authenticatedSession == identity else { return }
      // A question written later fills a place that had none, never one already asked.
      let known = Set(questions.map(\.itemId))
      questions += test.questions.filter { !known.contains($0.itemId) }
      load = .loaded(test)
    } catch let error as APIError {
      if error == .unauthorized { await session.expire(identity) }
      load = .failed(error)
    } catch {
      load = .failed(.unavailable)
    }
  }

  /// Start asks for missing questions (the learner's tap) and asks the ones it has meanwhile.
  private func start(_ test: FocusTestQuestions) async {
    guard !test.needsItems.isEmpty else {
      started = true
      return
    }

    isWriting = true
    writeFailure = nil
    started = !questions.isEmpty
    defer { isWriting = false }

    let goalId = goalId
    let written = await practice.write(.answered) { identity in
      if case .generating(let generationId) = try await practice.api.writeFocusTest(
        token: identity.bearerToken, goalId: goalId)
      {
        try await practice.api.waitForQuestions(
          token: identity.bearerToken, generationId: generationId,
          readyStep: "focusTestQuestionsReady")
      }
    }

    switch written {
    case .done:
      await read()
      started = true
      if case .loaded(let updated) = load, !updated.needsItems.isEmpty { writingEnded = true }
    case .refused(let refusal):
      writingEnded = true
      if questions.isEmpty { writeFailure = refusal }
    case .failed(let error):
      writingEnded = true
      if questions.isEmpty { writeFailure = error }
    case .obsolete:
      break
    }
  }

  private func submit(_ answers: [PracticeChoiceAnswer]) async {
    isSubmitting = true
    submitFailed = false
    defer { isSubmitting = false }

    let goalId = goalId
    switch await practice.write(
      .planChanged,
      { identity in
        try await practice.api.submitFocusTest(
          token: identity.bearerToken, goalId: goalId, answers: answers)
      })
    {
    case .done(let graded):
      PracticeAnswerDraft.clear(key: draftKey)
      result = graded
    case .refused, .failed:
      submitFailed = true
    case .obsolete:
      break
    }
  }

  private func undo(_ changeId: String) async {
    let goalId = goalId
    switch await practice.write(
      .planChanged,
      { identity in
        try await practice.api.undoPlanChange(
          token: identity.bearerToken, goalId: goalId, changeId: changeId)
      })
    {
    case .done:
      undone = true
      undoFailed = false
    case .refused, .failed:
      undoFailed = true
    case .obsolete:
      break
    }
  }
}
