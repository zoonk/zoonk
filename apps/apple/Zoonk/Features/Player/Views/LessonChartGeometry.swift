import Foundation

/// A bar chart's value axis, the same whichever way its bars run: round ends from zero, cut at
/// `axisStart` when the chart sets one, as main's `getLayout`.
struct LessonChartScale {
  let domain: ClosedRange<Double>
  let ticks: [Double]

  init(_ chart: LessonChart) {
    let values = chart.series.flatMap(\.values)
    let nice = ChartsMath.niceDomain(values + [chart.axisStart].compactMap(\.self))
    let domain =
      chart.axisStart.flatMap { $0 < nice.upperBound ? $0...nice.upperBound : nil } ?? nice
    let step = ChartsMath.niceStep(domain.upperBound - domain.lowerBound)
    let wholeNumbers = values.allSatisfy { $0 == $0.rounded() }
    let first = (ChartsMath.clean(domain.lowerBound / step)).rounded(.up) * step

    self.domain = domain
    self.ticks = stride(from: first, through: domain.upperBound + step / 1e9, by: step)
      .map(ChartsMath.clean)
      .filter { !wholeNumbers || $0 == $0.rounded() }
  }

  /// Where bars start: zero, or the axis's start when the axis is cut above zero.
  var origin: Double {
    ChartsMath.clamp(0, domain.lowerBound, domain.upperBound)
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
