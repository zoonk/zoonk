import Foundation

/// Numbers in the learner's language with an activity's unit, the way main's `useFormatNumber`
/// writes them: money units ("$", "R$", "EUR") in the currency's format, "%", "°" and "‰" attached,
/// any other unit after a no-break space, and as many decimals as the size of the number needs.
enum ActivityNumberFormat {
  private static let currencies: [String: String] = [
    "$": "USD", "A$": "AUD", "C$": "CAD", "R$": "BRL", "US$": "USD", "£": "GBP", "¥": "JPY",
    "€": "EUR", "₹": "INR",
  ]

  private static let attachedUnits: Set<String> = ["%", "°", "‰"]

  static func format(
    _ value: Double, unit: String? = nil, signed: Bool = false, grouping: Bool = true
  )
    -> String
  {
    let sign: NumberFormatStyleConfiguration.SignDisplayStrategy =
      signed ? .always(includingZero: false) : .automatic

    if let unit, let currency = currency(for: unit) {
      return value.formatted(
        .currency(code: currency).sign(strategy: signed ? .always() : .automatic)
          .precision(.fractionLength(abs(value) < 1000 && value.rounded() != value ? 2 : 0)))
    }

    let number = value.formatted(
      .number.precision(.fractionLength(0...fractionDigits(value))).sign(strategy: sign)
        .grouping(grouping ? .automatic : .never))

    guard let unit, !unit.isEmpty else {
      return number
    }

    return attachedUnits.contains(unit) ? number + unit : "\(number)\u{00A0}\(unit)"
  }

  private static func currency(for unit: String) -> String? {
    currencies[unit]
      ?? (unit.count == 3 && unit.allSatisfy { $0.isASCII && $0.isUppercase } ? unit : nil)
  }

  /// Big numbers whole, small ones with enough digits to show their first figures.
  static func fractionDigits(_ value: Double) -> Int {
    let size = abs(value)

    if size >= 1000 { return 0 }
    if size >= 10 { return 1 }
    if size >= 1 { return 2 }
    if size == 0 { return 3 }

    let leadingZeros = max(0, -Int(floor(log10(size))) - 1)
    return min(20, leadingZeros + 3)
  }
}
