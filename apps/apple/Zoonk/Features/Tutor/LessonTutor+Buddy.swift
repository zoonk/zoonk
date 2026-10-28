import SwiftUI

extension LessonTutor {
  /// The player's Ask: the buddy's panel about the lesson. `LessonTutorScope` doesn't carry the
  /// screen's position yet, which asking about one screen needs, so the panel asks about the
  /// whole lesson.
  static let buddy = LessonTutor { scope, isBeside in
    AnyView(TutorPanel(scope: TutorScope(scope), isPane: isBeside))
  }
}

extension TutorScope {
  init(_ scope: LessonTutorScope) {
    self = .lesson(
      lessonId: scope.lessonId,
      suggestions: scope.suggestions.map { suggestion in
        TutorSuggestion(
          id: suggestion.id.rawValue, label: suggestion.label,
          lessonSuggestionID: suggestion.id.rawValue)
      })
  }
}
