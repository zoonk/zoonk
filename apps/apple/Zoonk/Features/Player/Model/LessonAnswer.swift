import Foundation

/// What the learner picked, built or wrote on a screen, in the shape `POST /v1/steps/{stepId}/checks`
/// takes. It replaces the generated `LessonStepAnswer` (`typeOverrides`) so activities can send
/// their own answer types. A hook's guess never counts, so only the player sees it.
enum LessonAnswer: Codable, Hashable, Sendable {
  struct Pair: Codable, Hashable, Sendable {
    let left: String
    let right: String
  }

  case hookGuess(optionId: String)
  case check(optionId: String)
  case typedAnswer(text: String)
  /// The transcript of a recording, or the typed fallback of a spoken screen.
  case spokenAnswer(text: String)
  case activity(ActivityAnswer)
  case challenge(choiceIds: [String])
  case multipleChoice(selectedOptionId: String)
  case translation(selectedOptionId: String)
  case fillBlank(userAnswers: [String])
  case reading(arrangedWords: [String])
  case listening(arrangedWords: [String])
  case matchColumns(userPairs: [Pair], mistakes: Int)

  private enum CodingKeys: String, CodingKey {
    case answer, arrangedWords, choiceIds, kind, mistakes, optionId, selectedOptionId, text
    case userAnswers, userPairs
  }

  /// Whether the server records it: a hook's guess is the player's alone.
  var isRecorded: Bool {
    if case .hookGuess = self {
      return false
    }

    return true
  }

  init(from decoder: any Decoder) throws {
    let container = try decoder.container(keyedBy: CodingKeys.self)

    switch try container.decode(String.self, forKey: .kind) {
    case "check": self = .check(optionId: try container.decode(String.self, forKey: .optionId))
    case "typedAnswer": self = .typedAnswer(text: try container.decode(String.self, forKey: .text))
    case "spokenAnswer":
      self = .spokenAnswer(text: try container.decode(String.self, forKey: .text))
    case "activity": self = .activity(try container.decode(ActivityAnswer.self, forKey: .answer))
    case "challenge":
      self = .challenge(choiceIds: try container.decode([String].self, forKey: .choiceIds))
    case "multipleChoice":
      self = .multipleChoice(
        selectedOptionId: try container.decode(String.self, forKey: .selectedOptionId))
    case "translation":
      self = .translation(
        selectedOptionId: try container.decode(String.self, forKey: .selectedOptionId))
    case "fillBlank":
      self = .fillBlank(userAnswers: try container.decode([String].self, forKey: .userAnswers))
    case "reading":
      self = .reading(arrangedWords: try container.decode([String].self, forKey: .arrangedWords))
    case "listening":
      self = .listening(arrangedWords: try container.decode([String].self, forKey: .arrangedWords))
    case "matchColumns":
      self = .matchColumns(
        userPairs: try container.decode([Pair].self, forKey: .userPairs),
        mistakes: try container.decode(Int.self, forKey: .mistakes))
    default:
      self = .hookGuess(optionId: try container.decode(String.self, forKey: .optionId))
    }
  }

  func encode(to encoder: any Encoder) throws {
    var container = encoder.container(keyedBy: CodingKeys.self)

    switch self {
    case .hookGuess(let optionId):
      try container.encode("hook", forKey: .kind)
      try container.encode(optionId, forKey: .optionId)
    case .check(let optionId):
      try container.encode("check", forKey: .kind)
      try container.encode(optionId, forKey: .optionId)
    case .typedAnswer(let text):
      try container.encode("typedAnswer", forKey: .kind)
      try container.encode(text, forKey: .text)
    case .spokenAnswer(let text):
      try container.encode("spokenAnswer", forKey: .kind)
      try container.encode(text, forKey: .text)
    case .activity(let answer):
      try container.encode("activity", forKey: .kind)
      try container.encode(answer, forKey: .answer)
    case .challenge(let choiceIds):
      try container.encode("challenge", forKey: .kind)
      try container.encode(choiceIds, forKey: .choiceIds)
    case .multipleChoice(let selectedOptionId):
      try container.encode("multipleChoice", forKey: .kind)
      try container.encode(selectedOptionId, forKey: .selectedOptionId)
    case .translation(let selectedOptionId):
      try container.encode("translation", forKey: .kind)
      try container.encode(selectedOptionId, forKey: .selectedOptionId)
    case .fillBlank(let userAnswers):
      try container.encode("fillBlank", forKey: .kind)
      try container.encode(userAnswers, forKey: .userAnswers)
    case .reading(let arrangedWords):
      try container.encode("reading", forKey: .kind)
      try container.encode(arrangedWords, forKey: .arrangedWords)
    case .listening(let arrangedWords):
      try container.encode("listening", forKey: .kind)
      try container.encode(arrangedWords, forKey: .arrangedWords)
    case .matchColumns(let userPairs, let mistakes):
      try container.encode("matchColumns", forKey: .kind)
      try container.encode(userPairs, forKey: .userPairs)
      try container.encode(mistakes, forKey: .mistakes)
    }
  }
}
