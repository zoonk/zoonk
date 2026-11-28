import SwiftUI

/// When a plan without a date finishes at a pace, as core forecasts it: by its month while it's
/// near, by its year once it's far, and with no date once it's past the years a plan lays out.
enum PlanForecast: Equatable, Sendable {
  enum Precision: String, Decodable, Sendable {
    case month
    case year
  }

  /// Why a forecast has no date. Only `beyondHorizon` is a finish to show.
  enum Reason: String, Decodable, Sendable {
    case beyondHorizon
    case noStudyDays
    case nothingLeft
  }

  case month(String)
  case year(String)
  case beyond

  init?(date: String?, precision: Precision?, reason: Reason?) {
    if let date {
      self = precision == .year ? .year(date) : .month(date)
    } else if reason == .beyondHorizon {
      self = .beyond
    } else {
      return nil
    }
  }

  var isoDate: String? {
    switch self {
    case .month(let date), .year(let date): date
    case .beyond: nil
    }
  }

  /// The most a plan says it takes.
  static var beyondText: String {
    String(
      localized: "10+ years", table: "Onboarding",
      comment:
        "How long finishing the plan takes at the time picked, when it's more than ten years.")
  }
}

/// Main's reveal readout: a value read first and big, over the small words that say what it is.
struct Readout<Value: View>: View {
  let label: String
  var alignment: HorizontalAlignment = .leading
  @ViewBuilder let value: Value

  var body: some View {
    VStack(alignment: alignment, spacing: 4) {
      value
        .lineLimit(1)
        .minimumScaleFactor(0.7)

      Text(label)
        .typeStyle(.meta)
        .foregroundStyle(.mutedForeground)
        .multilineTextAlignment(alignment == .trailing ? .trailing : .leading)
    }
    .accessibilityElement(children: .combine)
  }
}

/// When the plan finishes, wherever a time is picked or shown: "Mar 2027", "2031" or "10+ years".
/// A language plan ends where its `aim` is, so it reads as the level and when it's reached.
struct FinishReadout: View {
  let forecast: PlanForecast
  var aim: String?
  var alignment: HorizontalAlignment = .leading

  var body: some View {
    Readout(label: label, alignment: alignment) {
      switch (forecast, aim) {
      case (.beyond, _):
        BigQuantity(PlanForecast.beyondText)
      case (_, .some(let aim)):
        Text(verbatim: aim).typeStyle(.readout).monospaced()
      case (.month(let isoDate), nil):
        MonthYear(isoDate: isoDate)
      case (.year(let isoDate), nil):
        Text(verbatim: PlanDate.text(isoDate, today: isoDate, grain: .year))
          .typeStyle(.readout)
      }
    }
  }

  /// What a change of it says aloud.
  var spoken: String {
    let value =
      switch (forecast, aim) {
      case (.beyond, _): PlanForecast.beyondText
      case (_, .some(let aim)): aim
      case (.month(let isoDate), nil): PlanDate.finishText(isoDate, grain: .month)
      case (.year(let isoDate), nil): PlanDate.finishText(isoDate, grain: .year)
      }

    return [value, label].joinedFacts()
  }

  /// Past the years a plan lays out, a language aim's too, it says how long rather than when.
  private var label: String {
    switch (forecast, aim) {
    case (.beyond, _):
      String(
        localized: "to finish", table: "Onboarding",
        comment: "Under '10+ years': how long finishing the plan takes at the time picked.")
    case (.month(let isoDate), .some):
      aimBy(PlanDate.finishText(isoDate, grain: .month))
    case (.year(let isoDate), .some):
      aimBy(PlanDate.finishText(isoDate, grain: .year))
    case (.month, nil), (.year, nil):
      String(
        localized: "estimated finish", table: "Onboarding",
        comment: "Under the month a plan without a date ends at this pace")
    }
  }

  private func aimBy(_ date: String) -> String {
    String(
      localized: "by \(date)", table: "Onboarding",
      comment:
        "Under the level a language plan reaches, as in 'B1 by Nov 2027', or by a year alone when it's far, as in 'B2 by 2031'"
    )
  }
}

/// The month big, its year small with its own unit ("2026년"), in the locale's order: one text, so
/// the gap beside the year is as small as a quantity's before its unit.
private struct MonthYear: View {
  let isoDate: String

  @Environment(\.dynamicTypeSize) private var dynamicTypeSize
  @Environment(\.legibilityWeight) private var legibilityWeight

  var body: some View {
    Text(shown).typeStyle(.readout)
  }

  private var shown: AttributedString {
    let (text, year) = PlanDate.monthAndYear(isoDate)
    var shown = AttributedString(text)

    if let year, let range = Range(year, in: shown) {
      shown[range].font = BigQuantity.unitFont(
        dynamicTypeSize: dynamicTypeSize, legibilityWeight: legibilityWeight)
      shown[range].foregroundColor = Color(.mutedForeground)
    }

    return shown
  }
}
