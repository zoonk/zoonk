import Foundation

/// Any JSON value, kept as the API sent it. Activity templates each have their own fields, which
/// only their renderer reads, so the lesson keeps them raw and a renderer decodes its own shape.
public enum JSONValue: Codable, Hashable, Sendable {
  case null
  case bool(Bool)
  case number(Double)
  case string(String)
  case array([JSONValue])
  case object([String: JSONValue])

  public init(from decoder: any Decoder) throws {
    let container = try decoder.singleValueContainer()

    if container.decodeNil() {
      self = .null
    } else if let value = try? container.decode(Bool.self) {
      self = .bool(value)
    } else if let value = try? container.decode(Double.self) {
      self = .number(value)
    } else if let value = try? container.decode(String.self) {
      self = .string(value)
    } else if let value = try? container.decode([JSONValue].self) {
      self = .array(value)
    } else {
      self = .object(try container.decode([String: JSONValue].self))
    }
  }

  public func encode(to encoder: any Encoder) throws {
    var container = encoder.singleValueContainer()

    switch self {
    case .null: try container.encodeNil()
    case .bool(let value): try container.encode(value)
    case .number(let value): try container.encode(value)
    case .string(let value): try container.encode(value)
    case .array(let value): try container.encode(value)
    case .object(let value): try container.encode(value)
    }
  }

  /// Wraps any encodable value, such as an activity's own answer type.
  public init(encoding value: some Encodable) throws {
    self = try JSONDecoder().decode(JSONValue.self, from: JSONEncoder().encode(value))
  }

  /// Reads the value as a typed shape, such as a template's `fields`.
  public func decode<Value: Decodable>(as type: Value.Type = Value.self) throws -> Value {
    try JSONDecoder().decode(type, from: JSONEncoder().encode(self))
  }

  public subscript(key: String) -> JSONValue? {
    guard case .object(let object) = self else {
      return nil
    }

    return object[key]
  }
}
