import SwiftUI

extension LessonTutor {
  static let buddy = LessonTutor { scope, isBeside in
    let tutorScope = TutorScope(scope)

    return AnyView(
      TutorPanel(
        scope: tutorScope, isPane: isBeside,
        draft: scope.startingOffer.flatMap { offer in
          tutorScope.lessonSuggestions.first { $0.id == offer.suggestionId }.map {
            TutorDraft(suggestion: $0, offer: offer.id)
          }
        }))
  }
}

extension TutorScope {
  /// Mirrors main's lesson tutor context: the screen in view, its checked answer once the result
  /// shows, or the whole lesson when no screen is in view.
  init(_ scope: LessonTutorScope) {
    let suggestions = scope.suggestions.map { suggestion in
      TutorSuggestion(
        id: suggestion.id.rawValue, label: suggestion.label,
        lessonSuggestionID: suggestion.id.rawValue)
    }

    if let stepId = scope.stepId, let stepNumber = scope.stepNumber {
      self = .step(
        lessonId: scope.lessonId, stepId: stepId, stepNumber: stepNumber, answer: scope.answer,
        suggestions: suggestions)
    } else {
      self = .lesson(lessonId: scope.lessonId, stepIds: scope.stepIds, suggestions: suggestions)
    }
  }
}
