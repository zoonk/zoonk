import Foundation

/// The player owns the prompt, the check and the feedback; the template's renderer reads its own
/// `fields` from `payload`.
public struct ActivityStepContent: Codable, Hashable, Sendable {
  public let template: String
  public let prompt: String
  public let check: ActivityCheck
  public let image: LessonPictureDescription?
  public let data: ActivityData?
  public let payload: JSONValue
  /// Sent on the step beside `content`, so `LessonStep` fills it in.
  public internal(set) var minTolerance: ActivityCheck.Tolerance?
  /// Sent on the step beside `content`, so `LessonStep` fills it in.
  public internal(set) var baseMap: ActivityBaseMap?

  private enum CodingKeys: String, CodingKey {
    case check, data, image, prompt, template
  }

  public init(from decoder: any Decoder) throws {
    let container = try decoder.container(keyedBy: CodingKeys.self)
    template = try container.decode(String.self, forKey: .template)
    prompt = try container.decode(String.self, forKey: .prompt)
    check = try container.decode(ActivityCheck.self, forKey: .check)
    image = try container.decodeIfPresent(LessonPictureDescription.self, forKey: .image)
    data = try container.decodeIfPresent(ActivityData.self, forKey: .data)
    payload = try JSONValue(from: decoder)
  }

  public func encode(to encoder: any Encoder) throws {
    try payload.encode(to: encoder)
  }

  public func fields<Fields: Decodable>(as type: Fields.Type = Fields.self) throws -> Fields {
    try (payload["fields"] ?? .null).decode(as: type)
  }
}

public struct ActivityExploreContent: Codable, Hashable, Sendable {
  public let template: String
  public let data: ActivityData?
  public let payload: JSONValue
  /// Sent on the step beside `content`, so `LessonStep` fills it in.
  public internal(set) var baseMap: ActivityBaseMap?

  private enum CodingKeys: String, CodingKey {
    case data, template
  }

  public init(from decoder: any Decoder) throws {
    let container = try decoder.container(keyedBy: CodingKeys.self)
    template = try container.decode(String.self, forKey: .template)
    data = try container.decodeIfPresent(ActivityData.self, forKey: .data)
    payload = try JSONValue(from: decoder)
  }

  public func encode(to encoder: any Encoder) throws {
    try payload.encode(to: encoder)
  }

  public func fields<Fields: Decodable>(as type: Fields.Type = Fields.self) throws -> Fields {
    try (payload["fields"] ?? .null).decode(as: type)
  }
}

public struct ActivityData: Codable, Hashable, Sendable {
  public struct Source: Codable, Hashable, Sendable {
    public let title: String
    public let publisher: String?
    public let url: String?
    public let year: Int?
  }

  public let isExample: Bool?
  public let source: Source?
}

/// `interaction`: the canvas's end state is the answer.
public enum ActivityCheck: Codable, Hashable, Sendable {
  public struct Option: Codable, Hashable, Sendable, Identifiable {
    public let id: String
    public let isCorrect: Bool
    public let reason: String
    public let text: String
    public let value: Double?
  }

  public struct Input: Codable, Hashable, Sendable {
    public let name: String
    public let value: Double
  }

  public struct Tolerance: Codable, Hashable, Sendable {
    public enum Kind: String, Codable, Hashable, Sendable {
      case absolute, relative
    }

    public let kind: Kind
    public let value: Double

    public init(kind: Kind, value: Double) {
      self.kind = kind
      self.value = value
    }
  }

  case choice(question: String, options: [Option], inputs: [Input]?, output: String?)
  case numeric(
    question: String, answer: Double, tolerance: Tolerance, unit: String?, explanation: String,
    inputs: [Input]?, output: String?)
  case interaction(explanation: String)

  private enum CodingKeys: String, CodingKey {
    case answer, explanation, inputs, kind, options, output, question, tolerance, unit
  }

  public init(from decoder: any Decoder) throws {
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

  public func encode(to encoder: any Encoder) throws {
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

  public var explanation: String? {
    switch self {
    case .choice: nil
    case .numeric(_, _, _, _, let explanation, _, _), .interaction(let explanation): explanation
    }
  }
}

public struct ActivityAnswer: Codable, Hashable, Sendable {
  public let value: JSONValue

  public init(value: JSONValue) {
    self.value = value
  }

  /// `answer` must encode the API's `kind` field.
  public init(encoding answer: some Encodable) throws {
    value = try JSONValue(encoding: answer)
  }

  public init(from decoder: any Decoder) throws {
    value = try JSONValue(from: decoder)
  }

  public func encode(to encoder: any Encoder) throws {
    try value.encode(to: encoder)
  }

  public static func choice(optionId: String) -> ActivityAnswer {
    ActivityAnswer(value: .object(["kind": .string("choice"), "optionId": .string(optionId)]))
  }

  public static func numeric(_ number: Double) -> ActivityAnswer {
    ActivityAnswer(value: .object(["kind": .string("numeric"), "value": .number(number)]))
  }

  public var kind: String? {
    guard case .string(let kind) = value["kind"] else {
      return nil
    }

    return kind
  }

  public var optionId: String? {
    guard case .string(let id) = value["optionId"] else {
      return nil
    }

    return id
  }

  public var number: Double? {
    guard case .number(let number) = value["value"] else {
      return nil
    }

    return number
  }

  public func decode<Answer: Decodable>(as type: Answer.Type = Answer.self) throws -> Answer {
    try value.decode(as: type)
  }
}

/// A `mapExplorer`'s base map as the API sends it: shapes in the drawing's own units (`width` by
/// `height`), paths as SVG path data, each place already projected onto it.
public struct ActivityBaseMap: Codable, Hashable, Sendable {
  public enum Tone: String, Codable, Hashable, Sendable {
    case context, focus, groupA, groupB, groupC
  }

  public struct Region: Codable, Hashable, Sendable {
    public let path: String
    public let tone: Tone
  }

  public struct Street: Codable, Hashable, Sendable {
    public let path: String
  }

  public struct Label: Codable, Hashable, Sendable {
    public enum Kind: String, Codable, Hashable, Sendable {
      case region, street
    }

    public let angle: Double
    public let key: String?
    public let kind: Kind
    public let text: String
    public let x: Double
    public let y: Double
  }

  public struct LegendItem: Codable, Hashable, Sendable {
    public let key: String
    public let tone: Tone
  }

  public struct Inset: Codable, Hashable, Sendable {
    public let height: Double
    public let width: Double
    public let x: Double
    public let y: Double
  }

  public struct Place: Codable, Hashable, Sendable {
    public let id: String
    public let x: Double
    public let y: Double
  }

  public let height: Double
  public let insets: [Inset]
  public let labels: [Label]
  public let legend: [LegendItem]
  public let maxZoom: Double
  public let places: [Place]
  public let regions: [Region]
  public let sphere: String?
  public let streets: [Street]
  public let width: Double
}
