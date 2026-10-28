import Foundation

/// One screen of a Library lesson as `GET /v1/library/lessons/{lessonId}` sends it, answers
/// included so feedback is instant. It replaces the generated `PlayableLibraryStep`
/// (`typeOverrides` in `openapi-generator-config.yaml`): the generated union of every screen and
/// activity template is index-named and far larger than what the player reads.
struct LessonStep: Codable, Hashable, Sendable, Identifiable {
  let id: String
  let position: Int
  /// The skill the screen teaches or checks, when it has its own.
  let skillId: String?
  let citation: LessonCitation?
  /// The drawn picture, once it's ready.
  let image: LessonStepImage?
  /// The picture is still being drawn.
  let imagePending: Bool
  let content: LessonStepContent

  var kind: LessonStepKind { content.kind }

  private enum CodingKeys: String, CodingKey {
    case citation, content, exercise, id, image, imagePending, kind, listening, position, skillId
    case wordHints
  }

  init(
    id: String,
    position: Int,
    skillId: String? = nil,
    citation: LessonCitation? = nil,
    image: LessonStepImage? = nil,
    imagePending: Bool = false,
    content: LessonStepContent
  ) {
    self.id = id
    self.position = position
    self.skillId = skillId
    self.citation = citation
    self.image = image
    self.imagePending = imagePending
    self.content = content
  }

  init(from decoder: any Decoder) throws {
    let container = try decoder.container(keyedBy: CodingKeys.self)
    id = try container.decode(String.self, forKey: .id)
    position = try container.decode(Int.self, forKey: .position)
    skillId = try container.decodeIfPresent(String.self, forKey: .skillId)
    citation = try container.decodeIfPresent(LessonCitation.self, forKey: .citation)
    image = try container.decodeIfPresent(LessonStepImage.self, forKey: .image)
    imagePending = try container.decodeIfPresent(Bool.self, forKey: .imagePending) ?? false

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

  func encode(to encoder: any Encoder) throws {
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

enum LessonStepKind: String, Hashable, Sendable {
  case activity, alphabet, challenge, check, explanation, fillBlank, hook, listening
  case matchColumns, multipleChoice, reading, spokenAnswer, summary, translation, typedAnswer
  case vocabulary, workedExample
}

enum LessonStepContent: Hashable, Sendable {
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
  /// Language practice: vocabulary, alphabet, reading, listening, translation, fill in the blank,
  /// multiple choice and match columns.
  case language(LanguageExercise, wordHints: WordHints?)

  var kind: LessonStepKind {
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

// MARK: - Shared parts

/// The drawn picture of a screen.
struct LessonStepImage: Codable, Hashable, Sendable {
  let id: String
  let url: String
  let alt: String?
  let width: Int?
  let height: Int?
}

/// What a screen's picture shows, written with the screen: its description reads while the
/// picture is drawn or when it can't load.
struct LessonPictureDescription: Codable, Hashable, Sendable {
  let alt: String
  let prompt: String
  /// The numbered parts of a labeled picture.
  let parts: [String]?
}

/// Where a screen comes from: the learner's own material, a public document, or neither.
enum LessonCitation: Codable, Hashable, Sendable {
  case material(title: String, unit: String, page: Int?)
  case source(title: String, publisher: String?, url: String?, checkedAt: String)
  case notInMaterial

  private enum CodingKeys: String, CodingKey {
    case checkedAt, kind, page, publisher, title, unit, url
  }

  init(from decoder: any Decoder) throws {
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

  func encode(to encoder: any Encoder) throws {
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

/// The passage of the learner's material a question is about.
struct LessonBasis: Codable, Hashable, Sendable {
  let position: Int
  let quote: String
}

/// A chart or a timeline drawn from data on a screen.
enum LessonVisual: Codable, Hashable, Sendable {
  case chart(LessonChart)
  case timeline(LessonTimeline)

  private enum CodingKeys: String, CodingKey {
    case kind
  }

  init(from decoder: any Decoder) throws {
    let kind = try decoder.container(keyedBy: CodingKeys.self).decode(String.self, forKey: .kind)
    self =
      kind == "timeline"
      ? .timeline(try LessonTimeline(from: decoder)) : .chart(try LessonChart(from: decoder))
  }

  func encode(to encoder: any Encoder) throws {
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

struct LessonChart: Codable, Hashable, Sendable {
  struct Series: Codable, Hashable, Sendable {
    let name: String
    let values: [Double]
  }

  enum Style: String, Codable, Hashable, Sendable {
    case bar, line
  }

  let chart: Style
  let title: String
  let categoryLabel: String
  let valueLabel: String
  let unit: String?
  let axisStart: Double?
  let categories: [String]
  let series: [Series]
  let source: String?
}

struct LessonTimeline: Codable, Hashable, Sendable {
  struct Event: Codable, Hashable, Sendable {
    let date: String
    let label: String
    let detail: String?
  }

  let title: String
  let events: [Event]
}

// MARK: - Teaching screens

struct HookContent: Codable, Hashable, Sendable {
  struct Option: Codable, Hashable, Sendable, Identifiable {
    let id: String
    let isCorrect: Bool
    let text: String
  }

  enum Variant: String, Codable, Hashable, Sendable {
    case guess, text
  }

  let variant: Variant
  /// A text hook's words.
  let text: String?
  /// A guess hook's question, options and the why shown after any pick.
  let question: String?
  let options: [Option]?
  let reveal: String?
  let image: LessonPictureDescription?
  let visual: LessonVisual?
}

struct ExplanationContent: Codable, Hashable, Sendable {
  struct ExampleLineSlot: Codable, Hashable, Sendable {
    let idea: String
  }

  let title: String?
  let text: String
  let image: LessonPictureDescription?
  let visual: LessonVisual?
  /// An activity template to play with: nothing is asked or graded.
  let explore: ActivityExploreContent?
  /// Where a personal example line fits, when the screen has room for one.
  let exampleLineSlot: ExampleLineSlot?
}

struct WorkedExampleContent: Codable, Hashable, Sendable {
  struct Step: Codable, Hashable, Sendable {
    let text: String
    let math: String?
  }

  let title: String?
  let problem: String
  let steps: [Step]
  let result: String
  let image: LessonPictureDescription?
  let visual: LessonVisual?
}

struct CheckContent: Codable, Hashable, Sendable {
  struct Option: Codable, Hashable, Sendable, Identifiable {
    struct Picture: Codable, Hashable, Sendable {
      let alt: String
      let prompt: String
    }

    let id: String
    let isCorrect: Bool
    let reason: String
    let text: String
    /// Picture options: the drawn picture comes with the step's pictures.
    let picture: Picture?
  }

  let question: String
  let context: String?
  let options: [Option]
  let basis: LessonBasis?
  let image: LessonPictureDescription?
  let visual: LessonVisual?
}

struct TypedAnswerContent: Codable, Hashable, Sendable {
  let question: String
  let context: String?
  let acceptedAnswers: [String]?
  let keyPoints: [String]
  let sampleAnswer: String
  let basis: LessonBasis?
  let visual: LessonVisual?
}

struct SpokenAnswerContent: Codable, Hashable, Sendable {
  let language: String
  let prompt: String
  let targetText: String
  let romanization: String?
  let translation: String?
}

struct SummaryContent: Codable, Hashable, Sendable {
  struct Idea: Codable, Hashable, Sendable {
    let text: String
  }

  let ideas: [Idea]
}

// MARK: - Language exercises

struct WordHints: Codable, Hashable, Sendable {
  let note: String?
  let pronunciationTip: String?
}

/// A language exercise. `content` holds the fields of its kind (`alphabet`, `fillBlank`,
/// `matchColumns` and `multipleChoice`); the other kinds read the sentence, the word and the
/// option lists around it.
struct LanguageExercise: Codable, Hashable, Sendable {
  struct Content: Codable, Hashable, Sendable {
    struct Form: Codable, Hashable, Sendable {
      let label: String
      let symbol: String
    }

    struct Pair: Codable, Hashable, Sendable {
      let left: String
      let right: String
    }

    struct Option: Codable, Hashable, Sendable, Identifiable {
      let id: String
      let isCorrect: Bool
      let text: String
      let feedback: String
    }

    struct Picture: Codable, Hashable, Sendable {
      let prompt: String
      let url: String?
    }

    // alphabet
    let symbol: String?
    let readingAid: String?
    let pronunciation: String?
    let audioText: String?
    let audioUrl: String?
    let forms: [Form]?
    // fillBlank
    let template: String?
    let answers: [String]?
    let distractors: [String]?
    let feedback: String?
    let romanizations: [String: String]?
    // matchColumns
    let pairs: [Pair]?
    // multipleChoice
    let context: String?
    let image: Picture?
    let options: [Option]?
    // fillBlank, matchColumns and multipleChoice
    let question: String?
  }

  struct WordOption: Codable, Hashable, Sendable {
    let word: String
    let audioUrl: String?
    let romanization: String?
    let translation: String?
  }

  struct TranslationOption: Codable, Hashable, Sendable, Identifiable {
    let id: String
    let word: String
    let audioUrl: String?
    let romanization: String?
  }

  struct Sentence: Codable, Hashable, Sendable {
    let id: String
    let sentence: String
    let translation: String
    let explanation: String?
    let audioUrl: String?
    let romanization: String?
    let distractors: [String]
    let translationDistractors: [String]
  }

  struct Word: Codable, Hashable, Sendable, Identifiable {
    let id: String
    let word: String
    let translation: String
    let audioUrl: String?
    let pronunciation: String?
    let romanization: String?
    let distractors: [String]
  }

  let id: String
  let kind: LessonStepKind
  let content: Content
  let sentence: Sentence?
  let word: Word?
  let wordBankOptions: [WordOption]
  let sentenceWordOptions: [WordOption]
  let fillBlankOptions: [WordOption]
  let translationOptions: [TranslationOption]
  let vocabularyOptions: [Word]
  let matchColumnsRightItems: [String]

  private enum CodingKeys: String, CodingKey {
    case content, fillBlankOptions, id, kind, matchColumnsRightItems, sentence, sentenceWordOptions
    case translationOptions, vocabularyOptions, word, wordBankOptions
  }

  init(from decoder: any Decoder) throws {
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

  func encode(to encoder: any Encoder) throws {
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
