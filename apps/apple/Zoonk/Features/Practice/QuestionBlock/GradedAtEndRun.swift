import SwiftUI

/// Questions asked one per screen with no feedback until the end (a test-out, a focus test): "I
/// don't know yet" always allowed beside Next, Finish on the last one. Each answer is kept on the
/// device as it's given (`draftKey`), so leaving and coming back goes on from the next question
/// until the host clears it once the answers are graded. Questions can still be arriving
/// (`upcomingTotal`): the run waits for them after the last one it has.
struct GradedAtEndRun: View {
  let questions: [PracticeQuestion]
  let labels: PracticeTrueFalseLabels
  let draftKey: String
  /// The line above each question: the test's rule, or the question's area.
  var hint: (PracticeQuestion) -> String = { _ in "" }
  /// How many questions the run asks in all, the ones still being written included.
  var upcomingTotal: Int?
  /// The writing stopped short: the learner can finish with the answers given.
  var upcomingEnded = false
  var isPending: Bool
  var failed: Bool
  let onFinish: ([PracticeChoiceAnswer]) -> Void

  @State private var answers: [PracticeChoiceAnswer] = []
  @State private var draft: PracticeAnswer?
  @State private var shownAt = Date.now
  @State private var resumed = false

  var body: some View {
    let total = max(questions.count, upcomingTotal ?? 0)
    let index = answers.count
    let question = questions.indices.contains(index) ? questions[index] : nil

    PracticeTaskLayout(segments: segments(total: total, index: index), index: index) {
      if let question {
        HStack(alignment: .firstTextBaseline) {
          Text(hint(question)).font(.subheadline).foregroundStyle(.secondary)
          Spacer()
          Text(
            "\(min(index + 1, total)) of \(total)", tableName: "Practice",
            comment: "Where a test is: question n of total."
          )
          .font(.caption.monospacedDigit())
          .foregroundStyle(.secondary)
        }

        PracticeQuestionView(
          question: question, labels: labels, isLocked: isPending || failed, draft: $draft)
      } else if total > questions.count {
        ContentUnavailableView {
          Label {
            if upcomingEnded {
              Text(
                "Some questions couldn't be written", tableName: "Practice",
                comment: "A test's writing stopped short.")
            } else {
              Text(
                "Your next questions are on the way", tableName: "Practice",
                comment: "Waiting for a test's next questions.")
            }
          } icon: {
            Image(systemName: upcomingEnded ? "exclamationmark.triangle" : "hourglass")
          }
        } description: {
          if upcomingEnded {
            Text(
              "Finish with the answers you gave: they still choose where your plan goes deeper.",
              tableName: "Practice",
              comment:
                "A focus test can finish with the answers given when its writing stopped short.")
          } else {
            Text(
              "We're writing the rest of the test. It goes on here when they're ready.",
              tableName: "Practice",
              comment: "A test waits for the questions still being written.")
          }
        }
      }
    } actions: {
      if failed {
        PracticeSaveError { onFinish(answers) }
      }

      if question != nil {
        HStack(spacing: 12) {
          PracticeSecondaryButton(
            title: LocalizedStringResource(
              "I don't know yet", table: "Practice", comment: "Answers a question as not known yet."
            ),
            isDisabled: isPending || failed
          ) { answer(.dontKnow, total: total) }

          PracticeMainButton(
            title: index + 1 >= total
              ? LocalizedStringResource(
                "Finish", table: "Practice", comment: "Sends a test's answers to be graded.")
              : LocalizedStringResource(
                "Next", table: "Practice", comment: "Moves to a test's next question."),
            isBusy: isPending,
            isDisabled: draft == nil || failed
          ) {
            if let draft { answer(draft, total: total) }
          }
        }
      } else if upcomingEnded, !failed {
        PracticeMainButton(
          title: LocalizedStringResource(
            "Finish with these answers", table: "Practice",
            comment: "Finishes a test whose writing stopped short."),
          isBusy: isPending
        ) { onFinish(answers) }
      }
    }
    .onAppear(perform: resume)
  }

  private func segments(total: Int, index: Int) -> [PracticeSegment] {
    (0..<total).map { $0 < index ? .read : ($0 == index ? .current : .ahead) }
  }

  private func answer(_ choice: PracticeAnswer, total: Int) {
    guard let question = questions.indices.contains(answers.count) ? questions[answers.count] : nil
    else { return }

    let next =
      answers + [
        PracticeChoiceAnswer(
          answer: choice, durationMs: Int(Date.now.timeIntervalSince(shownAt) * 1000),
          itemId: question.itemId)
      ]
    PracticeAnswerDraft.write(next, key: draftKey)
    answers = next
    draft = nil
    shownAt = .now

    if next.count >= total {
      onFinish(next)
    }
  }

  /// Goes on from the device's draft: only answers to questions this test still asks, in order.
  private func resume() {
    guard !resumed else { return }
    resumed = true

    let ids = questions.map(\.itemId)
    let saved = PracticeAnswerDraft.read(key: draftKey)
    let resumable = Array(zip(saved, ids).prefix { $0.itemId == $1 }.map(\.0))

    if !resumable.isEmpty {
      answers = resumable
    }
  }
}

/// A run's answers kept on the device until graded, with the run's own request id, so a retry
/// after leaving sends the same test and it's counted once.
enum PracticeAnswerDraft {
  static func read(key: String) -> [PracticeChoiceAnswer] {
    guard let data = UserDefaults.standard.data(forKey: "practice.draft.\(key)") else { return [] }
    return (try? JSONDecoder().decode([PracticeChoiceAnswer].self, from: data)) ?? []
  }

  static func write(_ answers: [PracticeChoiceAnswer], key: String) {
    UserDefaults.standard.set(try? JSONEncoder().encode(answers), forKey: "practice.draft.\(key)")
  }

  static func requestId(key: String) -> String {
    let storageKey = "practice.request.\(key)"

    if let saved = UserDefaults.standard.string(forKey: storageKey) {
      return saved
    }

    let id = UUID().uuidString.lowercased()
    UserDefaults.standard.set(id, forKey: storageKey)
    return id
  }

  static func clear(key: String) {
    UserDefaults.standard.removeObject(forKey: "practice.draft.\(key)")
    UserDefaults.standard.removeObject(forKey: "practice.request.\(key)")
  }
}

/// Follows the run writing a test's questions until it ends, by its status: the test opens when
/// the run is done. Started only from the learner's tap.
enum PracticeGenerationWait {
  static func untilDone(api: PracticeAPI, token: String, generationId: String?) async throws {
    guard let generationId else { return }

    while try await api.generationIsRunning(token: token, generationId: generationId) {
      try await Task.sleep(for: .seconds(2))
    }
  }
}

/// A test with no questions yet: one tap asks for them (AI work only ever starts here), then the
/// screen follows the run until the test opens.
struct PracticeQuestionsPreparingView: View {
  let title: LocalizedStringResource
  let detail: LocalizedStringResource
  let writingDetail: LocalizedStringResource
  var facts: [String] = []
  let isWriting: Bool
  var failure: (any Error)?
  let start: () -> Void
  @Environment(\.practiceHooks) private var hooks

  var body: some View {
    PracticeTaskLayout {
      VStack(alignment: .leading, spacing: 12) {
        Text(
          isWriting
            ? LocalizedStringResource(
              "Getting your test ready", table: "Practice",
              comment: "Title while a test's questions are written.") : title
        )
        .font(.title2.bold())
        Text(isWriting ? writingDetail : detail).foregroundStyle(.secondary)

        if !isWriting {
          ForEach(facts, id: \.self) { fact in
            Text(fact).font(.subheadline.monospacedDigit()).foregroundStyle(.secondary)
          }
        }

        if isWriting {
          ProgressView().padding(.top, 8)
        }

        if let failure {
          Text(failureText(failure)).font(.subheadline).foregroundStyle(.destructive)
        }
      }
    } actions: {
      if failure as? PracticeAPIError == .plusRequired {
        PracticeMainButton(
          title: LocalizedStringResource(
            "See Plus", table: "Practice", comment: "Opens the Plus subscription.")
        ) {
          hooks.navigate(.subscription)
        }
      } else if !isWriting {
        PracticeMainButton(
          title: LocalizedStringResource(
            "Start the test", table: "Practice",
            comment: "Asks for a test's questions and starts it."),
          action: start)
      }
    }
  }

  private func failureText(_ failure: any Error) -> LocalizedStringResource {
    switch failure as? PracticeAPIError {
    case .plusRequired:
      LocalizedStringResource(
        "This test comes with Plus.", table: "Practice", comment: "A test that needs Plus.")
    case .limitReached:
      LocalizedStringResource(
        "You've used today's AI help. Try again tomorrow.", table: "Practice",
        comment: "A test's questions can't be written: the AI allowance is spent.")
    default:
      LocalizedStringResource(
        "We couldn't write your test. Try again.", table: "Practice",
        comment: "Writing a test's questions failed.")
    }
  }
}
