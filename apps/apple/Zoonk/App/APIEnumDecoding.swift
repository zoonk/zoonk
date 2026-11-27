protocol UnknownAPIValue: RawRepresentable, Decodable where RawValue == String {
  static var unrecognized: Self { get }
}

extension UnknownAPIValue {
  init(from decoder: any Decoder) throws {
    let value = try decoder.singleValueContainer().decode(RawValue.self)
    self = Self(rawValue: value) ?? .unrecognized
  }
}

extension KeyedDecodingContainer {
  func decode(_ type: String.Type, forKey key: Key) throws -> String {
    let value = try decodeScalar(type, forKey: key)
    guard value != "__unknown_api_union_tag__" else { throw UnsupportedAPIEnum() }
    return value
  }

  private func decodeScalar<Value: Decodable>(_ type: Value.Type, forKey key: Key) throws -> Value {
    try decode(type, forKey: key)
  }

  /// Skip only a row that this version cannot interpret. Missing data and malformed rows still fail.
  func decode<Row: Decodable>(_ type: [Row].Type, forKey key: Key) throws -> [Row] {
    var items = try nestedUnkeyedContainer(forKey: key)
    var rows: [Row] = []
    while !items.isAtEnd {
      do {
        rows.append(try items.decode(Row.self))
      } catch is UnsupportedAPIEnum {
        _ = try items.superDecoder()
      }
    }
    return rows
  }

  func decodeIfPresent<Value: Decodable>(_ type: Value.Type, forKey key: Key) throws -> Value? {
    try supportedValue(forKey: key) { try decode(type, forKey: key) }
  }

  func decodeIfPresent<Row: Decodable>(_ type: [Row].Type, forKey key: Key) throws -> [Row]? {
    try supportedValue(forKey: key) { try decode(type, forKey: key) }
  }

  private func supportedValue<Value>(forKey key: Key, read: () throws -> Value) throws -> Value? {
    guard contains(key), try !decodeNil(forKey: key) else { return nil }
    do {
      return try read()
    } catch is UnsupportedAPIEnum {
      return nil
    }
  }
}
