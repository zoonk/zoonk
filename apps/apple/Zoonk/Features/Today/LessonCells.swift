/// Main's `getLessonCells`: up to 30 cells, each one whole state. A cell stands for several lessons
/// once the plan is longer, and each state takes its share of the cells (studied, known, today's,
/// then the rest), rounded so the shares add up exactly; a state the legend names gets one cell at
/// least, taken from the state holding the most, so the bar never draws less than it says.
enum LessonCells {
  enum State: Int, CaseIterable {
    case studied
    case known
    case today
    case rest
  }

  private static let maxCells = 30

  static func of(studied: Int, known: Int, today: Int, total: Int) -> [State] {
    guard total > 0 else {
      return []
    }

    let size = max(1, (total + maxCells - 1) / maxCells)
    let count = (total + size - 1) / size
    let lessons = [studied, known, today, max(0, total - studied - known - today)]
    let cells = giveEveryStateACell(share(count: count, lessons: lessons, total: total), lessons)

    return State.allCases.flatMap { state in
      Array(repeating: state, count: max(0, cells[state.rawValue]))
    }
  }

  /// Each state's share of `count` cells by largest remainder, so the shares add up to `count`.
  private static func share(count: Int, lessons: [Int], total: Int) -> [Int] {
    let exact = lessons.map { Double($0 * count) / Double(total) }
    var cells = exact.map { Int($0.rounded(.down)) }
    let left = count - cells.reduce(0, +)

    // Ties keep the states' order, as main's stable sort does.
    let byRemainder = exact.indices.sorted {
      let (one, other) = (exact[$0].remainder(), exact[$1].remainder())
      return one == other ? $0 < $1 : one > other
    }

    for state in byRemainder.prefix(left) {
      cells[state] += 1
    }

    return cells
  }

  private static func giveEveryStateACell(_ cells: [Int], _ lessons: [Int]) -> [Int] {
    lessons.indices.reduce(into: cells) { result, state in
      guard lessons[state] > 0, result[state] == 0, let most = result.max(),
        let largest = result.firstIndex(of: most)
      else {
        return
      }

      result[largest] -= 1
      result[state] = 1
    }
  }
}

extension Double {
  /// What's left after the whole part.
  fileprivate func remainder() -> Double {
    self - rounded(.down)
  }
}
