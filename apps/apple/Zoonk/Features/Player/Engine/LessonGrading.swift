import Foundation

/// Mirrors core's `gradeStepAnswer`, so feedback is instant. When the server's verdict differs,
/// it replaces this one (`LessonPlayerState.confirm`).
struct LocalGrade: Hashable, Sendable {
  let isCorrect: Bool
  let answerText: String?
  let correctAnswer: String?
  let feedback: String?
}

enum LessonGrading {
  /// Nil for answers only the server grades (typed and spoken answers, an activity interaction its
  /// renderer doesn't grade) and for an answer that doesn't fit the screen.
  static func grade(
    _ answer: LessonAnswer,
    step: LessonStep,
    gradeActivity: ((ActivityStepContent, ActivityAnswer) -> Bool)? = nil
  ) -> LocalGrade? {
    switch (step.content, answer) {
    case (.hook(let content), .hookGuess(let optionId)):
      return gradeHook(content, optionId: optionId)
    case (.check(let content), .check(let optionId)):
      return gradeOptions(
        content.options.map { ($0.id, $0.text, $0.isCorrect, $0.reason) }, optionId: optionId)
    case (.activity(let content), .activity(let activityAnswer)):
      return gradeActivityAnswer(content, answer: activityAnswer, gradeInteraction: gradeActivity)
    case (.challenge(let content), .challenge(let choiceIds)):
      return ChallengeWalk.grade(content, choiceIds: choiceIds)
    case (.spokenAnswer(_, let listening?), .listening):
      return gradeExercise(listening, answer: answer)
    case (.language(let exercise, _), _):
      return gradeExercise(exercise, answer: answer)
    default:
      return nil
    }
  }

  /// A hook's guess reveals the answer whatever the pick; the reveal is the why.
  private static func gradeHook(_ content: HookContent, optionId: String) -> LocalGrade? {
    guard let options = content.options, let picked = options.first(where: { $0.id == optionId })
    else {
      return nil
    }

    return LocalGrade(
      isCorrect: picked.isCorrect,
      answerText: picked.text,
      correctAnswer: picked.isCorrect ? nil : options.first(where: \.isCorrect)?.text,
      feedback: content.reveal)
  }

  private static func gradeOptions(
    _ options: [(id: String, text: String, isCorrect: Bool, reason: String?)], optionId: String
  ) -> LocalGrade? {
    guard let picked = options.first(where: { $0.id == optionId }) else {
      return nil
    }

    return LocalGrade(
      isCorrect: picked.isCorrect,
      answerText: picked.text,
      correctAnswer: picked.isCorrect ? nil : options.first(where: \.isCorrect)?.text,
      feedback: picked.reason)
  }

  private static func gradeActivityAnswer(
    _ content: ActivityStepContent,
    answer: ActivityAnswer,
    gradeInteraction: ((ActivityStepContent, ActivityAnswer) -> Bool)?
  ) -> LocalGrade? {
    switch content.check {
    case .choice(_, let options, _, _):
      guard answer.kind == "choice", let optionId = answer.optionId else {
        return nil
      }

      return gradeOptions(
        options.map { ($0.id, $0.text, $0.isCorrect, $0.reason) }, optionId: optionId)
    case .numeric(_, let expected, let tolerance, let unit, let explanation, _, _):
      guard let value = answer.number else {
        return nil
      }

      let isCorrect = isNumericAnswerRight(
        value, expected: expected, tolerance: tolerance, minTolerance: content.minTolerance)

      // One precision for both, as main's verdict shows them.
      let digits = exactFractionDigitsFor(expected: expected, tolerance: tolerance, value: value)
      let format = { (number: Double) in
        let text = formatLocalizedNumber(
          number, fractionDigits: digits, locale: .current, grouping: true)
        return unit.map { "\(text) \($0)" } ?? text
      }

      return LocalGrade(
        isCorrect: isCorrect,
        answerText: format(value),
        correctAnswer: isCorrect ? nil : format(expected),
        feedback: explanation)
    case .interaction(let explanation):
      guard let gradeInteraction else {
        return nil
      }

      return LocalGrade(
        isCorrect: gradeInteraction(content, answer), answerText: nil, correctAnswer: nil,
        feedback: explanation)
    }
  }

  /// A typed number is right within the check's tolerance, the template's floor the screen
  /// carries, or rounded to the places the learner typed ("12" for 11.88%), since a check stores no
  /// precision to hold the learner to.
  static func isNumericAnswerRight(
    _ value: Double, expected: Double, tolerance: ActivityCheck.Tolerance,
    minTolerance: ActivityCheck.Tolerance?
  ) -> Bool {
    let tolerances = [tolerance] + [minTolerance].compactMap { $0 }

    return tolerances.contains { isWithin(value, of: expected, tolerance: $0) }
      || isRoundedAnswer(value, expected: expected)
  }

  /// Core's `withinTolerance`: relative slack takes rounded boundaries without overwhelming a
  /// small unit's tolerance.
  private static func isWithin(
    _ value: Double, of expected: Double, tolerance: ActivityCheck.Tolerance
  ) -> Bool {
    let allowed =
      tolerance.kind == .absolute ? tolerance.value : tolerance.value * abs(expected)
    let distance = abs(value - expected)
    let slack = 1e-9 * max(abs(expected), abs(value), allowed)

    return distance <= allowed + slack || distance <= 1e-9 * max(1, abs(expected))
  }

  /// `@zoonk/utils`' `isRoundedAnswer`: the expected answer rounded to the places typed, keeping
  /// two significant digits at least, so "0" for 0.4 or "10" for 11.88 isn't right.
  static func isRoundedAnswer(_ value: Double, expected: Double) -> Bool {
    guard countSignificantDigits(value) >= 2 else {
      return false
    }

    let halfPlace = 0.5 * pow(10, -Double(countDecimalPlaces(value)))
    return abs(value - expected) <= halfPlace * (1 + 1e-9)
  }

  /// Decimal places a number has as typed: 0.667 has 3, 2 has none, 1e-7 has 7.
  static func countDecimalPlaces(_ value: Double) -> Int {
    let parts = numberText(abs(value)).split(separator: "e-", omittingEmptySubsequences: false)
    let places = parts[0].split(separator: ".").dropFirst().first?.count ?? 0
    return places + (parts.count > 1 ? Int(parts[1]) ?? 0 : 0)
  }

  /// Significant digits as typed: 12 and 0.38 have 2, 0.4 and 10 have 1, 0 has none.
  private static func countSignificantDigits(_ value: Double) -> Int {
    let mantissa = numberText(abs(value)).split(separator: "e").first.map(String.init) ?? ""
    let digits = mantissa.replacingOccurrences(of: ".", with: "").drop { $0 == "0" }
    let significant =
      mantissa.contains(".")
      ? Substring(digits)
      : digits.dropLast(
        digits.reversed().prefix { $0 == "0" }.count)
    return significant.count
  }

  /// A number written as JavaScript's `String(number)` writes it, which core counts places in:
  /// "12", not Swift's "12.0".
  private static func numberText(_ value: Double) -> String {
    let text = "\(value)"
    return text.hasSuffix(".0") ? String(text.dropLast(2)) : text
  }

  static func gradeExercise(_ exercise: LanguageExercise, answer: LessonAnswer) -> LocalGrade? {
    switch (exercise.kind, answer) {
    case (.multipleChoice, .multipleChoice(let optionId)):
      let options = exercise.content.options ?? []
      let picked = options.first { $0.id == optionId }
      return LocalGrade(
        isCorrect: picked?.isCorrect ?? false,
        answerText: picked?.text,
        correctAnswer: options.first(where: \.isCorrect)?.text,
        feedback: picked?.feedback)
    case (.translation, .translation(let optionId)):
      guard let word = exercise.word else {
        return nil
      }

      return LocalGrade(
        isCorrect: word.id == optionId,
        answerText: exercise.translationOptions.first { $0.id == optionId }?.word,
        correctAnswer: word.word,
        feedback: nil)
    case (.fillBlank, .fillBlank(let userAnswers)):
      let answers = exercise.content.answers ?? []
      let isCorrect =
        answers.count == userAnswers.count
        && zip(answers, userAnswers).allSatisfy {
          $0.lowercased() == $1.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        }

      return LocalGrade(
        isCorrect: isCorrect,
        answerText: userAnswers.joined(separator: ", "),
        correctAnswer: fillBlankSentence(exercise.content.template ?? "", answers: answers),
        feedback: exercise.content.feedback)
    case (.reading, .reading(let words)), (.listening, .listening(let words)):
      guard let expected = arrangedWords(exercise) else {
        return nil
      }

      return LocalGrade(
        isCorrect: arrangementKey(words) == arrangementKey(expected),
        answerText: words.joined(separator: " "),
        correctAnswer: expected.joined(separator: " "),
        feedback: exercise.sentence?.explanation)
    case (.matchColumns, .matchColumns(let pairs, let mistakes)):
      let expected = (exercise.content.pairs ?? []).map { pairKey($0.left, $0.right) }.sorted()
      let given = pairs.map { pairKey($0.left, $0.right) }.sorted()

      return LocalGrade(
        isCorrect: mistakes == 0 && expected == given,
        answerText: pairs.map { "\($0.left) → \($0.right)" }.joined(separator: "; "),
        correctAnswer: nil,
        feedback: nil)
    default:
      return nil
    }
  }

  static func fillBlankSentence(_ template: String, answers: [String]) -> String {
    template.components(separatedBy: "[BLANK]").enumerated().map { index, segment in
      segment + (index < answers.count ? answers[index] : "")
    }.joined()
  }

  private static func pairKey(_ left: String, _ right: String) -> String {
    "\(left)\u{0}\(right)"
  }

  /// The words core checks an arranged answer against. A reading builds the sentence it translates,
  /// in the words the server split it into (its tiles), so text without spaces splits as core
  /// splits it; a listening builds the translation of what it plays, in the learner's language.
  static func arrangedWords(_ exercise: LanguageExercise) -> [String]? {
    guard let sentence = exercise.sentence else {
      return nil
    }

    return exercise.kind == .listening
      ? segmentWords(sentence.translation) : exercise.sentenceWordOptions.map(\.word)
  }

  /// Whether each arranged word sits where the sentence has it, as main marks them after a check.
  static func arrangedWordMarks(_ words: [String], expected: [String], isCorrect: Bool) -> [Bool] {
    words.indices.map { index in
      isCorrect
        || (expected.indices.contains(index) && wordKey(words[index]) == wordKey(expected[index]))
    }
  }

  /// Core's `matchesAcceptedArrangeWords`: the same words in the same order.
  private static func arrangementKey(_ words: [String]) -> [String] {
    words.map(wordKey)
  }

  /// Core's `normalizeArrangeWord`: punctuation and case never decide an arranged answer.
  private static func wordKey(_ word: String) -> String {
    var kept = String.UnicodeScalarView()
    kept.append(
      contentsOf: word.unicodeScalars.filter { $0.properties.isWhitespace || isLetterOrNumber($0) })
    return String(kept).lowercased().trimmingCharacters(in: .whitespacesAndNewlines)
  }

  /// JavaScript's `\p{L}` and `\p{N}`.
  private static func isLetterOrNumber(_ scalar: Unicode.Scalar) -> Bool {
    switch scalar.properties.generalCategory {
    case .uppercaseLetter, .lowercaseLetter, .titlecaseLetter, .modifierLetter, .otherLetter,
      .decimalNumber, .letterNumber, .otherNumber:
      true
    default:
      false
    }
  }

  /// A sentence in the learner's language split into words as core splits it: at spaces, with
  /// punctuation kept on its word. Without a space it's one word, as core keeps "Mexa-se!" whole.
  static func segmentWords(_ text: String) -> [String] {
    // Spaces before punctuation go, so "Oui !" is one word.
    let normalized = text.replacing(/(\S)\s+([!?.,;:。、！？؟])/) { "\($0.output.1)\($0.output.2)" }
    return normalized.split(separator: " ").map(String.init)
  }
}
