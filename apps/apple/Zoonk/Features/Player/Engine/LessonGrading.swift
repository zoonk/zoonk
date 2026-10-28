import Foundation

/// A verdict the device reaches from a screen's content alone, the same way core's
/// `gradeStepAnswer` does, so feedback is instant and the server's grade agrees with it.
struct LocalGrade: Hashable, Sendable {
  let isCorrect: Bool
  /// The learner's answer as text, for the result.
  let answerText: String?
  /// The right answer as text when missed.
  let correctAnswer: String?
  /// Why: the option's reason or the screen's explanation.
  let feedback: String?
}

enum LessonGrading {
  /// Grades what code can settle on the device. Nil for answers only the server grades (typed and
  /// spoken answers, an activity interaction its renderer doesn't grade) and for an answer that
  /// doesn't fit the screen.
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

      let isCorrect = isWithin(value, of: expected, tolerance: tolerance)

      return LocalGrade(
        isCorrect: isCorrect,
        answerText: formatNumber(value, unit: unit),
        correctAnswer: isCorrect ? nil : formatNumber(expected, unit: unit),
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

  static func isWithin(_ value: Double, of expected: Double, tolerance: ActivityCheck.Tolerance)
    -> Bool
  {
    let allowed =
      tolerance.kind == .absolute ? tolerance.value : abs(expected) * tolerance.value

    // A tiny epsilon keeps 0.1 + 0.2 from missing 0.3.
    return abs(value - expected) <= allowed + 1e-9
  }

  private static func formatNumber(_ value: Double, unit: String?) -> String {
    let number = value.formatted(.number.precision(.fractionLength(0...6)))
    return unit.map { "\(number) \($0)" } ?? number
  }

  // MARK: - Language exercises

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
    case (.reading, .reading(let words)):
      guard let sentence = exercise.sentence else {
        return nil
      }

      return gradeArrangedWords(words, target: sentence.sentence, feedback: sentence.explanation)
    case (.listening, .listening(let words)):
      guard let sentence = exercise.sentence else {
        return nil
      }

      return gradeArrangedWords(words, target: sentence.translation, feedback: sentence.explanation)
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

  /// The whole sentence the learner was building, with the right words in its blanks.
  static func fillBlankSentence(_ template: String, answers: [String]) -> String {
    template.components(separatedBy: "[BLANK]").enumerated().map { index, segment in
      segment + (index < answers.count ? answers[index] : "")
    }.joined()
  }

  private static func pairKey(_ left: String, _ right: String) -> String {
    "\(left)\u{0}\(right)"
  }

  private static func gradeArrangedWords(_ words: [String], target: String, feedback: String?)
    -> LocalGrade
  {
    let expected = segmentWords(target)
    let separator = target.contains(" ") ? " " : ""

    return LocalGrade(
      isCorrect: arrangementKey(words, separator) == arrangementKey(expected, separator),
      answerText: words.joined(separator: " "),
      correctAnswer: expected.joined(separator: " "),
      feedback: feedback)
  }

  /// Punctuation and case never decide an arranged answer. Text without spaces (Japanese,
  /// Chinese) compares as one run, so word boundaries the device and the server draw differently
  /// can't fail a right answer.
  private static func arrangementKey(_ words: [String], _ separator: String) -> String {
    words.map { word in
      String(word.unicodeScalars.filter { CharacterSet.letters.union(.decimalDigits).contains($0) })
        .lowercased()
    }
    .filter { !$0.isEmpty }
    .joined(separator: separator)
  }

  /// The words of a sentence as the word bank shows them: punctuation stays with its word.
  static func segmentWords(_ text: String) -> [String] {
    // Spaces before punctuation go, so "Oui !" is one word.
    let normalized = text.replacing(/(\S)\s+([!?.,;:。、！？؟])/) { "\($0.output.1)\($0.output.2)" }

    if normalized.contains(" ") {
      return normalized.split(separator: " ").map(String.init)
    }

    var words: [String] = []
    normalized.enumerateSubstrings(in: normalized.startIndex..., options: .byWords) {
      word, _, _, _ in
      if let word {
        words.append(word)
      }
    }

    return words.isEmpty ? [normalized] : words
  }
}
