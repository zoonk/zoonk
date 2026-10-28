import Foundation

/// Mirrors main's `seededShuffle` (`@zoonk/utils/seeded-random`), so items show in the same order on
/// the web, in the app and on every visit, while the writer's order (often grouped by answer) never
/// shows.
enum SeededShuffle {
  /// The Park-Miller "minimal standard" generator's modulus and multiplier.
  private static let modulus: Int64 = 2_147_483_647
  private static let multiplier: Int64 = 48_271
  private static let hashMultiplier: Int64 = 31

  static func shuffled<Item>(_ items: [Item], seed seedText: String) -> [Item] {
    var state = (abs(hashSeed(seedText)) % (modulus - 1)) + 1

    let keyed = items.map { item in
      state = (state * multiplier) % modulus
      return (item: item, key: Double(state - 1) / Double(modulus - 1))
    }

    return keyed.sorted { $0.key < $1.key }.map(\.item)
  }

  /// A stable number from text, read like JavaScript's `codePointAt` at every UTF-16 index.
  static func hashSeed(_ text: String) -> Int64 {
    let units = Array(text.utf16)

    return units.indices.reduce(Int64(0)) { hash, index in
      (hash * hashMultiplier + codePoint(units, at: index)) % modulus
    }
  }

  private static func codePoint(_ units: [UInt16], at index: Int) -> Int64 {
    let unit = units[index]

    if UTF16.isLeadSurrogate(unit), index + 1 < units.count,
      UTF16.isTrailSurrogate(units[index + 1])
    {
      return Int64(0x10000 + ((Int(unit) - 0xD800) << 10) + (Int(units[index + 1]) - 0xDC00))
    }

    return Int64(unit)
  }
}
