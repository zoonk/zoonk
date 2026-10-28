import SwiftUI

/// One question as every practice screen asks it: what it's for (a placement question, a past
/// exam's source), what it's read with (its set's text, case, chart or recording, then its own
/// context, picture or chart), the question itself, and its answer control. A statement is the
/// card its true-or-false control draws, so it has no title of its own.
struct PracticeQuestionView: View {
  let question: PracticeQuestion
  let labels: PracticeTrueFalseLabels
  var allowsBlank = false
  var result: PracticeItemResult?
  var isLocked = false
  /// The question before it shared its text, so a long one folds.
  var continuesSet = false
  /// A misread's drill shows the question before its answers.
  var hidesAnswers = false
  var askedIn: String?
  var recordingQuestions: (prompts: [String], current: Int)?
  var transcript: [PracticeTranscriptLine]?
  @Binding var draft: PracticeAnswer?
  var onSubmit: (PracticeAnswer) -> Void = { _ in }

  var body: some View {
    VStack(alignment: .leading, spacing: 16) {
      if question.placement {
        QuestionNote(systemImage: "safari") {
          Text(
            "Fine-tuning your plan. A miss here is never saved as a mistake.",
            tableName: "Practice",
            comment: "Note above a placement question in the first week's sessions.")
        }
      }

      if question.quoted, let citation = question.citation {
        QuestionNote(systemImage: "scroll") {
          Text(
            "Past exam question · \(citation.text)", tableName: "Practice",
            comment: "Source of a real past exam question shown with it.")
        }
      }

      if let set = question.set {
        ItemSetStimulusView(
          set: set, continued: continuesSet, askedIn: askedIn,
          recordingQuestions: recordingQuestions, transcript: transcript)
      }

      ItemSupportView(context: question.context, image: question.image, visual: question.visual)

      if question.format != .trueFalse || hidesAnswers {
        QuestionTitle(text: question.question, isMuted: result != nil)
      }

      if !hidesAnswers {
        PracticeItemView(
          question: question, labels: labels, allowsBlank: allowsBlank, result: result,
          isLocked: isLocked, draft: $draft, onSubmit: onSubmit
        )
        .id(question.id)
      }
    }
  }
}

/// The question itself, the loudest line while the learner answers; once graded it steps back.
struct QuestionTitle: View {
  let text: String
  var isMuted = false

  var body: some View {
    ItemText(text)
      .font(.title3.weight(.semibold))
      .foregroundStyle(isMuted ? .secondary : .primary)
      .accessibilityAddTraits(.isHeader)
  }
}

/// A quiet line with its mark, above or under a question.
struct QuestionNote<Content: View>: View {
  let systemImage: String
  @ViewBuilder let content: () -> Content

  var body: some View {
    Label {
      content()
    } icon: {
      Image(systemName: systemImage)
    }
    .font(.footnote.weight(.medium))
    .foregroundStyle(.secondary)
  }
}

/// A soft box with its mark: the time machine's line, a drill's rule, a pause suggestion.
struct PracticeCallout<Content: View>: View {
  let systemImage: String
  @ViewBuilder let content: () -> Content

  var body: some View {
    HStack(alignment: .firstTextBaseline, spacing: 10) {
      Image(systemName: systemImage)
        .foregroundStyle(.secondary)
        .accessibilityHidden(true)
      VStack(alignment: .leading, spacing: 4) {
        content()
      }
      .frame(maxWidth: .infinity, alignment: .leading)
    }
    .font(.subheadline)
    .padding(12)
    .background(
      Color(.secondarySystemGroupedBackground),
      in: RoundedRectangle(cornerRadius: 12, style: .continuous))
  }
}

// MARK: - Feedback

/// The verdict's words and tone: right, wrong, left blank where a wrong answer costs a point
/// (neither, never pink), or the learner's own "I don't know yet", never called "Not quite".
enum PracticeVerdict: Equatable {
  case blank
  case notSure
  case right
  case wrong

  init(isCorrect: Bool, blank: Bool = false, notSure: Bool = false) {
    if isCorrect {
      self = .right
    } else if blank {
      self = .blank
    } else if notSure {
      self = .notSure
    } else {
      self = .wrong
    }
  }

  var label: LocalizedStringResource {
    switch self {
    case .right:
      LocalizedStringResource(
        "Correct!", table: "Practice", comment: "Verdict after a right answer.")
    case .wrong:
      LocalizedStringResource(
        "Not quite", table: "Practice", comment: "Verdict after a wrong answer.")
    case .blank:
      LocalizedStringResource(
        "Left blank", table: "Practice",
        comment: "Verdict after leaving a net-scored statement blank.")
    case .notSure:
      LocalizedStringResource(
        "I don't know yet", table: "Practice",
        comment: "Verdict after the learner said they don't know.")
    }
  }

  var tint: Color {
    switch self {
    case .right: .blue
    case .wrong: .pink
    case .blank, .notSure: .secondary
    }
  }

  var systemImage: String {
    switch self {
    case .right: "checkmark.circle.fill"
    case .wrong: "xmark.circle.fill"
    case .blank, .notSure: "minus.circle.fill"
    }
  }
}

/// The grade after an answer on a quiet panel: the verdict (with the streak from three right in a
/// row), the right answer where the question doesn't mark it, why, how to solve it, the passage it
/// quotes, the host's notes (a drill's, the time machine's), and last whether a mistake moved.
struct PracticeFeedbackPanel<Notes: View>: View {
  let verdict: PracticeVerdict
  var streak = 0
  var correctAnswerText: String?
  var explanation: String?
  var workedSteps: [String] = []
  var citation: PracticeCitation?
  @ViewBuilder var notes: () -> Notes

  var body: some View {
    VStack(alignment: .leading, spacing: 10) {
      HStack(alignment: .firstTextBaseline) {
        Label {
          Text(verdict.label)
        } icon: {
          Image(systemName: verdict.systemImage)
        }
        .font(.headline)
        .foregroundStyle(verdict.tint)

        Spacer()

        if streak >= 3 {
          Label {
            Text(
              "\(streak) right in a row", tableName: "Practice",
              comment: "Hyperdrive's quiet mark beside a right answer's verdict.")
          } icon: {
            Image(systemName: "chevron.up.2")
          }
          .font(.footnote.monospacedDigit())
          .foregroundStyle(.secondary)
        }
      }

      if let correctAnswerText {
        Text(
          "Right answer: \(correctAnswerText)", tableName: "Practice",
          comment: "The right answer in words, under a wrong answer's verdict.")
      }

      if let explanation {
        ItemText(explanation)
      }

      if !workedSteps.isEmpty {
        WorkedStepsView(steps: workedSteps)
      }

      if let citation {
        CitationNote(citation: citation)
      }

      notes()
    }
    .font(.callout)
    .padding(16)
    .frame(maxWidth: .infinity, alignment: .leading)
    .background(
      Color(.secondarySystemGroupedBackground),
      in: RoundedRectangle(cornerRadius: 16, style: .continuous)
    )
    .accessibilityElement(children: .contain)
    .accessibilityLabel(
      Text(
        "Answer feedback", tableName: "Practice", comment: "VoiceOver name of the feedback panel."))
  }
}

extension PracticeFeedbackPanel where Notes == EmptyView {
  init(
    verdict: PracticeVerdict, streak: Int = 0, correctAnswerText: String? = nil,
    explanation: String? = nil, workedSteps: [String] = [], citation: PracticeCitation? = nil
  ) {
    self.init(
      verdict: verdict, streak: streak, correctAnswerText: correctAnswerText,
      explanation: explanation, workedSteps: workedSteps, citation: citation, notes: { EmptyView() }
    )
  }
}

/// How to solve a math problem with the numbers the learner saw, the result last and strongest.
struct WorkedStepsView: View {
  let steps: [String]

  var body: some View {
    VStack(alignment: .leading, spacing: 4) {
      ForEach(Array(steps.enumerated()), id: \.offset) { index, step in
        Text(ItemTextBlock.inline(step))
          .font(.callout.monospaced())
          .fontWeight(index == steps.count - 1 ? .semibold : .regular)
          .foregroundStyle(index == steps.count - 1 ? .primary : .secondary)
      }
    }
    .accessibilityElement(children: .combine)
    .accessibilityLabel(
      Text(
        "How to solve it", tableName: "Practice",
        comment: "VoiceOver name of a math problem's worked steps."))
  }
}

/// The passage a question quotes with its dated source, linked when it's online.
struct CitationNote: View {
  let citation: PracticeCitation

  var body: some View {
    VStack(alignment: .leading, spacing: 2) {
      if let url = citation.url.flatMap(URL.init(string:)) {
        Link(destination: url) {
          Text(citation.title ?? citation.text)
        }
      } else {
        Text(citation.title ?? citation.text)
      }

      if let checkedAt = citation.checkedAt {
        Text(
          "Checked \(checkedAt.formatted(.dateTime.month(.abbreviated).year()))",
          tableName: "Practice",
          comment: "When a quoted source was last found current.")
      }
    }
    .font(.caption)
    .foregroundStyle(.secondary)
  }
}

/// The right answer in words, from the grade's answer shape: a math answer with its unit, a
/// statement's in the goal's exam's words. Choice and true-or-false questions mark the right option
/// instead, so they need no line.
enum PracticeAnswerText {
  static func correctLine(
    feedbackIsCorrect: Bool, correctAnswer: PracticeAnswer?, question: PracticeQuestion,
    labels: PracticeTrueFalseLabels
  ) -> String? {
    guard !feedbackIsCorrect, question.format != .multipleChoice, question.format != .trueFalse,
      let correctAnswer
    else { return nil }

    return text(for: correctAnswer, question: question, labels: labels)
  }

  static func text(
    for answer: PracticeAnswer, question: PracticeQuestion, labels: PracticeTrueFalseLabels
  )
    -> String?
  {
    func option(_ index: Int) -> String {
      question.options.indices.contains(index) ? ItemTextBlock.plain(question.options[index]) : ""
    }

    switch answer {
    case .choice(let index):
      return question.options.indices.contains(index) ? option(index) : nil
    case .choices(let indexes):
      return indexes.map(option).joined(separator: "; ")
    case .order(let indexes):
      return indexes.map(option).joined(separator: " → ")
    case .text(let text):
      return text
    case .trueFalse(let isTrue):
      return String(localized: TrueFalseWords.label(isTrue: isTrue, labels: labels))
    case .matches(let matches):
      return question.left.enumerated().map { index, entry in
        let match =
          matches.indices.contains(index) && question.right.indices.contains(matches[index])
          ? question.right[matches[index]] : ""
        return "\(ItemTextBlock.plain(entry)) → \(ItemTextBlock.plain(match))"
      }
      .joined(separator: "; ")
    case .number(let number):
      let value = number.formatted(.number)
      guard let unit = question.unit else { return value }
      return unit.position == .prefix ? "\(unit.symbol) \(value)" : "\(value) \(unit.symbol)"
    case .dontKnow:
      return nil
    }
  }
}
