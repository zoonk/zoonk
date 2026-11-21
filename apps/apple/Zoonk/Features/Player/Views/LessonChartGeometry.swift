import Foundation

struct LessonChartScale {
  let domain: ClosedRange<Double>
  let ticks: [Double]

  init(_ chart: LessonChart) {
    let values = chart.series.flatMap(\.values)
    let nice = ChartsMath.niceDomain(
      values + [chart.axisStart].compactMap(\.self), includesZero: chart.chart == .bar)
    let domain =
      chart.axisStart.flatMap { $0 < nice.upperBound ? $0...nice.upperBound : nil } ?? nice
    let wholeNumbers = values.allSatisfy { $0 == $0.rounded() }

    self.domain = domain
    self.ticks = ChartsAxis.ticks(domain).filter { !wholeNumbers || $0 == $0.rounded() }
  }

  /// Where bars start: zero, or the axis's start when the axis is cut above zero.
  var origin: Double {
    ChartsMath.clamp(0, domain.lowerBound, domain.upperBound)
  }
}

struct LessonPlotScale {
  struct Axis {
    let domain: ClosedRange<Double>
    let ticks: [Double]

    init(domain: ClosedRange<Double>, ticks: [Double], values: [Double]) {
      let wholeNumbers = values.allSatisfy { $0 == $0.rounded() }

      self.domain = domain
      self.ticks = ticks.filter { !wholeNumbers || $0 == $0.rounded() }
    }
  }

  let x: Axis
  let y: Axis

  init(_ plot: LessonPlot) {
    let points = plot.series.flatMap(\.points)
    let xs = points.map(\.x).filter(\.isFinite)
    let ys = points.map(\.y) + plot.references.map(\.y)
    let yDomain = ChartsMath.niceDomain(ys, includesZero: false)

    x = Self.xAxis(xs)
    y = Axis(domain: yDomain, ticks: ChartsAxis.ticks(yDomain), values: ys)
  }

  /// The x axis spans the data and no further, so the points fill the plot; its round ticks sit
  /// inside it. One x value sits in the middle.
  private static func xAxis(_ values: [Double]) -> Axis {
    guard let low = values.min(), let high = values.max() else {
      return Axis(domain: 0...1, ticks: [0, 1], values: [])
    }

    let domain = low == high ? ChartsMath.padFlat(low) : low...high
    let step = nearestStep(domain.upperBound - domain.lowerBound)

    return Axis(domain: domain, ticks: ticks(within: domain, step: step), values: values)
  }

  /// The round step nearest a quarter of `span` on a log scale, so ticks fill a span without running
  /// past it.
  private static func nearestStep(_ span: Double) -> Double {
    let rough = span / 4
    let magnitude = pow(10, log10(rough).rounded(.down))
    let factors = [10.0, 5, 2, 1]
    let factor =
      factors.indices.first { index in
        rough / magnitude
          >= (factors[index] * factors[min(index + 1, factors.count - 1)]).squareRoot()
      }.map { factors[$0] } ?? 1

    return factor * magnitude
  }

  private static func ticks(within domain: ClosedRange<Double>, step: Double) -> [Double] {
    guard step.isFinite, step > 0 else {
      return []
    }

    let first = ChartsMath.clean(domain.lowerBound / step).rounded(.up)
    let last = ChartsMath.clean(domain.upperBound / step).rounded(.down)

    return first > last
      ? [] : stride(from: first, through: last, by: 1).map { ChartsMath.clean($0 * step) }
  }
}

/// Main's `formatTicks`: as many decimals as the step between ticks needs, and large numbers
/// shortened ("12.5K") only where every shortened tick stays exact, so no two ticks print the same.
/// The x axis groups digits only in large numbers, so years don't read as "2,024".
enum LessonPlotTicks {
  private static let compactFrom = 10_000.0
  private static let compactDigits = 2
  private static let maxDigits = 20

  static func isLarge(_ values: [Double]) -> Bool {
    values.contains { abs($0) >= compactFrom }
  }

  static func format(_ ticks: [Double], xAxis: Bool = false, locale: Locale) -> [String] {
    let first = ticks.first ?? 0
    let large = isLarge(ticks)
    let digits =
      ticks.count > 1 ? decimals(ticks[1] - first) : ActivityNumberFormat.fractionDigits(first)

    if large {
      let short = ticks.map {
        ActivityNumberFormat.format($0, digits: compactDigits, compact: true, locale: locale)
      }
      let exact = ticks.map {
        ActivityNumberFormat.format($0, digits: maxDigits, compact: true, locale: locale)
      }

      if short == exact {
        return short
      }
    }

    return ticks.map {
      ActivityNumberFormat.format($0, digits: digits, grouping: !xAxis || large, locale: locale)
    }
  }

  /// The decimals the step's shortest form has: 0.25 has two, 2.5e-7 has eight.
  private static func decimals(_ step: Double) -> Int {
    let parts = "\(abs(ChartsMath.clean(step)))".lowercased().split(separator: "e")
    let exponent = parts.count > 1 ? Int(parts[1]) ?? 0 : 0
    let fraction = parts.first?.split(separator: ".").dropFirst().first.map {
      String($0.reversed().drop { $0 == "0" })
    }

    return min(max((fraction?.count ?? 0) - exponent, 0), maxDigits)
  }
}

/// Which of a value axis's numbers to print: all when none touch, else every second, third and so
/// on from the first, as on web and Android. `frames` are each number's edges where it's drawn.
enum LessonChartTicks {
  static func labeled(_ frames: [(left: Double, right: Double)], gap: Double = 4) -> [Int] {
    for step in 1..<max(frames.count, 1) {
      let kept = Array(stride(from: 0, to: frames.count, by: step))

      if zip(kept, kept.dropFirst()).allSatisfy({ frames[$0].right + gap <= frames[$1].left }) {
        return kept
      }
    }

    return frames.isEmpty ? [] : [0]
  }
}

/// Upright bars share their category's band, so each series thins them. Under `minWidth` they're
/// slivers, and the chart lays its bars sideways instead, as main's `fitsBarsSideBySide`.
enum LessonChartBars {
  /// The share of its band a category's bars take together, and the room trimmed off each bar's
  /// sides, as main's.
  static let groupShare = 0.68
  static let inset = 1.0
  static let minWidth = 4.0

  static func fitSideBySide(band: Double, series: Int) -> Bool {
    band * groupShare / Double(max(series, 1)) - inset * 2 >= minWidth
  }
}

/// Whether a bar chart's category names fit under its bars: each wraps at spaces and after hyphens
/// within its bar's width in at most two lines, with no word wider than that. When one doesn't,
/// the chart lays its bars sideways with every name in full above its bars.
enum LessonChartNames {
  static let maxLines = 2

  static func fitUnderBars(_ names: [String], band: Double, width: (String) -> Double) -> Bool {
    names.allSatisfy { name in
      lineCount(name, room: band, width: width).map { $0 <= maxLines } ?? false
    }
  }

  /// The lines `name` takes wrapped at spaces and after hyphens within `room`, or `nil` when a
  /// piece between breaks is wider than `room`.
  static func lineCount(_ name: String, room: Double, width: (String) -> Double) -> Int? {
    var lines = 0
    var line = ""

    for piece in pieces(name) {
      let joined = line + piece

      if !line.isEmpty, width(joined.trimmingTrailingSpaces) <= room {
        line = joined
        continue
      }

      guard width(piece.trimmingTrailingSpaces) <= room else {
        return nil
      }

      line = piece
      lines += 1
    }

    return lines
  }

  /// The pieces a name may break between, each keeping the space or hyphen it breaks after.
  static func pieces(_ name: String) -> [String] {
    var pieces: [String] = []
    var piece = ""

    for character in name {
      if piece.last == " " || piece.last == "-", character != " " {
        pieces.append(piece)
        piece = ""
      }

      piece.append(character)
    }

    return piece.isEmpty ? pieces : pieces + [piece]
  }
}

extension String {
  fileprivate var trimmingTrailingSpaces: String {
    String(reversed().drop { $0 == " " }.reversed())
  }
}
