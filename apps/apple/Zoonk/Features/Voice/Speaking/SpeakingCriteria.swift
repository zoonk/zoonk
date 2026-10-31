import Foundation

/// Mirrors main's `useCriterionGloss` and `useCriterionName`. An unknown key keeps its official name.
func speakingCriterionName(_ key: String, officialName: String?) -> String {
  switch key {
  case "accuracy":
    String(localized: "Accuracy", table: "Voice", comment: "A speaking criterion")
  case "coherence":
    String(localized: "Coherence", table: "Voice", comment: "A speaking criterion")
  case "discourse":
    String(localized: "Organizing what you say", table: "Voice", comment: "A speaking criterion")
  case "fluency":
    String(localized: "Fluency", table: "Voice", comment: "A speaking criterion")
  case "global", "holistic":
    String(localized: "Overall impression", table: "Voice", comment: "A speaking criterion")
  case "grammarVocabulary":
    String(localized: "Grammar and vocabulary", table: "Voice", comment: "A speaking criterion")
  case "interaction":
    String(localized: "Interaction", table: "Voice", comment: "A speaking criterion")
  case "interviewer":
    String(
      localized: "The examiner's overall rating", table: "Voice", comment: "A speaking criterion")
  case "language":
    String(localized: "Language", table: "Voice", comment: "A speaking criterion")
  case "languageUse":
    String(localized: "Use of language", table: "Voice", comment: "A speaking criterion")
  case "lexis":
    String(localized: "Vocabulary", table: "Voice", comment: "A speaking criterion")
  case "questions":
    String(localized: "Questions and answers", table: "Voice", comment: "A speaking criterion")
  case "range":
    String(localized: "Range of language", table: "Voice", comment: "A speaking criterion")
  case "taskCompletion":
    String(localized: "Doing the task", table: "Voice", comment: "A speaking criterion")
  case "delivery":
    String(localized: "Pace and pronunciation", table: "Voice", comment: "A speaking criterion")
  case "elaboration":
    String(localized: "Clear, developed answers", table: "Voice", comment: "A speaking criterion")
  case "fluencyCoherence":
    String(localized: "Fluency and coherence", table: "Voice", comment: "A speaking criterion")
  case "grammar":
    String(localized: "Grammar", table: "Voice", comment: "A speaking criterion")
  case "lexicalResource", "vocabulary":
    String(localized: "Vocabulary", table: "Voice", comment: "A speaking criterion")
  case "pronunciation":
    String(localized: "Pronunciation", table: "Voice", comment: "A speaking criterion")
  case "repetition":
    String(localized: "Repeating sentences", table: "Voice", comment: "A speaking criterion")
  default:
    officialName ?? key
  }
}
