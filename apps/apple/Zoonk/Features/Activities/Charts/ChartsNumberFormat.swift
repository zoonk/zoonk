import Foundation

/// Numbers in the learner's language with the activity's unit, the way main writes them
/// (`useFormatNumber`, `@zoonk/utils/math-answer`): money units follow the language's currency
/// format ("$1,000", "US$ 1.000"), "%", "°" and "‰" attach, any other unit follows after a
/// no-break space, and decimals fit the value's size so a readout never shows float noise.
struct ChartsNumberFormat: Sendable {
  var locale: Locale = .current

  private static let currencies: [String: String] = [
    "$": "USD", "A$": "AUD", "C$": "CAD", "R$": "BRL", "US$": "USD", "£": "GBP", "¥": "JPY",
    "€": "EUR", "₹": "INR",
  ]

  private static let attachedUnits: Set<String> = ["%", "°", "‰"]

  func callAsFunction(
    _ value: Double,
    unit: String? = nil,
    signed: Bool = false,
    digits: Int? = nil,
    grouping: Bool = true,
    compact: Bool = false
  ) -> String {
    if let split = Self.splitMoney(unit) {
      let amount = money(value, currency: split.currency, signed: signed, digits: digits)
      return split.rest.isEmpty ? amount : "\(amount) \(split.rest)"
    }

    let fraction = min(max(digits ?? Self.fractionDigits(for: value), 0), 20)

    var style = FloatingPointFormatStyle<Double>.number.locale(locale)
      .precision(.fractionLength(0...fraction))
      .grouping(grouping ? .automatic : .never)
      .sign(strategy: signed ? .always(includingZero: false) : .automatic)

    if compact {
      style = style.notation(.compactName)
    }

    let number = Self.typographicMinus(value.formatted(style))

    guard let unit, !unit.isEmpty else {
      return number
    }

    return Self.attachedUnits.contains(unit) ? "\(number)\(unit)" : "\(number)\u{00A0}\(unit)"
  }

  private func money(_ value: Double, currency: String, signed: Bool, digits: Int?) -> String {
    let isWhole = { (places: Int) in
      let scale = pow(10, Double(places))
      return ChartsMath.jsRound(value * scale).truncatingRemainder(dividingBy: scale) == 0
    }

    let maximum = digits ?? (abs(value) >= 1000 || isWhole(2) ? 0 : 2)
    let minimum = isWhole(maximum) ? 0 : min(maximum, 2)

    let style = FloatingPointFormatStyle<Double>.Currency(code: currency, locale: locale)
      .precision(.fractionLength(minimum...max(maximum, minimum)))
      .sign(strategy: signed ? .always(showZero: false) : .automatic)

    return Self.typographicMinus(value.formatted(style))
  }

  private static func splitMoney(_ unit: String?) -> (currency: String, rest: String)? {
    guard let unit, !unit.isEmpty else {
      return nil
    }

    if let currency = currency(for: unit) {
      return (currency, "")
    }

    let words = unit.split(separator: " ", maxSplits: 1).map(String.init)

    guard words.count == 2, let currency = currency(for: words[0]) else {
      return nil
    }

    return (currency, words[1])
  }

  private static func currency(for unit: String) -> String? {
    if let currency = currencies[unit] {
      return currency
    }

    let isCode = unit.count == 3 && unit.unicodeScalars.allSatisfy { ("A"..."Z").contains($0) }
    return isCode ? unit : nil
  }

  /// None for thousands, one for tens, two for ones, three significant digits below one.
  static func fractionDigits(for value: Double) -> Int {
    let size = abs(value)

    if size >= 1000 { return 0 }
    if size >= 10 { return 1 }
    if size >= 1 { return 2 }
    if size == 0 { return 3 }

    let leadingZeros = max(0, -Int(log10(size).rounded(.down)) - 1)
    return min(20, leadingZeros + 3)
  }

  private static func typographicMinus(_ text: String) -> String {
    text.replacingOccurrences(of: "-", with: "\u{2212}")
  }
}
