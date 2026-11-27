import Foundation

/// Each scope is one conversation, as on main: a lesson screen and a practice question keep their
/// own.
enum TutorScope: Hashable, Sendable {
  /// One of the goal's Buddy conversations. A new one's id is the app's, until its first question
  /// makes it.
  case plan(goalId: String, conversationId: String)
  /// `module` on a goal that isn't an exam, whose Plan lists modules: the labels say "module".
  case subject(goalId: String, subjectKey: String, module: Bool)
  case chapter(chapterId: String)
  case mock(blockId: String)
  /// `suggestions` are the lesson's `tutorSuggestions`, each with its `lessonSuggestionID`.
  case lesson(lessonId: String, stepIds: [String], suggestions: [TutorSuggestion])
  /// The position is 1-based, as the learner sees it. `answer` is the learner's, once the screen
  /// shows its result.
  case step(
    lessonId: String, stepId: String, stepNumber: Int, answer: LessonAnswer?,
    suggestions: [TutorSuggestion], mistakeId: String? = nil)
  /// A session's or practice's question: whether it was checked (`answered`), the session block
  /// it's asked in (absent in mistakes practice).
  case item(itemId: String, blockId: String?, answered: Bool, mistakeId: String? = nil)

  /// A checked item or a lesson's suggestions don't start another conversation.
  var conversationKey: String {
    switch self {
    case .plan(let goalId, let conversationId):
      "plan:\(goalId):\(conversationId)"
    case .subject(let goalId, let subjectKey, _):
      "subject:\(goalId):\(subjectKey)"
    case .chapter(let chapterId):
      "chapter:\(chapterId)"
    case .mock(let blockId):
      "mock:\(blockId)"
    case .lesson(let lessonId, _, _):
      "lesson:\(lessonId)"
    case .step(_, let stepId, _, _, _, let mistakeId):
      "step:\(stepId):\(mistakeId ?? "-")"
    case .item(let itemId, _, _, let mistakeId):
      "item:\(itemId):\(mistakeId ?? "-")"
    }
  }

  /// Mirrors main's `isAboutCheckedAnswer`.
  var isAboutCheckedAnswer: Bool {
    switch self {
    case .step(_, _, _, let answer, _, _):
      answer != nil
    case .item(_, _, let answered, _):
      answered
    case .plan, .subject, .chapter, .mock, .lesson:
      false
    }
  }

  /// What the server files a question asked here under, known before it answers.
  var about: TutorTurn.About {
    switch self {
    case .plan: .plan
    case .subject: .subject
    case .chapter: .chapter
    case .mock: .mock
    case .lesson: .lesson
    case .step: isAboutCheckedAnswer ? .answer : .step
    case .item: isAboutCheckedAnswer ? .answer : .item
    }
  }

  /// The lesson screen a question asked here is about.
  var step: TutorTurn.Step? {
    if case .step(_, let stepId, _, _, _, _) = self { .id(stepId) } else { nil }
  }

  var isModule: Bool {
    if case .subject(_, _, true) = self { true } else { false }
  }

  var mistakeId: String? {
    switch self {
    case .step(_, _, _, _, _, let id), .item(_, _, _, let id): id
    default: nil
    }
  }

  var goalId: String? {
    switch self {
    case .plan(let goalId, _), .subject(let goalId, _, _):
      goalId
    case .chapter, .mock, .lesson, .step, .item:
      nil
    }
  }
}
