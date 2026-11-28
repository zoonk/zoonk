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
      if let aim {
        Text(verbatim: aim).typeStyle(.readout).monospaced()
      } else {
        switch forecast {
        case .month(let isoDate):
          MonthYear(isoDate: isoDate)
        case .year(let isoDate):
          Text(verbatim: PlanDate.text(isoDate, today: isoDate, grain: .year))
            .typeStyle(.readout)
        case .beyond:
          BigQuantity(PlanForecast.beyondText)
        }
      }
    }
  }

  /// What a change of it says aloud.
  var spoken: String {
    let value =
      switch (aim, forecast) {
      case (.some(let aim), _): aim
      case (nil, .beyond): PlanForecast.beyondText
      case (nil, .month(let isoDate)): PlanDate.longText(isoDate, month: true)
      case (nil, .year(let isoDate)): PlanDate.text(isoDate, today: isoDate, grain: .year)
      }

    return [value, label].joinedFacts()
  }

  private var label: String {
    switch (aim != nil, forecast) {
    case (true, .month(let isoDate)):
      String(
        localized: "by \(PlanDate.longText(isoDate, month: true))", table: "Onboarding",
        comment: "Under the level a language plan reaches, as in 'B1 by Nov 2027'")
    case (true, .year(let isoDate)):
      String(
        localized: LocalizedStringResource(
          "aimByYear", defaultValue: "by \(PlanDate.text(isoDate, today: isoDate, grain: .year))",
          table: "Onboarding",
          comment:
            "Under the level a language plan reaches when it's years away, as in 'B2 by 2031'"
        ))
    case (true, .beyond):
      String(
        localized: "in 10+ years", table: "Onboarding",
        comment:
          "Under the level a language plan reaches, when reaching it takes more than ten years at the time picked."
      )
    case (false, .beyond):
      String(
        localized: "to finish", table: "Onboarding",
        comment: "Under '10+ years': how long a plan without a date takes at this pace")
    case (false, .month), (false, .year):
      String(
        localized: "estimated finish", table: "Onboarding",
        comment: "Under the month a plan without a date ends at this pace")
    }
  }
}

/// The month reads first and big, its year small, in the locale's order.
private struct MonthYear: View {
  let isoDate: String

  var body: some View {
    let parts = PlanDate.date(isoDate).map(PlanDate.monthAndYear) ?? AttributedString(isoDate)

    HStack(alignment: .firstTextBaseline, spacing: 0) {
      ForEach(Array(parts.runs.enumerated()), id: \.offset) { _, run in
        let text = Text(verbatim: String(parts[run.range].characters))

        if run.dateField == .year {
          text
            .typeStyle(.rowTitle)
            .foregroundStyle(.mutedForeground)
        } else {
          text
            .typeStyle(.readout)
        }
      }
    }
    .accessibilityElement(children: .ignore)
    .accessibilityLabel(String(parts.characters))
  }
}
