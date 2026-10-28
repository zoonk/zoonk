import Foundation

/// Replaces the generated `PlayableLibraryStep` (`typeOverrides` in `openapi-generator-config.yaml`).
public struct LessonStep: Codable, Hashable, Sendable, Identifiable {
  public let id: String
  public let position: Int
  public let skillId: String?
  public let citation: LessonCitation?
  public let image: LessonStepImage?
  public let imagePending: Bool
  /// By option id.
  public let optionPictures: [String: LessonStepImage]
  /// Epoch milliseconds.
  public let pictureWaitStartedAt: Int?
  public let content: LessonStepContent

  public var kind: LessonStepKind { content.kind }

  private enum CodingKeys: String, CodingKey {
    case citation, content, exercise, id, image, imagePending, kind, listening, optionPictures
    case pictureWaitStartedAt, position, skillId, wordHints
  }

  public init(
    id: String,
    position: Int,
    skillId: String? = nil,
    citation: LessonCitation? = nil,
    image: LessonStepImage? = nil,
    imagePending: Bool = false,
    optionPictures: [String: LessonStepImage] = [:],
    pictureWaitStartedAt: Int? = nil,
    content: LessonStepContent
  ) {
    self.id = id
    self.position = position
    self.skillId = skillId
    self.citation = citation
    self.image = image
    self.imagePending = imagePending
    self.optionPictures = optionPictures
    self.pictureWaitStartedAt = pictureWaitStartedAt
    self.content = content
  }

  public init(from decoder: any Decoder) throws {
    let container = try decoder.container(keyedBy: CodingKeys.self)
    id = try container.decode(String.self, forKey: .id)
    position = try container.decode(Int.self, forKey: .position)
    skillId = try container.decodeIfPresent(String.self, forKey: .skillId)
    citation = try container.decodeIfPresent(LessonCitation.self, forKey: .citation)
    image = try container.decodeIfPresent(LessonStepImage.self, forKey: .image)
    imagePending = try container.decodeIfPresent(Bool.self, forKey: .imagePending) ?? false
    optionPictures =
      try container.decodeIfPresent([String: LessonStepImage].self, forKey: .optionPictures) ?? [:]
    pictureWaitStartedAt = try container.decodeIfPresent(Int.self, forKey: .pictureWaitStartedAt)

    let kind = try container.decode(String.self, forKey: .kind)

    switch kind {
    case "hook":
      content = .hook(try container.decode(HookContent.self, forKey: .content))
    case "explanation":
      content = .explanation(try container.decode(ExplanationContent.self, forKey: .content))
    case "workedExample":
      content = .workedExample(try container.decode(WorkedExampleContent.self, forKey: .content))
    case "check":
      content = .check(try container.decode(CheckContent.self, forKey: .content))
    case "typedAnswer":
      content = .typedAnswer(try container.decode(TypedAnswerContent.self, forKey: .content))
    case "spokenAnswer":
      content = .spokenAnswer(
        try container.decode(SpokenAnswerContent.self, forKey: .content),
        listening: try container.decodeIfPresent(LanguageExercise.self, forKey: .listening))
    case "activity":
      content = .activity(try container.decode(ActivityStepContent.self, forKey: .content))
    case "summary":
      content = .summary(try container.decode(SummaryContent.self, forKey: .content))
    case "challenge":
      content = .challenge(try container.decode(ChallengeContent.self, forKey: .content))
    default:
      content = .language(
        try container.decode(LanguageExercise.self, forKey: .exercise),
        wordHints: try container.decodeIfPresent(WordHints.self, forKey: .wordHints))
    }
  }

  public func encode(to encoder: any Encoder) throws {
    var container = encoder.container(keyedBy: CodingKeys.self)
    try container.encode(id, forKey: .id)
    try container.encode(position, forKey: .position)
    try container.encode(skillId, forKey: .skillId)
    try container.encode(kind.rawValue, forKey: .kind)

    if case .language(let exercise, let wordHints) = content {
      try container.encode(exercise, forKey: .exercise)
      try container.encode(wordHints, forKey: .wordHints)
      return
    }

    try container.encode(citation, forKey: .citation)
    try container.encode(image, forKey: .image)
    try container.encode(imagePending, forKey: .imagePending)
    try container.encode(optionPictures, forKey: .optionPictures)
    try container.encodeIfPresent(pictureWaitStartedAt, forKey: .pictureWaitStartedAt)

    switch content {
    case .hook(let value): try container.encode(value, forKey: .content)
    case .explanation(let value): try container.encode(value, forKey: .content)
    case .workedExample(let value): try container.encode(value, forKey: .content)
    case .check(let value): try container.encode(value, forKey: .content)
    case .typedAnswer(let value): try container.encode(value, forKey: .content)
    case .spokenAnswer(let value, let listening):
      try container.encode(value, forKey: .content)
      try container.encode(listening, forKey: .listening)
    case .activity(let value): try container.encode(value, forKey: .content)
    case .summary(let value): try container.encode(value, forKey: .content)
    case .challenge(let value): try container.encode(value, forKey: .content)
    case .language: break
    }
  }
}

extension LessonStep {
  public func withPictures(from fresh: LessonStep) -> LessonStep {
    LessonStep(
      id: id, position: position, skillId: skillId, citation: citation,
      image: fresh.image ?? image, imagePending: fresh.imagePending,
      optionPictures: optionPictures.merging(fresh.optionPictures) { _, drawn in drawn },
      pictureWaitStartedAt: pictureWaitStartedAt, content: content)
  }

  public var withoutPendingPictures: LessonStep {
    LessonStep(
      id: id, position: position, skillId: skillId, citation: citation, image: image,
      imagePending: false, optionPictures: optionPictures,
      pictureWaitStartedAt: pictureWaitStartedAt, content: content)
  }

  public func isWaitingForPicture(openedAt: Date, now: Date = .now) -> Bool {
    guard imagePending else {
      return false
    }

    let start =
      pictureWaitStartedAt.map { Date(timeIntervalSince1970: Double($0) / 1000) } ?? openedAt
    return now.timeIntervalSince(start) < 5 * 60
  }
}

public enum LessonStepKind: String, Hashable, Sendable {
  case activity, alphabet, challenge, check, explanation, fillBlank, hook, listening
  case matchColumns, multipleChoice, reading, spokenAnswer, summary, translation, typedAnswer
  case vocabulary, workedExample
}

public enum LessonStepContent: Hashable, Sendable {
  case hook(HookContent)
  case explanation(ExplanationContent)
  case workedExample(WorkedExampleContent)
  case check(CheckContent)
  case typedAnswer(TypedAnswerContent)
  /// `listening` is the same sentence as a listening exercise, for "I can't talk now".
  case spokenAnswer(SpokenAnswerContent, listening: LanguageExercise?)
  case activity(ActivityStepContent)
  case summary(SummaryContent)
  case challenge(ChallengeContent)
  case language(LanguageExercise, wordHints: WordHints?)

  public var kind: LessonStepKind {
    switch self {
    case .hook: .hook
    case .explanation: .explanation
    case .workedExample: .workedExample
    case .check: .check
    case .typedAnswer: .typedAnswer
    case .spokenAnswer: .spokenAnswer
    case .activity: .activity
    case .summary: .summary
    case .challenge: .challenge
    case .language(let exercise, _): exercise.kind
    }
  }
}

public struct LessonStepImage: Codable, Hashable, Sendable {
  public let id: String
  public let url: String
  public let alt: String?
  public let width: Int?
  public let height: Int?
}

public struct LessonPictureDescription: Codable, Hashable, Sendable {
  public let alt: String
  public let prompt: String
  public let parts: [String]?
}

public enum LessonCitation: Codable, Hashable, Sendable {
  case material(title: String, unit: String, page: Int?)
  case source(title: String, publisher: String?, url: String?, checkedAt: String)
  case notInMaterial

  private enum CodingKeys: String, CodingKey {
    case checkedAt, kind, page, publisher, title, unit, url
  }

  public init(from decoder: any Decoder) throws {
    let container = try decoder.container(keyedBy: CodingKeys.self)

    switch try container.decode(String.self, forKey: .kind) {
    case "material":
      self = .material(
        title: try container.decode(String.self, forKey: .title),
        unit: try container.decode(String.self, forKey: .unit),
        page: try container.decodeIfPresent(Int.self, forKey: .page))
    case "source":
      self = .source(
        title: try container.decode(String.self, forKey: .title),
        publisher: try container.decodeIfPresent(String.self, forKey: .publisher),
        url: try container.decodeIfPresent(String.self, forKey: .url),
        checkedAt: try container.decode(String.self, forKey: .checkedAt))
    default:
      self = .notInMaterial
    }
  }

  public func encode(to encoder: any Encoder) throws {
    var container = encoder.container(keyedBy: CodingKeys.self)

    switch self {
    case .material(let title, let unit, let page):
      try container.encode("material", forKey: .kind)
      try container.encode(title, forKey: .title)
      try container.encode(unit, forKey: .unit)
      try container.encode(page, forKey: .page)
    case .source(let title, let publisher, let url, let checkedAt):
      try container.encode("source", forKey: .kind)
      try container.encode(title, forKey: .title)
      try container.encode(publisher, forKey: .publisher)
      try container.encode(url, forKey: .url)
      try container.encode(checkedAt, forKey: .checkedAt)
    case .notInMaterial:
      try container.encode("notInMaterial", forKey: .kind)
    }
  }
}

public struct LessonBasis: Codable, Hashable, Sendable {
  public let position: Int
  public let quote: String
}

public enum LessonVisual: Codable, Hashable, Sendable {
  case chart(LessonChart)
  case timeline(LessonTimeline)

  private enum CodingKeys: String, CodingKey {
    case kind
  }

  public init(from decoder: any Decoder) throws {
    let kind = try decoder.container(keyedBy: CodingKeys.self).decode(String.self, forKey: .kind)
    self =
      kind == "timeline"
      ? .timeline(try LessonTimeline(from: decoder)) : .chart(try LessonChart(from: decoder))
  }

  public func encode(to encoder: any Encoder) throws {
    var container = encoder.container(keyedBy: CodingKeys.self)

    switch self {
    case .chart(let chart):
      try container.encode("chart", forKey: .kind)
      try chart.encode(to: encoder)
    case .timeline(let timeline):
      try container.encode("timeline", forKey: .kind)
      try timeline.encode(to: encoder)
    }
  }
}

public struct LessonChart: Codable, Hashable, Sendable {
  public struct Series: Codable, Hashable, Sendable {
    public let name: String
    public let values: [Double]
  }

  public enum Style: String, Codable, Hashable, Sendable {
    case bar, line
  }

  public let chart: Style
  public let title: String
  public let categoryLabel: String
  public let valueLabel: String
  public let unit: String?
  public let axisStart: Double?
  public let categories: [String]
  public let series: [Series]
  public let source: String?
}

public struct LessonTimeline: Codable, Hashable, Sendable {
  public struct Event: Codable, Hashable, Sendable {
    public let date: String
    public let label: String
    public let detail: String?
  }

  public let title: String
  public let events: [Event]
}

public struct HookContent: Codable, Hashable, Sendable {
  public struct Option: Codable, Hashable, Sendable, Identifiable {
    public let id: String
    public let isCorrect: Bool
    public let text: String
  }

  public enum Variant: String, Codable, Hashable, Sendable {
    case guess, text
  }

  public let variant: Variant
  public let text: String?
  public let question: String?
  public let options: [Option]?
  public let reveal: String?
  public let image: LessonPictureDescription?
  public let visual: LessonVisual?
}

public struct ExplanationContent: Codable, Hashable, Sendable {
  public struct ExampleLineSlot: Codable, Hashable, Sendable {
    public let idea: String
  }

  public let title: String?
  public let text: String
  public let image: LessonPictureDescription?
  public let visual: LessonVisual?
  public let explore: ActivityExploreContent?
  public let exampleLineSlot: ExampleLineSlot?
}

public struct WorkedExampleContent: Codable, Hashable, Sendable {
  public struct Step: Codable, Hashable, Sendable {
    public let text: String
    public let math: String?
  }

  public let title: String?
  public let problem: String
  public let steps: [Step]
  public let result: String
  public let image: LessonPictureDescription?
  public let visual: LessonVisual?
}

public struct CheckContent: Codable, Hashable, Sendable {
  public struct Option: Codable, Hashable, Sendable, Identifiable {
    public struct Picture: Codable, Hashable, Sendable {
      public let alt: String
      public let prompt: String
    }

    public let id: String
    public let isCorrect: Bool
    public let reason: String
    public let text: String
    /// The drawn picture comes in the step's `optionPictures`.
    public let picture: Picture?
  }

  public let question: String
  public let context: String?
  public let options: [Option]
  public let basis: LessonBasis?
  public let image: LessonPictureDescription?
  public let visual: LessonVisual?
}

public struct TypedAnswerContent: Codable, Hashable, Sendable {
  public let question: String
  public let context: String?
  public let acceptedAnswers: [String]?
  public let keyPoints: [String]
  public let sampleAnswer: String
  public let basis: LessonBasis?
  public let visual: LessonVisual?
}

public struct SpokenAnswerContent: Codable, Hashable, Sendable {
  public let language: String
  public let prompt: String
  public let targetText: String
  public let romanization: String?
  public let translation: String?
}

public struct SummaryContent: Codable, Hashable, Sendable {
  public struct Idea: Codable, Hashable, Sendable {
    public let text: String
  }

  public let ideas: [Idea]
}

public struct WordHints: Codable, Hashable, Sendable {
  public let note: String?
  public let pronunciationTip: String?
}

/// `content` holds the fields of its kind; the other kinds read the sentence, the word and the
/// option lists around it.
public struct LanguageExercise: Codable, Hashable, Sendable {
  public struct Content: Codable, Hashable, Sendable {
    public struct Form: Codable, Hashable, Sendable {
      public let label: String
      public let symbol: String
    }

    public struct Pair: Codable, Hashable, Sendable {
      public let left: String
      public let right: String
    }

    public struct Option: Codable, Hashable, Sendable, Identifiable {
      public let id: String
      public let isCorrect: Bool
      public let text: String
      public let feedback: String
    }

    public struct Picture: Codable, Hashable, Sendable {
      public let prompt: String
      public let url: String?
    }

    // alphabet
    public let symbol: String?
    public let readingAid: String?
    public let pronunciation: String?
    public let audioText: String?
    public let audioUrl: String?
    public let forms: [Form]?
    // fillBlank
    public let template: String?
    public let answers: [String]?
    public let distractors: [String]?
    public let feedback: String?
    public let romanizations: [String: String]?
    // matchColumns
    public let pairs: [Pair]?
    // multipleChoice
    public let context: String?
    public let image: Picture?
    public let options: [Option]?
    // fillBlank, matchColumns and multipleChoice
    public let question: String?
  }

  public struct WordOption: Codable, Hashable, Sendable {
    public let word: String
    public let audioUrl: String?
    public let romanization: String?
    public let translation: String?
  }

  public struct TranslationOption: Codable, Hashable, Sendable, Identifiable {
    public let id: String
    public let word: String
    public let audioUrl: String?
    public let romanization: String?
  }

  public struct Sentence: Codable, Hashable, Sendable {
    public let id: String
    public let sentence: String
    public let translation: String
    public let explanation: String?
    public let audioUrl: String?
    public let romanization: String?
    public let distractors: [String]
    public let translationDistractors: [String]
  }

  public struct Word: Codable, Hashable, Sendable, Identifiable {
    public let id: String
    public let word: String
    public let translation: String
    public let audioUrl: String?
    public let pronunciation: String?
    public let romanization: String?
    public let distractors: [String]
  }

  public let id: String
  public let kind: LessonStepKind
  public let content: Content
  public let sentence: Sentence?
  public let word: Word?
  public let wordBankOptions: [WordOption]
  public let sentenceWordOptions: [WordOption]
  public let fillBlankOptions: [WordOption]
  public let translationOptions: [TranslationOption]
  public let vocabularyOptions: [Word]
  public let matchColumnsRightItems: [String]

  private enum CodingKeys: String, CodingKey {
    case content, fillBlankOptions, id, kind, matchColumnsRightItems, sentence, sentenceWordOptions
    case translationOptions, vocabularyOptions, word, wordBankOptions
  }

  public init(from decoder: any Decoder) throws {
    let container = try decoder.container(keyedBy: CodingKeys.self)
    id = try container.decode(String.self, forKey: .id)
    let kindName = try container.decode(String.self, forKey: .kind)

    guard let kind = LessonStepKind(rawValue: kindName) else {
      throw DecodingError.dataCorruptedError(
        forKey: .kind, in: container, debugDescription: "Unknown exercise \(kindName)")
    }

    self.kind = kind
    content = try container.decode(Content.self, forKey: .content)
    sentence = try container.decodeIfPresent(Sentence.self, forKey: .sentence)
    word = try container.decodeIfPresent(Word.self, forKey: .word)
    wordBankOptions = try container.decode([WordOption].self, forKey: .wordBankOptions)
    sentenceWordOptions = try container.decode([WordOption].self, forKey: .sentenceWordOptions)
    fillBlankOptions = try container.decode([WordOption].self, forKey: .fillBlankOptions)
    translationOptions = try container.decode([TranslationOption].self, forKey: .translationOptions)
    vocabularyOptions = try container.decode([Word].self, forKey: .vocabularyOptions)
    matchColumnsRightItems = try container.decode([String].self, forKey: .matchColumnsRightItems)
  }

  public func encode(to encoder: any Encoder) throws {
    var container = encoder.container(keyedBy: CodingKeys.self)
    try container.encode(id, forKey: .id)
    try container.encode(kind.rawValue, forKey: .kind)
    try container.encode(content, forKey: .content)
    try container.encode(sentence, forKey: .sentence)
    try container.encode(word, forKey: .word)
    try container.encode(wordBankOptions, forKey: .wordBankOptions)
    try container.encode(sentenceWordOptions, forKey: .sentenceWordOptions)
    try container.encode(fillBlankOptions, forKey: .fillBlankOptions)
    try container.encode(translationOptions, forKey: .translationOptions)
    try container.encode(vocabularyOptions, forKey: .vocabularyOptions)
    try container.encode(matchColumnsRightItems, forKey: .matchColumnsRightItems)
  }
}
