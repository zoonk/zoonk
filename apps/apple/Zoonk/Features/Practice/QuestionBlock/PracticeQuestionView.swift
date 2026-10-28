import SwiftUI

/// A spread draws it in two parts: `stimulus` on the leading page and `response` on the trailing
/// one. In one column `stimulus` draws the question whole and `response` draws nothing.
struct PracticeQuestionView: View {
  enum Part {
    case whole
    case stimulus
    case response
  }

  let question: PracticeQuestion
  let labels: PracticeTrueFalseLabels
  let allowsBlank: Bool
  let result: PracticeItemResult?
  let isLocked: Bool
  /// The question before it shared its text, so a long one folds.
  let continuesSet: Bool
  /// A misread's drill shows the question before its answers.
  let hidesAnswers: Bool
  let askedIn: String?
  let recordingQuestions: (prompts: [String], current: Int)?
  let transcript: [PracticeTranscriptLine]?
  let served: ServedPlays?
  @Binding var draft: PracticeAnswer?
  let onSubmit: (PracticeAnswer) -> Void
  private var part = Part.whole

  @Environment(\.isPaneSplit) private var isPaneSplit

  init(
    question: PracticeQuestion, labels: PracticeTrueFalseLabels, allowsBlank: Bool = false,
    result: PracticeItemResult? = nil, isLocked: Bool = false, continuesSet: Bool = false,
    hidesAnswers: Bool = false, askedIn: String? = nil,
    recordingQuestions: (prompts: [String], current: Int)? = nil,
    transcript: [PracticeTranscriptLine]? = nil, served: ServedPlays? = nil,
    draft: Binding<PracticeAnswer?>, onSubmit: @escaping (PracticeAnswer) -> Void = { _ in }
  ) {
    self.question = question
    self.labels = labels
    self.allowsBlank = allowsBlank
    self.result = result
    self.isLocked = isLocked
    self.continuesSet = continuesSet
    self.hidesAnswers = hidesAnswers
    self.askedIn = askedIn
    self.recordingQuestions = recordingQuestions
    self.transcript = transcript
    self.served = served
    _draft = draft
    self.onSubmit = onSubmit
  }

  var stimulus: Self { drawing(.stimulus) }

  var response: Self { drawing(.response) }

  var body: some View {
    switch drawn {
    case .whole:
      VStack(alignment: .leading, spacing: 16) {
        stimulusContent
        responseContent
      }
    case .stimulus:
      // Wrapped only when there's something to read, so an empty part takes no spacing.
      if hasStimulus {
        VStack(alignment: .leading, spacing: 16) {
          stimulusContent
        }
      }
    case .response:
      responseContent
    case nil:
      EmptyView()
    }
  }

  private var drawn: Part? {
    switch part {
    case .whole: .whole
    case .stimulus: isPaneSplit ? .stimulus : .whole
    case .response: isPaneSplit ? .response : nil
    }
  }

  private var showsTitle: Bool {
    question.format != .trueFalse || hidesAnswers
  }

  private var statementLeads: Bool {
    drawn != .whole && question.format == .trueFalse && !hidesAnswers
  }

  private var showsStatementCard: Bool {
    drawn == .stimulus && statementLeads
  }

  private var hasStimulus: Bool {
    question.placement || (question.quoted && question.citation != nil) || question.set != nil
      || question.context != nil || question.image != nil || question.visual != nil || showsTitle
      || showsStatementCard
  }

  @ViewBuilder private var stimulusContent: some View {
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
        recordingQuestions: recordingQuestions, transcript: transcript, served: served)
    }

    ItemSupportView(context: question.context, image: question.image, visual: question.visual)

    if showsTitle {
      QuestionTitle(text: question.question, isMuted: result != nil)
    }

    if showsStatementCard {
      TrueFalseStatementCard(
        statement: question.question, result: result, isLocked: isLocked || result != nil,
        draft: $draft
      )
      .id(question.id)
    }
  }

  @ViewBuilder private var responseContent: some View {
    if !hidesAnswers {
      PracticeItemView(
        question: question, labels: labels, allowsBlank: allowsBlank, result: result,
        isLocked: isLocked, showsStatement: !statementLeads, draft: $draft, onSubmit: onSubmit
      )
      .id(question.id)
    }
  }

  private func drawing(_ part: Part) -> Self {
    var copy = self
    copy.part = part
    return copy
  }
}

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

/// A blank where a wrong answer costs a point is neither, never pink; the learner's own "I don't know
/// yet" is never called "Not quite".
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
    case .right: .success
    case .wrong: .destructive
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

/// Choice and true-or-false questions mark the right option instead, so they need no line.
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
