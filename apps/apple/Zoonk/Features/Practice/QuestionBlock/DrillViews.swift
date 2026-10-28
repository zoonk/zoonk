import SwiftUI

extension PracticeDrill.Kind {
  /// Each drill's rule has its own mark, the same one its mistake's cause wears in the notebook.
  var systemImage: String {
    switch self {
    case .noGuessing: "hand.raised"
    case .readCarefully: "eye"
    case .reteach: "lightbulb"
    case .retry: "arrow.counterclockwise"
    case .spotTheTrap: "exclamationmark.triangle"
    case .timed: "timer"
    }
  }
}

extension PracticeDrill {
  /// Each cause gets its own practice, said in one line before its questions.
  var line: LocalizedStringResource {
    switch kind {
    case .reteach:
      isIdeaFirst
        ? LocalizedStringResource(
          "The idea first, then a few questions on it.", table: "Practice",
          comment: "How a content-gap drill goes, when it shows the lesson's ideas first.")
        : LocalizedStringResource(
          "A few questions on an idea you missed.", table: "Practice",
          comment: "How a content-gap drill goes, without ideas to show.")
    case .readCarefully:
      LocalizedStringResource(
        "Read every word before you answer.", table: "Practice",
        comment: "How a misread drill goes.")
    case .spotTheTrap:
      LocalizedStringResource(
        "There's a trap in here. Find it before you answer.", table: "Practice",
        comment: "How a trap drill goes.")
    case .timed:
      LocalizedStringResource(
        "\(timeLimitSeconds ?? 0) seconds a question, like on the day.", table: "Practice",
        comment: "How a timed drill goes.")
    case .noGuessing:
      LocalizedStringResource(
        "Only answer when you're sure. Saying you're not sure is fine.", table: "Practice",
        comment: "How a no-guessing drill goes.")
    case .retry:
      LocalizedStringResource(
        "Try it again.", table: "Practice", comment: "How a plain retry drill goes.")
    }
  }
}

/// How a mistake's drill works, as a note above its question: its rule with its mark, and the
/// learner's last answer when the host has it. A content gap without ideas links its lesson.
/// Once graded only the last answer and the lesson stay.
struct DrillNoteView: View {
  let drill: PracticeDrill
  var lastAnswer: String?
  var isAnswered = false
  @Environment(\.practiceHooks) private var hooks

  var body: some View {
    let lesson = drill.kind == .reteach ? drill.lesson : nil

    if !(drill.kind == .retry && lastAnswer == nil)
      && !(isAnswered && lastAnswer == nil && lesson == nil)
    {
      PracticeCallout(systemImage: drill.kind.systemImage) {
        if !isAnswered {
          Text(drill.line).fontWeight(.medium)
        }

        if let lastAnswer {
          Text(
            "Last time you answered: \(lastAnswer)", tableName: "Practice",
            comment: "A mistake drill's note: what the learner answered when they got it wrong."
          )
          .foregroundStyle(.secondary)
        }

        if let lesson {
          LessonLinkButton(lessonId: lesson.id)
        }
      }
    }
  }
}

/// The whole lesson a tap away; the drill waits where it is.
struct LessonLinkButton: View {
  let lessonId: String
  @Environment(\.practiceHooks) private var hooks

  var body: some View {
    Button {
      hooks.navigate(.lesson(lessonId: lessonId))
    } label: {
      Label {
        Text(
          "Go over the lesson", tableName: "Practice",
          comment: "Opens the lesson a content-gap drill is about.")
      } icon: {
        Image(systemName: "book")
      }
    }
    .buttonStyle(.bordered)
    .controlSize(.small)
  }
}

/// A content gap's idea before its questions, on a screen of its own: the lesson's name, what the
/// drill is for, its ideas as one numbered list, and the lesson a tap away.
struct DrillIdeaView: View {
  let drill: PracticeDrill
  let lesson: PracticeDrill.Lesson

  var body: some View {
    VStack(alignment: .leading, spacing: 20) {
      VStack(alignment: .leading, spacing: 6) {
        Text(lesson.title).font(.title2.bold())
        Text(drill.line).foregroundStyle(.secondary)
      }

      VStack(alignment: .leading, spacing: 0) {
        ForEach(Array(lesson.ideas.enumerated()), id: \.offset) { index, idea in
          if index > 0 { Divider() }
          HStack(alignment: .firstTextBaseline, spacing: 12) {
            Text(index + 1, format: .number)
              .font(.subheadline.monospacedDigit())
              .foregroundStyle(.tertiary)
            Text(idea)
          }
          .padding(.vertical, 10)
          .accessibilityElement(children: .combine)
        }
      }

      LessonLinkButton(lessonId: lesson.id)
    }
  }
}

/// A timed drill's clock for one question: the seconds left and a bar that empties. Its task
/// ends the question when the time runs out; key it by the question so each gets the whole time.
struct DrillCountdownView: View {
  let seconds: Int
  let onTimeUp: () -> Void
  @State private var start = Date.now

  var body: some View {
    let end = start.addingTimeInterval(TimeInterval(seconds))

    HStack(spacing: 12) {
      Image(systemName: "timer").foregroundStyle(.secondary).accessibilityHidden(true)
      ProgressView(timerInterval: start...end, countsDown: true) {
        EmptyView()
      } currentValueLabel: {
        EmptyView()
      }
      Text(timerInterval: start...end, countsDown: true)
        .font(.subheadline.monospacedDigit().weight(.medium))
        .frame(minWidth: 44, alignment: .trailing)
        .accessibilityLabel(
          Text(
            "Time left", tableName: "Practice", comment: "VoiceOver label of a timed drill's clock."
          ))
    }
    .task {
      try? await Task.sleep(for: .seconds(seconds))
      if !Task.isCancelled { onTimeUp() }
    }
  }
}

/// What a drill adds after an answer: time running out, an honest "not sure", the trap it set.
struct DrillAnswerNotes: View {
  let drill: PracticeDrill?
  let notSure: Bool
  let timedOut: Bool
  let trap: String?

  var body: some View {
    if timedOut {
      QuestionNote(systemImage: "timer") {
        Text(
          "Time's up. It counts as a miss, so it comes back.", tableName: "Practice",
          comment: "After a timed drill's clock ran out.")
      }
    }

    if notSure, drill?.kind == .noGuessing {
      QuestionNote(systemImage: "hand.raised") {
        Text(
          "Good call. Saying you're not sure beats a guess.", tableName: "Practice",
          comment: "After saying 'I'm not sure' in a no-guessing drill.")
      }
    }

    if let trap {
      QuestionNote(systemImage: "exclamationmark.triangle") {
        Text(
          "The trap: \(trap)", tableName: "Practice",
          comment: "The misconception a trap drill's wrong answer fell for.")
      }
    }
  }
}

/// When the learner last met a question: before the answer only when they saw it; after it, the
/// earlier wrong answer quoted, or why a question they got right came back.
enum TimeMachineText {
  static func line(
    _ machine: PracticeTimeMachine, result: AnswerOptionResult?, format: PracticeItemFormat,
    labels: PracticeTrueFalseLabels
  ) -> LocalizedStringResource {
    let date = machine.answeredAt.formatted(.dateTime.day().month(.wide))

    guard let result else {
      return LocalizedStringResource(
        "You saw this on \(date).", table: "Practice",
        comment: "Time machine line above a question seen before.")
    }

    if machine.isCorrect {
      return result == .right
        ? LocalizedStringResource(
          "Right again, like on \(date).", table: "Practice",
          comment: "Time machine note: right today and the last time.")
        : LocalizedStringResource(
          "You got it right on \(date). Reviewing it now helps it stick.", table: "Practice",
          comment: "Time machine note: right last time, wrong today.")
    }

    let saved =
      format == .trueFalse
      ? TrueFalseWords.savedAnswer(machine.answer, labels: labels)
      : machine.answer.map(ItemTextBlock.plain)

    if let saved, !saved.isEmpty {
      let answer = saved.replacingOccurrences(of: #"\.+$"#, with: "", options: .regularExpression)
      return LocalizedStringResource(
        "On \(date) you answered “\(answer)”.", table: "Practice",
        comment: "Time machine note: the learner's earlier wrong answer, quoted.")
    }

    return LocalizedStringResource(
      "On \(date) this one tripped you up.", table: "Practice",
      comment: "Time machine note: wrong last time, without the answer's text.")
  }
}
