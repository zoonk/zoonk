import Foundation

/// Each scope is one conversation, as on main: a lesson screen and a practice question keep their
/// own.
enum TutorScope: Hashable, Sendable {
  case plan(goalId: String)
  case subject(goalId: String, subjectKey: String)
  case chapter(chapterId: String)
  case mock(blockId: String)
  /// `suggestions` are the lesson's `tutorSuggestions`, each with its `lessonSuggestionID`.
  case lesson(lessonId: String, suggestions: [TutorSuggestion])
  /// The position is 1-based, as the learner sees it.
  case step(
    lessonId: String, stepId: String, stepNumber: Int,
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
    case .lesson(let lessonId, _):
      "lesson:\(lessonId)"
    case .step(_, let stepId, _, _):
      "step:\(stepId)"
    case .item(let itemId, _, _, _):
      "item:\(itemId)"
    }
  }

  /// The lesson's own suggestions, sent by id so everyone who taps one shares its answer.
  var lessonSuggestions: [TutorSuggestion] {
    switch self {
    case .lesson(_, let suggestions), .step(_, _, _, let suggestions):
      suggestions
    case .plan, .subject, .chapter, .mock, .item:
      []
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
