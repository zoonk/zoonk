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
  var line: LocalizedStringResource? {
    switch kind {
    case .reteach:
      isIdeaFirst
        ? LocalizedStringResource(
          "The idea first, then put it to use.", table: "Practice",
          comment: "How a content-gap drill goes, when it shows the lesson's ideas first.")
        : nil
    case .readCarefully, .retry:
      nil
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
    }
  }
}

/// What the drill asks until it's answered, or the lesson behind a content gap.
struct DrillNoteView: View {
  let drill: PracticeDrill
  var isAnswered = false

  var body: some View {
    if drill.kind == .reteach, let lesson = drill.lesson {
      LessonLinkButton(lessonId: lesson.id)
    } else if !isAnswered, let line = drill.line {
      PracticeCallout(systemImage: drill.kind.systemImage) {
        Text(line).typeWeight(.medium)
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
    .buttonStyle(.outline)
    .controlSize(.small)
  }
}

struct DrillIdeaView: View {
  let drill: PracticeDrill
  let lesson: PracticeDrill.Lesson

  var body: some View {
    VStack(alignment: .leading, spacing: 20) {
      VStack(alignment: .leading, spacing: 6) {
        Text(lesson.title).typeStyle(.section)
        if let line = drill.line {
          Text(line).foregroundStyle(.mutedForeground)
        }
      }

      VStack(alignment: .leading, spacing: 0) {
        ForEach(Array(lesson.ideas.enumerated()), id: \.offset) { index, idea in
          if index > 0 { Divider() }
          HStack(alignment: .firstTextBaseline, spacing: 12) {
            Text(index + 1, format: .number)
              .typeStyle(.data)
              .foregroundStyle(.faint)
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

/// Its task ends the question when the time runs out; key it by the question. It counts from
/// `start`, so drawing it again never adds time.
struct DrillCountdownView: View {
  /// VoiceOver hears the clock only at these marks: every second would talk over the question.
  private static let warnings = [10, 5]

  let seconds: Int
  let start: Date
  let onTimeUp: () -> Void

  var body: some View {
    let end = start.addingTimeInterval(TimeInterval(seconds))

    HStack(spacing: 12) {
      Image(systemName: "timer").foregroundStyle(.mutedForeground).accessibilityHidden(true)
      ProgressView(timerInterval: start...end, countsDown: true) {
        EmptyView()
      } currentValueLabel: {
        EmptyView()
      }
      Text(timerInterval: start...end, countsDown: true)
        .typeStyle(.body.weight(.medium).monospaced())
        .frame(minWidth: 44, alignment: .trailing)
        .accessibilityLabel(
          Text(
            "Time left", tableName: "Practice", comment: "VoiceOver label of a timed drill's clock."
          ))
    }
    .task {
      for mark in Self.warnings where end.timeIntervalSinceNow > TimeInterval(mark) {
        try? await Task.sleep(for: .seconds(end.timeIntervalSinceNow - TimeInterval(mark)))
        if Task.isCancelled { return }
        announcePolitely(
          String(
            localized: "\(mark) seconds left", table: "Practice",
            comment: "VoiceOver: a timed drill's clock is about to run out"))
      }

      try? await Task.sleep(for: .seconds(max(end.timeIntervalSinceNow, 0)))
      if !Task.isCancelled { onTimeUp() }
    }
  }
}

struct DrillAnswerNotes: View {
  static var timesUp: String {
    String(
      localized: "Time's up. It counts as a miss, so it comes back.", table: "Practice",
      comment: "After a timed drill's clock ran out.")
  }

  let drill: PracticeDrill?
  let notSure: Bool
  let timedOut: Bool
  let trap: String?

  var body: some View {
    if timedOut {
      QuestionNote(systemImage: "timer") {
        Text(Self.timesUp)
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
