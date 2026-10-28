import Foundation

/// Mirrors main's `useFormatNumber` (`@zoonk/utils/math-answer`).
enum ActivityNumberFormat {
  private static let currencies: [String: String] = [
    "$": "USD", "A$": "AUD", "C$": "CAD", "R$": "BRL", "US$": "USD", "£": "GBP", "¥": "JPY",
    "€": "EUR", "₹": "INR",
  ]

  private static let attachedUnits: Set<String> = ["%", "°", "‰"]

  /// - Parameters:
  ///   - digits: The most decimals to show, instead of the ones the value's size needs.
  ///   - grouping: Off for values like years, which read wrong as "1,960".
  ///   - compact: Short forms like "1.2M", for axis labels.
  static func format(
    _ value: Double,
    unit: String? = nil,
    signed: Bool = false,
    digits: Int? = nil,
    grouping: Bool = true,
    compact: Bool = false,
    locale: Locale = .current
  ) -> String {
    if let money = money(unit) {
      let amount = formatMoney(
        value, currency: money.currency, signed: signed, digits: digits, compact: compact,
        locale: locale)
      return money.rest.isEmpty ? amount : "\(amount) \(money.rest)"
    }

    var style = FloatingPointFormatStyle<Double>.number.locale(locale)
      .precision(.fractionLength(0...min(max(digits ?? fractionDigits(value), 0), 20)))
      .sign(strategy: signed ? .always(includingZero: false) : .automatic)
      .grouping(grouping ? .automatic : .never)

    if compact {
      style = style.notation(.compactName)
    }

    let number = typographicMinus(value.formatted(style))

    guard let unit, !unit.isEmpty else {
      return number
    }

    return attachedUnits.contains(unit) ? number + unit : "\(number)\u{00A0}\(unit)"
  }

  /// Main's `formatMoney`: cents only when a small amount has some ($3.50, $200, $103,449),
  /// unless the caller asks for digits.
  private static func formatMoney(
    _ value: Double, currency: String, signed: Bool, digits: Int?, compact: Bool, locale: Locale
  ) -> String {
    let isWhole = { (places: Int) in
      let scale = pow(10, Double(places))
      return ((value * scale + 0.5).rounded(.down)).truncatingRemainder(dividingBy: scale) == 0
    }

    let maximum = digits ?? (abs(value) >= 1000 || isWhole(2) ? 0 : 2)
    let minimum = isWhole(maximum) ? 0 : min(maximum, 2)

    var style = FloatingPointFormatStyle<Double>.Currency(code: currency, locale: locale)
      .precision(.fractionLength(minimum...max(maximum, minimum)))
      .sign(strategy: signed ? .always(showZero: false) : .automatic)

    if compact {
      style = style.notation(.compactName)
    }

    return typographicMinus(value.formatted(style))
  }

  /// The money part of a unit and what follows it: "R$ por metro" is money per meter, so it reads
  /// "R$ 7 por metro".
  private static func money(_ unit: String?) -> (currency: String, rest: String)? {
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
    currencies[unit]
      ?? (unit.count == 3 && unit.allSatisfy { $0.isASCII && $0.isUppercase } ? unit : nil)
  }

  /// A typographic minus reads as a sign, not a hyphen.
  private static func typographicMinus(_ text: String) -> String {
    text.replacingOccurrences(of: "-", with: "\u{2212}")
  }

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
