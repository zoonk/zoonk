import SwiftUI

/// A checkpoint keeps the right answer until the duel ends.
struct PracticeItemResult: Equatable {
  let answer: PracticeAnswer
  let correctAnswer: PracticeAnswer?
  let isCorrect: Bool

  /// An option's mark: the right answer when the grade says it, and the learner's wrong pick. A
  /// checkpoint keeps the right answer until it ends, so then only the pick is marked, by its
  /// verdict, and no other option gives the answer away.
  func optionMark(isRightAnswer: Bool, isPicked: Bool) -> AnswerOptionResult? {
    guard correctAnswer != nil else {
      return isPicked ? (isCorrect ? .right : .wrong) : nil
    }

    if isRightAnswer { return .right }
    return isPicked ? .wrong : nil
  }

  /// A typed or numeric answer's mark. "I don't know yet" leaves the field empty: nothing to mark.
  var mark: AnswerOptionResult? {
    answer.isDontKnow ? nil : (isCorrect ? .right : .wrong)
  }
}

/// It shows the answer the draft holds, so the control drawn again (folding or unfolding iPhone Duo,
/// going back to a question) keeps it; only work that isn't an answer yet, like a pair half matched,
/// stays with the control. Give it `.id(question.id)` so every question starts fresh.
struct PracticeItemView: View {
  let question: PracticeQuestion
  let labels: PracticeTrueFalseLabels
  /// Net-scored statements add "Leave blank", since a wrong answer cancels a right one.
  var allowsBlank = false
  var result: PracticeItemResult?
  var isLocked = false
  var showsStatement = true
  @Binding var draft: PracticeAnswer?
  var onSubmit: (PracticeAnswer) -> Void = { _ in }

  var body: some View {
    let locked = isLocked || result != nil

    switch question.format {
    case .multipleChoice:
      ChoiceItemView(
        options: question.options, select: question.select, result: result, isLocked: locked,
        draft: $draft)
    case .trueFalse:
      TrueFalseItemView(
        statement: question.question, labels: labels, allowsBlank: allowsBlank,
        showsStatement: showsStatement, result: result, isLocked: locked, draft: $draft)
    case .matchPairs:
      MatchPairsItemView(
        left: question.left, right: question.right, isLocked: locked, draft: $draft)
    case .order:
      OrderItemView(steps: question.options, result: result, isLocked: locked, draft: $draft)
    case .numeric:
      NumericItemView(
        entry: question.entry, unit: question.unit, mark: result?.mark, isLocked: locked,
        draft: $draft, onSubmit: onSubmit)
    case .typed:
      TypedItemView(mark: result?.mark, isLocked: locked, draft: $draft, onSubmit: onSubmit)
    }
  }
}

/// Once graded, only the picks and the right answers stay, so the feedback fits under them; a grade
/// that doesn't say the right option keeps them all.
struct ChoiceItemView: View {
  let options: [String]
  let select: PracticeSelect
  let result: PracticeItemResult?
  let isLocked: Bool
  @Binding var draft: PracticeAnswer?

  var body: some View {
    let correct = result?.correctAnswer?.picks ?? []
    let shownPicks = result?.answer.picks ?? picks

    VStack(alignment: .leading, spacing: 10) {
      if select.isMulti {
        PickRule(select: select)
      }

      ForEach(Array(options.enumerated()), id: \.offset) { index, option in
        if result == nil || correct.isEmpty || correct.contains(index) || shownPicks.contains(index)
        {
          AnswerOption(
            marker: index + 1,
            isPicked: shownPicks.contains(index),
            result: optionResult(index, correct: correct, picked: shownPicks),
            isLocked: isLocked,
            action: { pick(index) },
            label: { Text(ItemTextBlock.inline(option)) })
        }
      }
    }
  }

  private func optionResult(_ index: Int, correct: [Int], picked: [Int]) -> AnswerOptionResult? {
    result?.optionMark(isRightAnswer: correct.contains(index), isPicked: picked.contains(index))
  }

  private var picks: [Int] {
    if case .partial(let picked) = draft {
      return picked.compactMap(\.self)
    }

    return draft?.picks ?? []
  }

  private func pick(_ index: Int) {
    if select.isMulti {
      let next = picks.contains(index) ? picks.filter { $0 != index } : picks + [index]

      draft =
        if select.isComplete(next) {
          .choices(next)
        } else {
          next.isEmpty ? nil : .partial(next)
        }

      return
    }

    draft = picks.first == index ? nil : .choice(index)
  }
}

struct PickRule: View {
  let select: PracticeSelect

  var body: some View {
    Group {
      switch select {
      case .all:
        Text(
          "Select all that apply.", tableName: "Practice",
          comment: "Rule above a multiple-choice question where every right option must be picked.")
      case .count(let count):
        Text(
          "Choose \(count) options.", tableName: "Practice",
          comment: "Rule above a multiple-choice question asking for an exact number of options.")
      }
    }
    .font(.subheadline.weight(.medium))
    .foregroundStyle(.secondary)
  }
}

struct TrueFalseItemView: View {
  let statement: String
  let labels: PracticeTrueFalseLabels
  let allowsBlank: Bool
  var showsStatement = true
  let result: PracticeItemResult?
  let isLocked: Bool
  @Binding var draft: PracticeAnswer?

  var body: some View {
    let shownPick = result?.answer ?? draft
    let answers: [PracticeAnswer] =
      allowsBlank
      ? [.trueFalse(false), .dontKnow, .trueFalse(true)] : [.trueFalse(false), .trueFalse(true)]

    VStack(alignment: .leading, spacing: 16) {
      if showsStatement {
        TrueFalseStatementCard(
          statement: statement, result: result, isLocked: isLocked, draft: $draft)
      }

      VStack(spacing: 10) {
        ForEach(Array(answers.enumerated()), id: \.offset) { index, answer in
          if result == nil || optionResult(answer) != nil || shownPick == answer {
            AnswerOption(
              marker: index + 1,
              isPicked: shownPick == answer,
              result: optionResult(answer),
              isLocked: isLocked,
              action: { draft = draft == answer ? nil : answer },
              label: { Text(TrueFalseWords.label(for: answer, labels: labels)) })
          }
        }
      }
    }
  }

  /// A blank is neither right nor wrong: it stays picked, never marked.
  private func optionResult(_ answer: PracticeAnswer) -> AnswerOptionResult? {
    guard let result, case .trueFalse = answer else { return nil }
    return result.optionMark(
      isRightAnswer: result.correctAnswer == answer, isPicked: result.answer == answer)
  }
}

/// A statement with a table doesn't swipe, so the table can scroll.
struct TrueFalseStatementCard: View {
  let statement: String
  let result: PracticeItemResult?
  let isLocked: Bool
  @Binding var draft: PracticeAnswer?
  @State private var offset: CGFloat = 0
  @Environment(\.accessibilityReduceMotion) private var reduceMotion

  private static let swipeThreshold: CGFloat = 90

  var body: some View {
    ItemText(statement)
      .font(.title3.weight(.semibold))
      .foregroundStyle(result == nil ? .primary : .secondary)
      .padding(20)
      .frame(maxWidth: .infinity, minHeight: 120, alignment: .topLeading)
      .background(
        Color(.secondarySystemGroupedBackground),
        in: RoundedRectangle(cornerRadius: 16, style: .continuous)
      )
      .overlay(
        RoundedRectangle(cornerRadius: 16, style: .continuous).strokeBorder(Color(.separator))
      )
      .offset(x: offset)
      .rotationEffect(.degrees(reduceMotion ? 0 : Double(offset) * 0.06))
      .gesture(swipe, isEnabled: !isLocked && !statement.contains("|"))
      .accessibilityAddTraits(.isHeader)
  }

  private var swipe: some Gesture {
    DragGesture(minimumDistance: 12)
      .onChanged { offset = $0.translation.width }
      .onEnded { value in
        let distance = value.translation.width
        withAnimation(.snappy(duration: 0.2)) { offset = 0 }

        if abs(distance) >= Self.swipeThreshold {
          draft = .trueFalse(distance > 0)
        }
      }
  }
}

/// The words statements are answered with, so buttons, feedback and reviews always agree.
enum TrueFalseWords {
  static func label(for answer: PracticeAnswer, labels: PracticeTrueFalseLabels)
    -> LocalizedStringResource
  {
    guard case .trueFalse(let isTrue) = answer else {
      return LocalizedStringResource(
        "Leave blank", table: "Practice",
        comment: "Answer that leaves a statement blank where a wrong answer cancels a right one.")
    }

    return label(isTrue: isTrue, labels: labels)
  }

  static func label(isTrue: Bool, labels: PracticeTrueFalseLabels) -> LocalizedStringResource {
    switch (labels, isTrue) {
    case (.rightWrong, true):
      LocalizedStringResource(
        "Right", table: "Practice", comment: "Judging an exam statement as right (Cebraspe style).")
    case (.rightWrong, false):
      LocalizedStringResource(
        "Wrong", table: "Practice", comment: "Judging an exam statement as wrong (Cebraspe style).")
    case (.trueFalse, true):
      LocalizedStringResource(
        "True", table: "Practice", comment: "Answer to a true-or-false statement.")
    case (.trueFalse, false):
      LocalizedStringResource(
        "False", table: "Practice", comment: "Answer to a true-or-false statement.")
    }
  }

  static func savedAnswer(_ answer: String?, labels: PracticeTrueFalseLabels) -> String? {
    guard let answer else { return nil }

    if answer == "true" || answer == "false" {
      return String(localized: label(isTrue: answer == "true", labels: labels))
    }

    return answer
  }
}

struct MatchPairsItemView: View {
  let left: [String]
  let right: [String]
  let isLocked: Bool
  @Binding var draft: PracticeAnswer?
  @State private var selected: Int?

  var body: some View {
    let current = matches

    HStack(alignment: .top, spacing: 12) {
      VStack(spacing: 8) {
        ForEach(Array(left.enumerated()), id: \.offset) { index, entry in
          AnswerOption(
            isPicked: selected == index,
            isLocked: isLocked,
            tag: current[index] == nil ? nil : AnyView(PairBadge(number: index + 1)),
            action: { pickLeft(index, current: current) },
            label: { Text(ItemTextBlock.inline(entry)) })
        }
      }
      .accessibilityElement(children: .contain)
      .accessibilityLabel(
        Text("Match these", tableName: "Practice", comment: "VoiceOver name of the left column."))

      VStack(spacing: 8) {
        ForEach(Array(right.enumerated()), id: \.offset) { index, entry in
          let owner = current.firstIndex(of: index)

          AnswerOption(
            isLocked: isLocked || (selected == nil && owner == nil),
            tag: owner.map { AnyView(PairBadge(number: $0 + 1)) },
            action: { pickRight(index, current: current) },
            label: { Text(ItemTextBlock.inline(entry)) }
          )
          .accessibilityValue(matchedValue(owner))
        }
      }
      .accessibilityElement(children: .contain)
      .accessibilityLabel(
        Text("With these", tableName: "Practice", comment: "VoiceOver name of the right column."))
    }
  }

  private func matchedValue(_ owner: Int?) -> Text {
    guard let owner, left.indices.contains(owner) else { return Text(verbatim: "") }

    return Text(
      "Matched with \(ItemTextBlock.plain(left[owner]))", tableName: "Practice",
      comment: "VoiceOver value of a right-column entry already matched with a left entry.")
  }

  private var matches: [Int?] {
    switch draft {
    case .partial(let made) where made.count == left.count: made
    case .matches(let matched) where matched.count == left.count: matched
    default: Array(repeating: nil, count: left.count)
    }
  }

  private func update(_ next: [Int?]) {
    draft =
      if next.allSatisfy({ $0 != nil }) {
        .matches(next.compactMap(\.self))
      } else {
        next.allSatisfy { $0 == nil } ? nil : .partial(next)
      }
  }

  private func pickLeft(_ index: Int, current: [Int?]) {
    if current[index] != nil {
      var next = current
      next[index] = nil
      update(next)
      return
    }

    selected = selected == index ? nil : index
  }

  private func pickRight(_ index: Int, current: [Int?]) {
    if let owner = current.firstIndex(of: index) {
      var next = current
      next[owner] = nil
      update(next)
      return
    }

    guard let selected else { return }

    var next = current
    next[selected] = index
    update(next)
    self.selected = nil
  }
}

private struct PairBadge: View {
  let number: Int

  var body: some View {
    Text(number, format: .number)
      .font(.caption.monospacedDigit().weight(.semibold))
      .foregroundStyle(Color(.systemBackground))
      .frame(minWidth: 24, minHeight: 24)
      .background(Color.primary, in: Circle())
      .accessibilityHidden(true)
  }
}

struct OrderItemView: View {
  let steps: [String]
  let result: PracticeItemResult?
  let isLocked: Bool
  @Binding var draft: PracticeAnswer?

  var body: some View {
    let placed: [Int] = if case .order(let given) = result?.answer { given } else { order }

    VStack(alignment: .leading, spacing: 10) {
      Text(
        "Tap the steps in order.", tableName: "Practice",
        comment: "Instruction above an ordering question."
      )
      .font(.subheadline.weight(.medium))
      .foregroundStyle(.secondary)

      ForEach(Array(steps.enumerated()), id: \.offset) { index, step in
        let place = placed.firstIndex(of: index)

        AnswerOption(
          marker: index + 1,
          isPicked: place != nil,
          result: stepResult(index, placed: placed),
          isLocked: isLocked,
          tag: place.map { AnyView(PairBadge(number: $0 + 1)) },
          action: { tap(index) },
          label: { Text(ItemTextBlock.inline(step)) }
        )
        .accessibilityValue(placeValue(place))
      }
    }
  }

  private func placeValue(_ place: Int?) -> Text {
    guard let place else { return Text(verbatim: "") }

    return Text(
      "Place \(place + 1)", tableName: "Practice",
      comment: "VoiceOver value of a step placed in an ordering question.")
  }

  private func stepResult(_ index: Int, placed: [Int]) -> AnswerOptionResult? {
    guard let result, case .order(let correctOrder) = result.correctAnswer else { return nil }
    return placed.firstIndex(of: index) == correctOrder.firstIndex(of: index) ? .right : .wrong
  }

  private var order: [Int] {
    switch draft {
    case .partial(let placed): placed.compactMap(\.self)
    case .order(let given): given
    default: []
    }
  }

  private func tap(_ index: Int) {
    let next = order.contains(index) ? order.filter { $0 != index } : order + [index]

    draft =
      if next.count == steps.count {
        .order(next)
      } else {
        next.isEmpty ? nil : .partial(next)
      }
  }
}

struct NumericItemView: View {
  let entry: PracticeNumericEntry?
  let unit: PracticeNumericUnit?
  let mark: AnswerOptionResult?
  let isLocked: Bool
  @Binding var draft: PracticeAnswer?
  let onSubmit: (PracticeAnswer) -> Void
  @State private var isInvalid = false
  @FocusState private var isFocused: Bool

  var body: some View {
    VStack(alignment: .leading, spacing: 8) {
      HStack(spacing: 8) {
        if let unit, unit.position == .prefix {
          Text(unit.symbol).foregroundStyle(.secondary)
        }

        TextField(
          String(
            localized: "Your answer", table: "Practice", comment: "Placeholder of an answer field."),
          text: Binding(get: { typedText ?? NumericEntryParser.text(for: draft) }, set: type)
        )
        .font(.title3.monospacedDigit())
        .keyboardType(entry?.kind == .fraction ? .numbersAndPunctuation : .decimalPad)
        .submitLabel(.done)
        .focused($isFocused)
        .disabled(isLocked)
        .onSubmit(submit)

        if let unit, unit.position == .suffix {
          Text(unit.symbol).foregroundStyle(.secondary)
        }

        if let mark {
          Image(systemName: mark == .right ? "checkmark" : "xmark")
            .foregroundStyle(mark == .right ? Color.success : Color.destructive)
            .accessibilityHidden(true)
        }
      }
      .modifier(AnswerFieldStyle(mark: mark))

      if isInvalid {
        Text(invalidHint)
          .font(.subheadline)
          .foregroundStyle(.destructive)
      } else if let rule {
        Text(rule)
          .font(.subheadline)
          .foregroundStyle(.secondary)
      }
    }
    .onAppear { isFocused = !isLocked }
  }

  private var typedText: String? {
    if case .typing(let text, _) = draft { text } else { nil }
  }

  private func type(_ text: String) {
    isInvalid = false
    draft =
      text.isEmpty
      ? nil
      : .typing(
        text, reads: NumericEntryParser.parse(text, entry: entry).map(PracticeAnswer.number))
  }

  private func submit() {
    guard case .number(let value) = draft?.complete else {
      isInvalid = true
      return
    }

    onSubmit(.number(value))
  }

  private var rule: LocalizedStringResource? {
    switch entry?.kind {
    case .decimals:
      LocalizedStringResource(
        "Round to \(entry?.places ?? 0) decimal places.", table: "Practice",
        comment: "Rule under a math answer field that takes a fixed number of decimal places.")
    case .fraction:
      LocalizedStringResource(
        "A fraction, like 2/3, or a decimal.", table: "Practice",
        comment: "Rule under a math answer field that takes a fraction.")
    case .integer:
      LocalizedStringResource(
        "A whole number.", table: "Practice",
        comment: "Rule under a math answer field that takes a whole number.")
    case .number, nil:
      nil
    }
  }

  private var invalidHint: LocalizedStringResource {
    let example = 2.5.formatted(.number)

    switch entry?.kind {
    case .fraction:
      return LocalizedStringResource(
        "Type a fraction, like 2/3, or a number, like \(example).", table: "Practice",
        comment: "Hint after typing something a fraction answer field can't read.")
    case .integer:
      return LocalizedStringResource(
        "Type a whole number, like 12.", table: "Practice",
        comment: "Hint after typing something a whole-number answer field can't read.")
    case .decimals, .number, nil:
      return LocalizedStringResource(
        "Type a number, like \(example).", table: "Practice",
        comment: "Hint after typing something a number answer field can't read.")
    }
  }
}

struct TypedItemView: View {
  let mark: AnswerOptionResult?
  let isLocked: Bool
  @Binding var draft: PracticeAnswer?
  let onSubmit: (PracticeAnswer) -> Void
  @FocusState private var isFocused: Bool

  var body: some View {
    HStack {
      TextField(
        String(
          localized: "Your answer", table: "Practice", comment: "Placeholder of an answer field."),
        text: Binding(get: { shown }, set: type)
      )
      .font(.title3)
      .textInputAutocapitalization(.never)
      .autocorrectionDisabled()
      .submitLabel(.done)
      .focused($isFocused)
      .disabled(isLocked)
      .onSubmit {
        if let answer = draft?.complete { onSubmit(answer) }
      }

      if let mark {
        Image(systemName: mark == .right ? "checkmark" : "xmark")
          .foregroundStyle(mark == .right ? Color.success : Color.destructive)
          .accessibilityHidden(true)
      }
    }
    .modifier(AnswerFieldStyle(mark: mark))
    .onAppear { isFocused = !isLocked }
  }

  private var shown: String {
    switch draft {
    case .typing(let text, _), .text(let text): text
    default: ""
    }
  }

  private func type(_ text: String) {
    let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
    draft = text.isEmpty ? nil : .typing(text, reads: trimmed.isEmpty ? nil : .text(trimmed))
  }
}

private struct AnswerFieldStyle: ViewModifier {
  let mark: AnswerOptionResult?

  func body(content: Content) -> some View {
    let shape = RoundedRectangle(cornerRadius: 12, style: .continuous)

    content
      .padding(.horizontal, 14)
      .frame(minHeight: 56)
      .background(Color(.secondarySystemGroupedBackground), in: shape)
      .overlay(
        shape.strokeBorder(
          mark == .right ? Color.success : mark == .wrong ? Color.destructive : Color(.separator),
          lineWidth: mark == nil ? 1 : 2))
  }
}

/// The number an answer box takes from what the learner typed: a fraction box takes "2/3" or a
/// decimal, an integer box only a whole number, every other box a number with a comma or a point.
enum NumericEntryParser {
  /// A draft's number as the field shows it in the learner's language: no grouping, and every digit
  /// a typed number can have, so it reads back as the same number.
  static func text(for draft: PracticeAnswer?, locale: Locale = .autoupdatingCurrent) -> String {
    guard case .number(let value) = draft else { return "" }
    return value.formatted(
      .number.grouping(.never).precision(.significantDigits(1...15)).locale(locale))
  }

  static func parse(_ text: String, entry: PracticeNumericEntry?) -> Double? {
    let trimmed = text.trimmingCharacters(in: .whitespaces)

    if entry?.kind == .fraction, trimmed.contains("/") {
      let parts = trimmed.split(separator: "/", omittingEmptySubsequences: false)

      guard parts.count == 2, let numerator = number(String(parts[0])),
        let denominator = number(String(parts[1])), denominator != 0
      else { return nil }

      return numerator / denominator
    }

    guard let value = number(trimmed) else { return nil }

    if entry?.kind == .integer, value.rounded() != value {
      return nil
    }

    return value
  }

  /// A comma or a point reads as the decimal mark; spaces and thousands separators are ignored
  /// when another mark follows them ("1.234,5" and "1,234.5" both read 1234.5).
  private static func number(_ text: String) -> Double? {
    var cleaned = text.trimmingCharacters(in: .whitespaces).replacingOccurrences(of: " ", with: "")
      .replacingOccurrences(of: "\u{00A0}", with: "")

    guard !cleaned.isEmpty else { return nil }

    if let lastMark = cleaned.lastIndex(where: { $0 == "," || $0 == "." }) {
      let head = cleaned[..<lastMark].filter { $0 != "," && $0 != "." }
      let tail = cleaned[cleaned.index(after: lastMark)...]
      cleaned = head + "." + tail
    }

    cleaned = cleaned.replacingOccurrences(of: "\u{2212}", with: "-")
    return Double(cleaned)
  }
}
