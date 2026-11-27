public struct UnsupportedAPIEnum: Error {}

extension RawRepresentable where Self: Decodable, RawValue == String {
  public init(from decoder: any Decoder) throws {
    let container = try decoder.singleValueContainer()
    let raw = try container.decode(String.self)
    let fallback = "__unknown_api_value__"

    if let value = Self(rawValue: raw) ?? Self(rawValue: fallback) {
      self = value
    } else if raw == fallback {
      // The generated response was recoded into an app model that only displays known values.
      throw UnsupportedAPIEnum()
    } else {
      throw DecodingError.dataCorruptedError(
        in: container, debugDescription: "Unrecognized value for \(Self.self).")
    }
  }
}
