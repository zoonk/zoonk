import SwiftUI

/// A quick test that skips a chapter the learner already knows: one question per screen, no
/// feedback until the end, "I don't know yet" always allowed. Passing takes the chapter's lessons
/// off the plan, with an undo on its result. Its questions are written on the learner's tap, never
/// when the screen opens.
struct TestOutScreen: View {
  let chapterId: String

  @Environment(SessionStore.self) private var session
  @Environment(PracticeStore.self) private var practice
  @Environment(\.practiceHooks) private var hooks
  @Environment(LearnerSummaryStore.self) private var summary
  @Environment(\.dismiss) private var dismiss
  @State private var load: PracticeLoad<TestOutLoad> = .loading
  @State private var isWriting = false
  @State private var writeFailure: (any Error)?
  @State private var isSubmitting = false
  @State private var submitFailed = false
  @State private var result: Components.Schemas.ChapterTestOutResult?
  @State private var undo: UndoState = .idle

  /// The active goal scopes the notebook, its practice and test-outs.
  private var goalId: String? { summary.summary.value?.activeGoalID }

  private enum UndoState: Equatable { case done, failed, idle, pending }

  private var draftKey: String { "test-out:\(goalId ?? ""):\(chapterId)" }

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
          case .loaded(.nothingToSkip):
            ContentUnavailableView {
              Label {
                Text(
                  "Nothing to skip", tableName: "Practice",
                  comment: "A chapter test-out with no lessons left to skip.")
              } icon: {
                Image(systemName: "checkmark.circle")
              }
            } description: {
              Text(
                "Your plan already skips this chapter.", tableName: "Practice",
                comment: "Why a test-out has nothing to skip.")
            }
          case .loaded(.plusRequired):
            preparing(failure: PracticeAPIError.plusRequired)
          case .loaded(.test(let test)) where test.questions.isEmpty:
            preparing(failure: writeFailure)
          case .loaded(.test(let test)):
            GradedAtEndRun(
              questions: test.questions, labels: test.trueFalseLabels, draftKey: draftKey,
              hint: { _ in rule(test.passMark) }, isPending: isSubmitting, failed: submitFailed
            ) { answers in Task { await submit(answers) } }
          }
        }
      }
      .navigationTitle(
        Text("Test out", tableName: "Practice", comment: "Title of a chapter test-out.")
      )
      .navigationBarTitleDisplayMode(.inline)
      .toolbar {
        ToolbarItem(placement: .cancellationAction) {
          PracticeCloseButton { dismiss() }
        }
      }
    }
    // Loads once the session (and the active goal) is known, and again if it changes: a screen
    // opened at launch can appear before the session is restored.
    .task(id: "\(session.authenticatedSession?.accountID ?? ""):\(goalId ?? "")") { await read() }
  }

  private func preparing(failure: (any Error)?) -> some View {
    PracticeQuestionsPreparingView(
      title: LocalizedStringResource(
        "Already know this?", table: "Practice", comment: "Title of a chapter test-out's start."),
      detail: LocalizedStringResource(
        "A few questions on this chapter. Do well, and your plan skips what you already know.",
        table: "Practice",
        comment: "What a chapter test-out does."),
      writingDetail: LocalizedStringResource(
        "We're writing a few questions on this chapter. The test opens here when they're ready.",
        table: "Practice",
        comment: "While a test-out's questions are written."),
      isWriting: isWriting, failure: failure
    ) { Task { await write() } }
  }

  /// "80% right skips the chapter. No feedback until the end.", the test's one rule.
  private func rule(_ passMark: Double) -> String {
    String(
      localized:
        "\(Int((passMark * 100).rounded()))% right skips the chapter. No feedback until the end.",
      table: "Practice", comment: "A chapter test-out's rule above each question.")
  }

  private func resultView(_ result: Components.Schemas.ChapterTestOutResult) -> some View {
    PracticeTaskLayout {
      PracticeResultHeader(
        title: result.passed
          ? LocalizedStringResource(
            "You already know this", table: "Practice", comment: "A passed test-out's result.")
          : LocalizedStringResource(
            "Not yet, and that's fine", table: "Practice", comment: "A failed test-out's result."),
        detail: resultDetail(result),
        facts: [
          String(
            localized: "\(result.correct) of \(result.total) right", table: "Practice",
            comment: "A test-out's right answers out of its questions.")
        ],
        reached: PracticeReached(
          energy: result.reached.energy,
          level: result.reached.level.map { .init(color: $0.color.rawValue, level: $0.level) }))

      if undo == .failed {
        Text(
          "We couldn't put the lessons back. Try again.", tableName: "Practice",
          comment: "Undoing a test-out's skip failed."
        )
        .font(.subheadline).foregroundStyle(.destructive)
      }
    } actions: {
      if let changeId = result.changeId, undo != .done {
        Button {
          Task { await undoSkip(changeId) }
        } label: {
          Text(
            "Undo", tableName: "Practice",
            comment: "Puts a passed test-out's skipped lessons back in the plan."
          )
          .frame(maxWidth: .infinity)
        }
        .buttonStyle(.glass)
        .controlSize(.large)
        .disabled(undo == .pending)
      }

      PracticeMainButton(
        title: LocalizedStringResource(
          "Continue", table: "Practice", comment: "Moves on after a grade.")
      ) {
        dismiss()
      }
    }
  }

  private func resultDetail(_ result: Components.Schemas.ChapterTestOutResult)
    -> LocalizedStringResource
  {
    if !result.passed {
      return LocalizedStringResource(
        "The chapter stays in your plan, and your answers help it start at the right level.",
        table: "Practice",
        comment: "A failed test-out keeps the chapter.")
    }

    if undo == .done {
      return LocalizedStringResource(
        "The lessons are back in your plan.", table: "Practice",
        comment: "After undoing a test-out's skip.")
    }

    return result.lessonsSkipped == 0
      ? LocalizedStringResource(
        "Your plan already skips it.", table: "Practice",
        comment: "A passed test-out that skipped nothing new.")
      : LocalizedStringResource(
        "\(result.lessonsSkipped) lessons are off your plan.", table: "Practice",
        comment: "How many lessons a passed test-out skipped.")
  }

  // MARK: Requests

  private func read() async {
    guard let identity = session.authenticatedSession, let goalId else { return }

    do {
      let loaded = try await practice.api.testOut(
        token: identity.bearerToken, goalId: goalId, chapterId: chapterId)
      guard session.authenticatedSession == identity else { return }
      load = .loaded(loaded)
    } catch let error as APIError {
      if error == .unauthorized { await session.expire(identity) }
      load = .failed(error)
    } catch {
      load = .failed(.unavailable)
    }
  }

  /// The learner's tap writes the questions; the screen follows the run, then opens the test.
  private func write() async {
    guard let goalId else { return }

    isWriting = true
    writeFailure = nil
    defer { isWriting = false }

    let chapterId = chapterId
    switch await practice.write(
      .answered,
      { identity -> PracticeGenerationStart in
        let start = try await practice.api.writeTestOut(
          token: identity.bearerToken, goalId: goalId, chapterId: chapterId)

        if case .generating(let generationId) = start {
          try await practice.api.waitForQuestions(
            token: identity.bearerToken, generationId: generationId,
            readyStep: "testOutQuestionsReady")
        }

        return start
      })
    {
    case .done(.nothingToSkip): load = .loaded(.nothingToSkip)
    case .done: await read()
    case .refused(let refusal): writeFailure = refusal
    case .failed(let error): writeFailure = error
    case .obsolete: break
    }
  }

  /// Graded answers are done with the device's draft and the test's id; ones that didn't go
  /// through keep both, so a retry sends the same test.
  private func submit(_ answers: [PracticeChoiceAnswer]) async {
    guard let goalId else { return }

    isSubmitting = true
    submitFailed = false
    defer { isSubmitting = false }

    let chapterId = chapterId
    let requestId = PracticeAnswerDraft.requestId(key: draftKey)

    switch await practice.write(
      .planChanged,
      { identity in
        try await practice.api.submitTestOut(
          token: identity.bearerToken, goalId: goalId, chapterId: chapterId, answers: answers,
          requestId: requestId)
      })
    {
    case .done(let graded):
      PracticeAnswerDraft.clear(key: draftKey)
      if let graded { result = graded } else { load = .loaded(.nothingToSkip) }
    case .refused(.plusRequired):
      load = .loaded(.plusRequired)
    case .refused, .failed:
      submitFailed = true
    case .obsolete:
      break
    }
  }

  private func undoSkip(_ changeId: String) async {
    guard let goalId else { return }

    undo = .pending

    switch await practice.write(
      .planChanged,
      { identity in
        try await practice.api.undoPlanChange(
          token: identity.bearerToken, goalId: goalId, changeId: changeId)
      })
    {
    case .done: undo = .done
    case .refused, .failed: undo = .failed
    case .obsolete: break
    }
  }
}
