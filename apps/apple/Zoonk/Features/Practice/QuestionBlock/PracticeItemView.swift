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
        question: question, result: result, isLocked: locked, draft: $draft, onSubmit: onSubmit)
    case .order:
      OrderItemView(question: question, result: result, isLocked: locked, draft: $draft)
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
            text: LessonRichText.typeset(option),
            action: { pick(index) }
          )
          .practiceFocus(index == 0 ? .answer : nil)
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
    .typeStyle(.note.weight(.medium))
    .foregroundStyle(.mutedForeground)
  }
}

struct TrueFalseItemView: View {
  @Environment(\.locale) private var locale

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
            let text = localizedLabel(for: answer)
            AnswerOption(
              marker: index + 1,
              isPicked: shownPick == answer,
              result: optionResult(answer),
              isLocked: isLocked,
              text: RichInline(text: AttributedString(text)),
              action: { draft = draft == answer ? nil : answer }
            )
            .practiceFocus(index == 0 ? .answer : nil)
          }
        }
      }
    }
  }

  private func localizedLabel(for answer: PracticeAnswer) -> String {
    var label = TrueFalseWords.label(for: answer, labels: labels)
    label.locale = locale
    return String(localized: label)
  }

  /// A blank is neither right nor wrong: it stays picked, never marked.
  private func optionResult(_ answer: PracticeAnswer) -> AnswerOptionResult? {
    guard let result, case .trueFalse = answer else { return nil }
    return result.optionMark(
      isRightAnswer: result.correctAnswer == answer, isPicked: result.answer == answer)
  }
}

struct TrueFalseStatementCard: View {
  let statement: String
  let result: PracticeItemResult?
  let isLocked: Bool
  @Binding var draft: PracticeAnswer?
  @State private var offset: CGFloat = 0
  @Environment(\.accessibilityReduceMotion) private var reduceMotion

  private static let swipeThreshold: CGFloat = 90

  var body: some View {
    LessonTextBlocks(statement)
      .typeStyle(.section)
      .foregroundStyle(result == nil ? Color(.foreground) : .mutedForeground)
      .padding(20)
      .frame(maxWidth: .infinity, alignment: .topLeading)
      .panel()
      .offset(x: offset)
      .rotationEffect(.degrees(reduceMotion ? 0 : Double(offset) * 0.06))
      .gesture(
        swipe,
        isEnabled: !isLocked && !RichTextBlock.parse(statement).contains(where: \.scrollsSideways)
      )
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

  /// A statement's answer is saved as `true` or `false`; any other format keeps its words as saved.
  static func savedAnswer(_ answer: String?, format: String?, labels: PracticeTrueFalseLabels)
    -> String?
  {
    guard let answer else { return nil }

    if format == "trueFalse" && (answer == "true" || answer == "false") {
      return String(localized: label(isTrue: answer == "true", labels: labels))
    }

    return answer
  }
}

/// A learning match (`key`) checks each pair as it's made and sends itself with its last pair; a
/// test's match waits for Check, its pairs free to undo until then.
struct MatchPairsItemView: View {
  let question: PracticeQuestion
  let result: PracticeItemResult?
  let isLocked: Bool
  @Binding var draft: PracticeAnswer?
  let onSubmit: (PracticeAnswer) -> Void
  @State private var picking = MatchPicking()

  private var left: [String] { question.left }
  private var right: [String] { question.right }

  var body: some View {
    let pairs = self.pairs

    MatchBoard(leftCount: left.count, rightCount: right.count, solvedRows: solvedRows(pairs)) {
      card in
      MatchEntry(
        state: state(of: card, pairs: pairs),
        keyIndex: card.side == .left ? card.index : left.count + card.index,
        partner: partner(of: card, pairs: pairs),
        action: isLocked ? nil : { tap(card, pairs: pairs) }
      ) {
        LessonRichText(text(of: card))
      }
      .practiceFocus(card == .left(0) ? .answer : nil)
    }
    .matchBoardFeedback(
      $picking, locked: question.checksEachPair ? pairs.count { $0 != nil } : 0,
      isPlaying: !isLocked)
  }

  private func text(of card: MatchCardRef) -> String {
    let column = card.side == .left ? left : right
    return column.indices.contains(card.index) ? column[card.index] : ""
  }

  /// For each left entry, the right one it's paired with so far.
  private var pairs: [Int?] {
    switch draft {
    case .partial(let made) where made.count == left.count: made
    case .pairing(let made, _) where made.count == left.count: made
    case .matches(let matched, _) where matched.count == left.count: matched
    default: Array(repeating: nil, count: left.count)
    }
  }

  private var misses: [MatchTry] {
    if case .pairing(_, let misses) = draft { misses } else { [] }
  }

  /// The left cards that had a wrong try, on a board finished pair by pair or revealed by "I don't
  /// know yet".
  private var missedLefts: Set<Int> {
    switch draft ?? result?.answer {
    case .pairing(_, let misses), .matches(_, let misses?): Set(misses.map(\.left))
    default: []
    }
  }

  private func isSolved(_ pairs: [Int?]) -> Bool {
    question.key != nil && (result != nil || pairs.allSatisfy { $0 != nil })
  }

  /// A learning match lays out as its answer once every pair is found, or once it's checked.
  private func solvedRows(_ pairs: [Int?]) -> [MatchTry]? {
    guard let key = question.key, isSolved(pairs) else {
      return nil
    }

    return key.enumerated().map { MatchTry(left: $0.offset, right: $0.element) }
  }

  private func state(of card: MatchCardRef, pairs: [Int?]) -> MatchEntryState {
    let owner = card.side == .left ? card.index : pairs.firstIndex(of: card.index)

    guard question.checksEachPair else {
      if let owner, pairs.indices.contains(owner), pairs[owner] != nil {
        return .paired(owner + 1)
      }

      return picking.selected == card ? .selected : .idle
    }

    // Solved, every pair the learner found keeps its check; "I don't know yet" shows the rest of
    // the answer without one.
    if let owner, pairs.indices.contains(owner), pairs[owner] != nil {
      return isSolved(pairs) ? .solved(missed: missedLefts.contains(owner)) : picking.kept(card)
    }

    if result != nil {
      return .idle
    }

    if picking.isMissed(card) {
      return .wrong(picking.missCount)
    }

    return picking.selected == card ? .selected : .idle
  }

  private func partner(of card: MatchCardRef, pairs: [Int?]) -> String? {
    let partner: Int?

    switch card.side {
    case .left:
      partner = pairs.indices.contains(card.index) ? pairs[card.index] : nil
    case .right:
      partner = pairs.firstIndex(of: card.index)
    }

    guard let partner else { return nil }

    return LessonRichText.spoken(
      text(of: card.side == .left ? .right(partner) : .left(partner)))
  }

  private func tap(_ card: MatchCardRef, pairs: [Int?]) {
    if question.checksEachPair {
      tapChecking(card, pairs: pairs)
    } else {
      tapHeld(card, pairs: pairs)
    }
  }

  private func tapChecking(_ card: MatchCardRef, pairs: [Int?]) {
    guard let key = question.key, !state(of: card, pairs: pairs).isKept,
      let (attempt, isRight) = picking.tap(
        card, goesTogether: { key.indices.contains($0.left) && key[$0.left] == $0.right })
    else {
      return
    }

    let (leftText, rightText) = (
      LessonRichText.spoken(text(of: .left(attempt.left))),
      LessonRichText.spoken(text(of: .right(attempt.right)))
    )

    guard isRight else {
      let misses = self.misses
      draft = .pairing(
        pairs, misses: misses.count < MatchTry.maxMisses ? misses + [attempt] : misses)
      announcePolitely(MatchAnnouncement.missed(leftText, rightText))
      return
    }

    var next = pairs
    next[attempt.left] = attempt.right
    let matched = next.count { $0 != nil }

    announcePolitely(
      MatchAnnouncement.matched(leftText, rightText, matched: matched, total: left.count))

    if matched == left.count {
      let answer = PracticeAnswer.matches(next.compactMap(\.self), misses: misses)
      draft = answer
      onSubmit(answer)
    } else {
      draft = .pairing(next, misses: misses)
    }
  }

  private func tapHeld(_ card: MatchCardRef, pairs: [Int?]) {
    if let next = picking.tapHeld(card, pairs: pairs) {
      update(next)
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
}

struct OrderItemView: View {
  let question: PracticeQuestion
  let result: PracticeItemResult?
  let isLocked: Bool
  @Binding var draft: PracticeAnswer?

  @State private var selectedId: Int?

  var body: some View {
    let steps = question.options
    if result != nil || isLocked {
      let answer = result?.answer ?? question.answerToSubmit(draft)
      let placed: [Int] = if case .order(let order) = answer { order } else { [] }

      VStack(alignment: .leading, spacing: 8) {
        ForEach(placed.isEmpty ? Array(steps.indices) : placed, id: \.self) { index in
          if steps.indices.contains(index) {
            let place = placed.firstIndex(of: index)
            let mark = stepResult(index, place: place)
            AnswerOption(
              marker: place.map { $0 + 1 }, isPicked: place != nil, result: mark,
              text: LessonRichText.typeset(steps[index]), action: nil
            )
            .accessibilityValue(placeValue(place, result: mark))
          }
        }
      }
    } else if case .order(let order) = question.answerToSubmit(draft) {
      OrderSteps(
        order: order, selectedId: $selectedId,
        text: { steps.indices.contains($0) ? steps[$0] : nil },
        onReorder: { draft = .order($0) }
      )
    }
  }

  /// The badge that shows a checked step's place is hidden from VoiceOver, so its value carries the
  /// place and, as main's and Android's do, whether it's the right one.
  private func placeValue(_ place: Int?, result: AnswerOptionResult?) -> Text {
    guard let place else { return Text(verbatim: "") }

    switch result {
    case .right:
      return Text(
        "Place \(place + 1), right place", tableName: "Practice",
        comment: "VoiceOver value of a checked ordering step the learner put in its right place.")
    case .wrong:
      return Text(
        "Place \(place + 1), wrong place", tableName: "Practice",
        comment: "VoiceOver value of a checked ordering step the learner put in a wrong place.")
    case .guess, nil:
      return Text(
        "Place \(place + 1)", tableName: "Practice",
        comment: "VoiceOver value of a step placed in an ordering question.")
    }
  }

  private func stepResult(_ index: Int, place: Int?) -> AnswerOptionResult? {
    guard let place, case .order(let correctOrder) = result?.correctAnswer else { return nil }
    return place == correctOrder.firstIndex(of: index) ? .right : .wrong
  }
}

private var answerPlaceholder: String {
  String(localized: "Your answer", table: "Practice", comment: "Placeholder of an answer field.")
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
          Text(unit.symbol).foregroundStyle(.mutedForeground)
        }

        TextField(
          text: Binding(get: { typedText ?? NumericEntryParser.text(for: draft) }, set: type),
          prompt: Text(answerPlaceholder).fieldPrompt()
        ) {
          Text(answerPlaceholder)
        }
        .typeStyle(.lessonText.monospacedDigit())
        .keyboardType(entry?.kind == .fraction ? .numbersAndPunctuation : .decimalPad)
        .submitLabel(.done)
        .focused($isFocused)
        .disabled(isLocked)
        .onSubmit(submit)

        if let unit, unit.position == .suffix {
          Text(unit.symbol).foregroundStyle(.mutedForeground)
        }

        if let mark {
          FieldMark(mark: mark)
        }
      }
      .modifier(AnswerFieldStyle(mark: mark, isFocused: isFocused))

      if isInvalid {
        FailureLine(message: invalidHint)
          .typeStyle(.body)
      } else if let rule {
        Text(rule)
          .typeStyle(.note)
          .foregroundStyle(.mutedForeground)
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
      decimalEntryRule(entry?.places ?? 0)
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
    let example = 2.5.formatted(.number.locale(.appLanguage))

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

func decimalEntryRule(_ places: Int) -> LocalizedStringResource {
  if places == 0 {
    return LocalizedStringResource("Round to the nearest whole number.", table: "Practice")
  }

  return LocalizedStringResource(
    "Round to \(places) decimal places.", table: "Practice",
    locale: .appLanguage,
    comment: "Rule under a math answer field that takes a fixed number of decimal places.")
}

struct TypedItemView: View {
  let mark: AnswerOptionResult?
  let isLocked: Bool
  @Binding var draft: PracticeAnswer?
  let onSubmit: (PracticeAnswer) -> Void
  @FocusState private var isFocused: Bool

  var body: some View {
    HStack {
      FittedTextInput(text: Binding(get: { shown }, set: type), limit: 500) { text, selection in
        TextField(
          text: text, selection: selection, prompt: Text(answerPlaceholder).fieldPrompt()
        ) {
          Text(answerPlaceholder)
        }
        .typeStyle(.lessonText)
        .textInputAutocapitalization(.never)
        .autocorrectionDisabled()
        .submitLabel(.done)
        .focused($isFocused)
        .disabled(isLocked)
        .onSubmit {
          if let answer = draft?.complete { onSubmit(answer) }
        }
      }

      if let mark {
        FieldMark(mark: mark)
      }
    }
    .modifier(AnswerFieldStyle(mark: mark, isFocused: isFocused))
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

/// Main's answer field: an input 56pt tall whose line says the verdict once checked.
private struct AnswerFieldStyle: ViewModifier {
  let mark: AnswerOptionResult?
  let isFocused: Bool

  func body(content: Content) -> some View {
    content
      .fieldBorder(
        isFocused: isFocused, isRight: mark.map { $0 == .right }, minHeight: 56)
  }
}

/// The verdict a checked field shows at its end, beside the words that say it.
private struct FieldMark: View {
  let mark: AnswerOptionResult

  var body: some View {
    Image(systemName: mark == .right ? "checkmark" : "xmark")
      .foregroundStyle(mark == .right ? Color.successText : Color.destructiveText)
      .accessibilityHidden(true)
  }
}

/// The number an answer box takes from what the learner typed: a fraction box takes "2/3" or a
/// decimal, an integer box only a whole number, every other box a number with a comma or a point.
enum NumericEntryParser {
  /// A draft's number as the field shows it in the lessons' language: no grouping, and every digit
  /// a typed number can have, so it reads back as the same number.
  static func text(for draft: PracticeAnswer?, locale: Locale = .appLanguage) -> String {
    guard case .number(let value) = draft else { return "" }
    return value.formatted(
      .number.grouping(.never).precision(.significantDigits(1...15)).locale(locale))
  }

  static func parse(
    _ text: String, entry: PracticeNumericEntry?, locale: Locale = .appLanguage
  ) -> Double? {
    let trimmed = text.trimmingCharacters(in: .whitespaces)

    if entry?.kind == .fraction, trimmed.contains("/") {
      let parts = trimmed.split(separator: "/", omittingEmptySubsequences: false)

      guard parts.count == 2,
        let numerator = parseLocalizedNumber(String(parts[0]), locale: locale),
        let denominator = parseLocalizedNumber(String(parts[1]), locale: locale), denominator != 0
      else { return nil }

      return numerator / denominator
    }

    guard let value = parseLocalizedNumber(trimmed, locale: locale) else { return nil }

    if entry?.kind == .integer, value.rounded() != value {
      return nil
    }

    return value
  }
}
