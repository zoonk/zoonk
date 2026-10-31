import Foundation

/// Each scope is one conversation, as on main: a lesson screen and a practice question keep their
/// own.
enum TutorScope: Hashable, Sendable {
  case plan(goalId: String)
  case subject(goalId: String, subjectKey: String)
  case chapter(chapterId: String)
  case mock(blockId: String)
  /// `suggestions` are the lesson's `tutorSuggestions`, each with its `lessonSuggestionID`.
  case lesson(lessonId: String, stepIds: [String], suggestions: [TutorSuggestion])
  /// The position is 1-based, as the learner sees it. `answer` is the learner's, once the screen
  /// shows its result.
  case step(
    lessonId: String, stepId: String, stepNumber: Int, answer: LessonAnswer?,
    suggestions: [TutorSuggestion])
  /// A session's or practice's question: whether it was checked (`answered`), the session block
  /// it's asked in (absent in mistakes practice), and whether the learner missed it.
  case item(itemId: String, blockId: String?, answered: Bool, missed: Bool)

  /// A checked item or a lesson's suggestions don't start another conversation.
  var conversationKey: String {
    switch self {
    case .plan(let goalId):
      "plan:\(goalId)"
    case .subject(let goalId, let subjectKey):
      "subject:\(goalId):\(subjectKey)"
    case .chapter(let chapterId):
      "chapter:\(chapterId)"
    case .mock(let blockId):
      "mock:\(blockId)"
    case .lesson(let lessonId, _, _):
      "lesson:\(lessonId)"
    case .step(_, let stepId, _, _, _):
      "step:\(stepId)"
    case .item(let itemId, _, _, _):
      "item:\(itemId)"
    }
  }

  /// The lesson's own suggestions, sent by id so everyone who taps one shares its answer.
  var lessonSuggestions: [TutorSuggestion] {
    switch self {
    case .lesson(_, _, let suggestions), .step(_, _, _, _, let suggestions):
      suggestions
    case .plan, .subject, .chapter, .mock, .item:
      []
    }
  }

  /// Mirrors main's `isAboutCheckedAnswer`.
  var isAboutCheckedAnswer: Bool {
    switch self {
    case .step(_, _, _, let answer, _):
      answer != nil
    case .item(_, _, let answered, _):
      answered
    case .plan, .subject, .chapter, .mock, .lesson:
      false
    }
  }

  var goalId: String? {
    switch self {
    case .plan(let goalId), .subject(let goalId, _):
      goalId
    case .chapter, .mock, .lesson, .step, .item:
      nil
    }
  }
}
