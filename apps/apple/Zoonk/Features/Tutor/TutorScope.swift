import Foundation

/// What the learner asks their buddy about. Each scope is one conversation, as on main: a lesson
/// screen and a practice question keep their own, and a plan, subject, chapter, lesson or mock has
/// one each.
enum TutorScope: Hashable, Sendable {
  /// The goal's conversation: the Buddy tab, and asking about the plan.
  case plan(goalId: String)
  case subject(goalId: String, subjectKey: String)
  case chapter(chapterId: String)
  /// A finished mock exam.
  case mock(blockId: String)
  /// A lesson as a whole. `suggestions` are the lesson's `tutorSuggestions`, each with its `lessonSuggestionID`.
  case lesson(lessonId: String, suggestions: [TutorSuggestion])
  /// One lesson screen, by its id and its 1-based position as the learner sees it.
  case step(
    lessonId: String, stepId: String, stepNumber: Int,
    suggestions: [TutorSuggestion])
  /// A session's or practice's question: whether it was checked (`answered`), the session block
  /// it's asked in (absent in mistakes practice), and whether the learner missed it.
  case item(itemId: String, blockId: String?, answered: Bool, missed: Bool)

  /// The conversation the scope reads: a checked item or a lesson's suggestions don't start
  /// another one.
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

  /// The goal a plan change proposed in this conversation belongs to.
  var goalId: String? {
    switch self {
    case .plan(let goalId), .subject(let goalId, _):
      goalId
    case .chapter, .mock, .lesson, .step, .item:
      nil
    }
  }
}
