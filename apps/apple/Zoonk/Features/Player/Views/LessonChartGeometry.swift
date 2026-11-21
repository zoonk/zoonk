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

    init(_ values: [Double]) {
      let wholeNumbers = values.allSatisfy { $0 == $0.rounded() }

      domain = ChartsMath.niceDomain(values, includesZero: false)
      ticks = ChartsAxis.ticks(domain).filter { !wholeNumbers || $0 == $0.rounded() }
    }
  }

  let x: Axis
  let y: Axis

  init(_ plot: LessonPlot) {
    let points = plot.series.flatMap(\.points)

    x = Axis(points.map(\.x))
    y = Axis(points.map(\.y) + plot.references.map(\.y))
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
