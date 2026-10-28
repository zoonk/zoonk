import SwiftUI

extension LessonTutor {
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
