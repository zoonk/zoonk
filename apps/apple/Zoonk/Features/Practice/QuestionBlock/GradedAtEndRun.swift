import SwiftUI

/// Each answer is kept on the device as it's given (`draftKey`), so leaving and coming back goes on
/// from the next question until the host clears it once the answers are graded.
struct GradedAtEndRun: View {
  let questions: [PracticeQuestion]
  let labels: PracticeTrueFalseLabels
  let draftKey: String
  var hint: (PracticeQuestion) -> String = { _ in "" }
  /// How many questions the run asks in all, the ones still being written included.
  var upcomingTotal: Int?
  /// The writing stopped short: the learner can finish with the answers given.
  var upcomingEnded = false
  var upcomingLimit: HelpLimit?
  var isPending: Bool
  var failed: Bool
  let onFinish: ([PracticeChoiceAnswer]) -> Void

  @State private var answers: [PracticeChoiceAnswer] = []
  @State private var draft: PracticeAnswer?
  @State private var sentBy: AnswerSender?
  @State private var shownAt = Date.now
  @State private var resumed = false

  var body: some View {
    let total = max(questions.count, upcomingTotal ?? 0)
    let index = answers.count
    let shown = sentBy == nil ? index : index - 1
    let question = questions.indices.contains(shown) ? questions[shown] : nil
    let locked = isPending || failed || sentBy != nil

    PracticeTaskLayout(segments: segments(total: total, index: index), index: index) {
      if let question {
        HStack(alignment: .firstTextBaseline) {
          Text(hint(question)).typeStyle(.note).foregroundStyle(.mutedForeground)
          Spacer()
          Text(
            "\(shown + 1) of \(total)", tableName: "Practice",
            comment: "Where a test is: question n of total."
          )
          .typeStyle(.data)
          .foregroundStyle(.mutedForeground)
        }

        asked(question, isLocked: locked).stimulus
      } else if GradedRunStage(answered: index, asked: questions.count, total: total)
        == .readyToSubmit
      {
        VStack(alignment: .leading, spacing: 8) {
          Text(
            "Every question is answered", tableName: "Practice",
            comment: "Title of a test whose answers are all in, before they're graded."
          )
          .typeStyle(.section)
          Text(
            "Finish to see how it went.", tableName: "Practice",
            comment: "Under the title of a block opened again with every answer in."
          )
          .foregroundStyle(.mutedForeground)
        }
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
        .lonePage()
      }
    } response: {
      if let question {
        asked(question, isLocked: locked).response
      }
    } actions: {
      if failed {
        PracticeSaveError { onFinish(answers) }
      }

      if question != nil {
        PracticeActionRow {
          PracticeSecondaryButton(
            title: LocalizedStringResource(
              "I don't know yet", table: "Practice", comment: "Answers a question as not known yet."
            ),
            icon: .notSure, isBusy: isPending && sentBy == .notSure,
            isDisabled: locked
          ) { answer(.dontKnow, by: .notSure, total: total) }

          PracticeMainButton(
            title: index + 1 >= total
              ? LocalizedStringResource(
                "Finish", table: "Practice", comment: "Sends a test's answers to be graded.")
              : LocalizedStringResource(
                "Next", table: "Practice", comment: "Moves to a test's next question."),
            icon: .forward, isBusy: isPending && sentBy == .check,
            isDisabled: draft?.complete == nil || locked
          ) {
            if let picked = draft?.complete { answer(picked, by: .check, total: total) }
          }
        }
      } else if GradedRunStage(answered: index, asked: questions.count, total: total)
        == .readyToSubmit,
        !failed
      {
        // Answers kept on the device from a send that didn't go through: they go as the same test.
        PracticeMainButton(
          title: LocalizedStringResource(
            "Finish", table: "Practice", comment: "Sends a test's answers to be graded."),
          icon: .forward, isBusy: isPending
        ) { onFinish(answers) }
      } else if upcomingEnded, !failed {
        if let upcomingLimit {
          HelpLimitNotice(limit: upcomingLimit)
            .frame(maxWidth: .infinity, alignment: .leading)
        }

        PracticeMainButton(
          title: LocalizedStringResource(
            "Finish with these answers", table: "Practice",
            comment: "Finishes a test whose writing stopped short."),
          icon: .forward, isBusy: isPending
        ) { onFinish(answers) }
      }
    }
    .onAppear(perform: resume)
  }

  private func asked(_ question: PracticeQuestion, isLocked: Bool) -> PracticeQuestionView {
    PracticeQuestionView(question: question, labels: labels, isLocked: isLocked, draft: $draft)
  }

  private func segments(total: Int, index: Int) -> [TaskSegment] {
    (0..<total).map { $0 < index ? .read : ($0 == index ? .current : .ahead) }
  }

  private func answer(_ choice: PracticeAnswer, by sender: AnswerSender, total: Int) {
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

    if next.count >= total {
      sentBy = sender
      onFinish(next)
    } else {
      draft = nil
      shownAt = .now
    }
  }

  private func resume() {
    guard !resumed else { return }
    resumed = true

    let resumable = PracticeAnswerDraft.resume(
      key: draftKey, questionIds: questions.map(\.itemId))

    if !resumable.isEmpty {
      answers = resumable
    }
  }
}

enum GradedRunStage: Equatable {
  case asking
  case readyToSubmit
  case waiting

  init(answered: Int, asked: Int, total: Int) {
    if answered < asked {
      self = .asking
    } else if answered >= total, total > 0 {
      self = .readyToSubmit
    } else {
      self = .waiting
    }
  }
}

/// Kept with the run's own request id, so a retry after leaving sends the same test and it's counted
/// once.
enum PracticeAnswerDraft {
  static func read(key: String) -> [PracticeChoiceAnswer] {
    guard let data = UserDefaults.standard.data(forKey: "practice.draft.\(key)") else { return [] }
    return (try? JSONDecoder().decode([PracticeChoiceAnswer].self, from: data)) ?? []
  }

  static func write(_ answers: [PracticeChoiceAnswer], key: String) {
    UserDefaults.standard.set(try? JSONEncoder().encode(answers), forKey: "practice.draft.\(key)")
  }

  static func resumable(_ saved: [PracticeChoiceAnswer], questionIds: [String])
    -> [PracticeChoiceAnswer]
  {
    Array(zip(saved, questionIds).prefix { $0.itemId == $1 }.map(\.0))
  }

  /// Only answers to questions this test still asks, in order. A draft with none left goes with its
  /// request id: that test may already have its grade on the server, so the next one is new.
  static func resume(key: String, questionIds: [String]) -> [PracticeChoiceAnswer] {
    let kept = resumable(read(key: key), questionIds: questionIds)

    if kept.isEmpty {
      clear(key: key)
    }

    return kept
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

/// One tap asks for the questions: AI work only ever starts here.
struct PracticeQuestionsPreparingView: View {
  let title: LocalizedStringResource
  let detail: LocalizedStringResource
  let writingDetail: LocalizedStringResource
  var facts: [String] = []
  let isStarting: Bool
  let isWriting: Bool
  var failure: (any Error)?
  let start: () -> Void
  @Environment(\.practiceHooks) private var hooks
  @AccessibilityFocusState private var focus: Focus?

  private enum Focus { case notice, start, title }

  var body: some View {
    PracticeTaskLayout {
      VStack(alignment: .leading, spacing: 12) {
        Text(
          isWriting
            ? LocalizedStringResource(
              "Getting your test ready", table: "Practice",
              comment: "Title while a test's questions are written.") : title
        )
        .typeStyle(.section)
        .accessibilityFocused($focus, equals: .title)
        Text(isWriting ? writingDetail : detail).foregroundStyle(.mutedForeground)

        if !isWriting {
          ForEach(facts, id: \.self) { fact in
            Text(fact).typeStyle(.data).foregroundStyle(.mutedForeground)
          }
        }

        if isWriting {
          ProgressView().padding(.top, 8)
        }

        if isPlusRequired {
          FreeWeekOverNotice(showsSeePlus: false)
            .accessibilityElement(children: .combine)
            .accessibilityFocused($focus, equals: .notice)
        } else if failure != nil, limit == nil {
          FailureLine(
            message: LocalizedStringResource(
              "We couldn't write your test. Try again.", table: "Practice",
              comment: "Writing a test's questions failed.")
          )
          .typeStyle(.body)
        }
      }
    } actions: {
      if isPlusRequired {
        PracticeMainButton(
          title: LocalizedStringResource(
            "See Plus", table: "Practice",
            comment: "Opens the Zoonk Plus subscription; Plus is its name, not \"more\"."),
          icon: .forward
        ) {
          hooks.navigate(.subscription)
        }
      } else {
        if let limit {
          HelpLimitNotice(limit: limit)
            .frame(maxWidth: .infinity, alignment: .leading)
            .accessibilityElement(children: .combine)
            .accessibilityFocused($focus, equals: .notice)
        }

        if !isWriting, limit?.isShortBreak ?? true {
          PracticeMainButton(
            title: LocalizedStringResource(
              "Start the test", table: "Practice",
              comment: "Asks for a test's questions and starts it."),
            icon: .play, isBusy: isStarting, action: start
          )
          .accessibilityFocused($focus, equals: .start)
        }
      }
    }
    // Only the learner's tap starts the wait or sets a failure, so focus never moves on opening.
    .onChange(of: isWriting) { _, isWriting in
      if isWriting {
        focus = .title
      }
    }
    .onChange(of: failure as? PracticeAPIError) { _, refusal in
      guard refusal != nil else { return }

      // A failure line reads itself out beside the Start that comes back. A notice doesn't: beside
      // Start (a short break) it's read out; in Start's place (a limit, or Plus) it takes focus.
      if let limit, limit.isShortBreak {
        announcePolitely(limit.message)
      } else if limit != nil || isPlusRequired {
        focus = .notice
      }
    }
  }

  private var isPlusRequired: Bool {
    failure as? PracticeAPIError == .plusRequired
  }

  private var limit: HelpLimit? {
    (failure as? PracticeAPIError)?.helpLimit
  }
}
