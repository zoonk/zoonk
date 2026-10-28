import Foundation

struct TimelineFields: Decodable, Hashable, Sendable {
  struct Anchor: Decodable, Hashable, Sendable {
    let label: String
    let year: Int
  }

  struct Event: Decodable, Hashable, Sendable, Identifiable {
    let id: String
    let label: String
    let year: Int
  }

  let anchors: [Anchor]
  let end: Int
  let events: [Event]
  let start: Int

  /// The events earliest first: the order an order check expects.
  var expected: ActivityExpectedAnswer {
    .order(events.sorted { $0.year < $1.year }.map(\.id))
  }
}

/// Mirrors main's `timeline-scale`. Years are whole numbers with negative ones BCE, and there was no
/// year 0.
enum TimelineScale {
  struct Placement: Hashable, Sendable {
    let id: String
    var year: Int
  }

  /// Positions a year can take: about a hundred along the axis, in round steps.
  private static let steps = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000]

  static func yearStep(start: Int, end: Int) -> Int {
    let rough = Double(end - start) / 100
    return steps.first { Double($0) >= rough } ?? steps.last ?? 1
  }

  /// Snaps a year to the step, measured from the start so both ends stay reachable.
  static func snapYear(_ year: Double, start: Int, end: Int) -> Int {
    let step = Double(yearStep(start: start, end: end))
    // Halves round up, as JavaScript's Math.round.
    let snapped = Double(start) + ((year - Double(start)) / step + 0.5).rounded(.down) * step
    return Int(min(max(snapped, Double(start)), Double(end)))
  }

  /// The order the learner's placements put the events in: earliest first, ties in the order they
  /// were placed. This is the answer the check grades.
  static func placedOrder(_ placements: [Placement]) -> [String] {
    placements.enumerated()
      .sorted {
        $0.element.year != $1.element.year
          ? $0.element.year < $1.element.year : $0.offset < $1.offset
      }
      .map(\.element.id)
  }

  /// Years between two dates, with no year 0 between 1 BCE and 1 CE.
  static func yearsBetween(_ first: Int, _ second: Int) -> Int {
    let (from, to) = first < second ? (first, second) : (second, first)
    return to - from - (from < 0 && to > 0 ? 1 : 0)
  }

  static func roundedGap(_ gap: Int) -> Int {
    let size = abs(gap)
    return size < 100 ? size : Int(FactChange.twoDigits(Double(size)))
  }

  /// Round year ticks along the axis; year 0 is skipped because there was no year 0.
  static func ticks(start: Int, end: Int, count: Int = 5) -> [Int] {
    let range = Double(end - start)

    guard range > 0 else {
      return []
    }

    let rough = range / Double(count)
    let magnitude = pow(10, floor(log10(rough)))
    let step = [1.0, 2, 5, 10].map { $0 * magnitude }.first { $0 >= rough } ?? 10 * magnitude
    let first = (Double(start) / step).rounded(.up) * step

    return stride(from: first, through: Double(end), by: step)
      .map { Int($0) }
      .filter { $0 != 0 }
  }

  enum Era {
    case bce, ce, none
  }

  static func era(of year: Int, start: Int) -> (era: Era, year: Int) {
    if year < 0 {
      return (.bce, -year)
    }

    return (start < 0 ? .ce : .none, year)
  }
}
