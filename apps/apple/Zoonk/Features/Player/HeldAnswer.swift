import Foundation

/// A device-graded answer the server hasn't taken yet: its whole check, sent again under its own run
/// and attempt id so the server records it once, with the verdict and time the lesson places the
/// learner by until then.
struct HeldAnswer: Codable, Hashable, Sendable {
  let stepId: String
  let answer: LessonAnswer
  let attemptId: String
  let runId: String
  let durationMs: Int
  let usedHelp: Bool
  let isCorrect: Bool
  let answeredAt: Date

  var runAnswer: LessonRunAnswer {
    LessonRunAnswer(stepId: stepId, isCorrect: isCorrect, answeredAt: answeredAt)
  }
}

/// One learner's held answers for one lesson, kept on the device so leaving the lesson or losing the
/// app doesn't lose them. Each change reads the list again: two players can hold the same lesson's
/// answers (two windows, or one closed while its send was still out).
struct HeldLessonAnswers {
  private let key: String
  private let defaults: UserDefaults

  init(learnerId: String, lessonId: String, defaults: UserDefaults) {
    key = "lesson.held.\(learnerId).\(lessonId)"
    self.defaults = defaults
  }

  func read() -> [HeldAnswer] {
    defaults.data(forKey: key).flatMap { try? JSONDecoder().decode([HeldAnswer].self, from: $0) }
      ?? []
  }

  func keep(_ answer: HeldAnswer) {
    write(read() + [answer])
  }

  func drop(_ answer: HeldAnswer) {
    write(read().filter { $0.attemptId != answer.attemptId })
  }

  private func write(_ answers: [HeldAnswer]) {
    if answers.isEmpty {
      defaults.removeObject(forKey: key)
    } else if let data = try? JSONEncoder().encode(answers) {
      defaults.set(data, forKey: key)
    }
  }
}
