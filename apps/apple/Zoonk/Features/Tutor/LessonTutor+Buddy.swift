import SwiftUI

extension LessonTutor {
  static let buddy = LessonTutor { scope, isBeside in
    AnyView(
      TutorPanel(
        scope: TutorScope(scope), isPane: isBeside,
        draft: scope.startingOffer.map { offer in
          TutorDraft(
            suggestion: TutorSuggestion(offer.suggestion), offer: offer.id,
            sendsAtOnce: offer.sendsAtOnce)
        }))
  }
}

extension TutorSuggestion {
  init(_ suggestion: Components.Schemas.LessonTutorSuggestion) {
    self.init(
      id: suggestion.id.rawValue, label: suggestion.label,
      lessonSuggestionID: suggestion.id.rawValue)
  }
}

extension TutorScope {
  /// Mirrors main's lesson tutor context: the screen in view, its checked answer once the result
  /// shows, or the whole lesson when no screen is in view.
  init(_ scope: LessonTutorScope) {
    let suggestions = scope.suggestions.map(TutorSuggestion.init)

    if let stepId = scope.stepId, let stepNumber = scope.stepNumber {
      self = .step(
        lessonId: scope.lessonId, stepId: stepId, stepNumber: stepNumber, answer: scope.answer,
        suggestions: suggestions)
    } else {
      self = .lesson(lessonId: scope.lessonId, stepIds: scope.stepIds, suggestions: suggestions)
    }
  }
}
