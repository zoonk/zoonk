import Foundation

/// An `activity` screen: one of the Library's interactive templates (`processOrder`,
/// `chartReader`, `numberLine`, ...). The player owns the prompt, the check and the feedback;
/// the template's canvas belongs to its renderer (`ActivityRenderer`), which reads its own
/// `fields` from `payload`.
struct ActivityStepContent: Codable, Hashable, Sendable {
  let template: String
  let prompt: String
  let check: ActivityCheck
  let image: LessonPictureDescription?
  let data: ActivityData?
  /// The whole content as sent, for the renderer to decode its template's `fields`.
  let payload: JSONValue

  private enum CodingKeys: String, CodingKey {
    case check, data, image, prompt, template
  }

  init(from decoder: any Decoder) throws {
    let container = try decoder.container(keyedBy: CodingKeys.self)
    template = try container.decode(String.self, forKey: .template)
    prompt = try container.decode(String.self, forKey: .prompt)
    check = try container.decode(ActivityCheck.self, forKey: .check)
    image = try container.decodeIfPresent(LessonPictureDescription.self, forKey: .image)
    data = try container.decodeIfPresent(ActivityData.self, forKey: .data)
    payload = try JSONValue(from: decoder)
  }

  func encode(to encoder: any Encoder) throws {
    try payload.encode(to: encoder)
  }

  /// The template's own fields, typed by its renderer.
  func fields<Fields: Decodable>(as type: Fields.Type = Fields.self) throws -> Fields {
    try (payload["fields"] ?? .null).decode(as: type)
  }
}

/// An activity template on an explanation screen: a canvas to play with, nothing asked.
struct ActivityExploreContent: Codable, Hashable, Sendable {
  let template: String
  let data: ActivityData?
  let payload: JSONValue

  private enum CodingKeys: String, CodingKey {
    case data, template
  }

  init(from decoder: any Decoder) throws {
    let container = try decoder.container(keyedBy: CodingKeys.self)
    template = try container.decode(String.self, forKey: .template)
    data = try container.decodeIfPresent(ActivityData.self, forKey: .data)
    payload = try JSONValue(from: decoder)
  }

  func encode(to encoder: any Encoder) throws {
    try payload.encode(to: encoder)
  }

  func fields<Fields: Decodable>(as type: Fields.Type = Fields.self) throws -> Fields {
    try (payload["fields"] ?? .null).decode(as: type)
  }
}

/// Where an activity's numbers come from: made up to show the idea, or a real source.
struct ActivityData: Codable, Hashable, Sendable {
  struct Source: Codable, Hashable, Sendable {
    let title: String
    let publisher: String?
    let url: String?
    let year: Int?
  }

  let isExample: Bool?
  let source: Source?
}

/// How an activity is answered. `choice`: options under a canvas to explore. `numeric`: a number
/// the canvas helps find. `interaction`: the canvas's end state is the answer.
enum ActivityCheck: Codable, Hashable, Sendable {
  struct Option: Codable, Hashable, Sendable, Identifiable {
    let id: String
    let isCorrect: Bool
    let reason: String
    let text: String
    let value: Double?
  }

  struct Input: Codable, Hashable, Sendable {
    let name: String
    let value: Double
  }

  struct Tolerance: Codable, Hashable, Sendable {
    enum Kind: String, Codable, Hashable, Sendable {
      case absolute, relative
    }

    let kind: Kind
    let value: Double
  }

  case choice(question: String, options: [Option], inputs: [Input]?, output: String?)
  case numeric(
    question: String, answer: Double, tolerance: Tolerance, unit: String?, explanation: String,
    inputs: [Input]?, output: String?)
  case interaction(explanation: String)

  private enum CodingKeys: String, CodingKey {
    case answer, explanation, inputs, kind, options, output, question, tolerance, unit
  }

  init(from decoder: any Decoder) throws {
    let container = try decoder.container(keyedBy: CodingKeys.self)

    switch try container.decode(String.self, forKey: .kind) {
    case "choice":
      self = .choice(
        question: try container.decode(String.self, forKey: .question),
        options: try container.decode([Option].self, forKey: .options),
        inputs: try container.decodeIfPresent([Input].self, forKey: .inputs),
        output: try container.decodeIfPresent(String.self, forKey: .output))
    case "numeric":
      self = .numeric(
        question: try container.decode(String.self, forKey: .question),
        answer: try container.decode(Double.self, forKey: .answer),
        tolerance: try container.decode(Tolerance.self, forKey: .tolerance),
        unit: try container.decodeIfPresent(String.self, forKey: .unit),
        explanation: try container.decode(String.self, forKey: .explanation),
        inputs: try container.decodeIfPresent([Input].self, forKey: .inputs),
        output: try container.decodeIfPresent(String.self, forKey: .output))
    default:
      self = .interaction(explanation: try container.decode(String.self, forKey: .explanation))
    }
  }

  func encode(to encoder: any Encoder) throws {
    var container = encoder.container(keyedBy: CodingKeys.self)

    switch self {
    case .choice(let question, let options, let inputs, let output):
      try container.encode("choice", forKey: .kind)
      try container.encode(question, forKey: .question)
      try container.encode(options, forKey: .options)
      try container.encodeIfPresent(inputs, forKey: .inputs)
      try container.encodeIfPresent(output, forKey: .output)
    case .numeric(
      let question, let answer, let tolerance, let unit, let explanation, let inputs, let output):
      try container.encode("numeric", forKey: .kind)
      try container.encode(question, forKey: .question)
      try container.encode(answer, forKey: .answer)
      try container.encode(tolerance, forKey: .tolerance)
      try container.encodeIfPresent(unit, forKey: .unit)
      try container.encode(explanation, forKey: .explanation)
      try container.encodeIfPresent(inputs, forKey: .inputs)
      try container.encodeIfPresent(output, forKey: .output)
    case .interaction(let explanation):
      try container.encode("interaction", forKey: .kind)
      try container.encode(explanation, forKey: .explanation)
    }
  }

  var explanation: String? {
    switch self {
    case .choice: nil
    case .numeric(_, _, _, _, let explanation, _, _), .interaction(let explanation): explanation
    }
  }
}

/// The learner's answer to an activity, as `POST /v1/steps/{stepId}/checks` takes it: an object
/// with its `kind` (`choice`, `numeric`, `order`, `assignment`, `selection`, ...). A renderer
/// builds its kind with `init(encoding:)` from its own `Encodable` type.
struct ActivityAnswer: Codable, Hashable, Sendable {
  let value: JSONValue

  init(value: JSONValue) {
    self.value = value
  }

  /// An answer of the renderer's own type, which must encode the API's `kind` field.
  init(encoding answer: some Encodable) throws {
    value = try JSONValue(encoding: answer)
  }

  init(from decoder: any Decoder) throws {
    value = try JSONValue(from: decoder)
  }

  func encode(to encoder: any Encoder) throws {
    try value.encode(to: encoder)
  }

  static func choice(optionId: String) -> ActivityAnswer {
    ActivityAnswer(value: .object(["kind": .string("choice"), "optionId": .string(optionId)]))
  }

  static func numeric(_ number: Double) -> ActivityAnswer {
    ActivityAnswer(value: .object(["kind": .string("numeric"), "value": .number(number)]))
  }

  var kind: String? {
    guard case .string(let kind) = value["kind"] else {
      return nil
    }

    return kind
  }

  var optionId: String? {
    guard case .string(let id) = value["optionId"] else {
      return nil
    }

    return id
  }

  var number: Double? {
    guard case .number(let number) = value["value"] else {
      return nil
    }

    return number
  }

  /// The renderer's own answer type.
  func decode<Answer: Decodable>(as type: Answer.Type = Answer.self) throws -> Answer {
    try value.decode(as: type)
  }
}
