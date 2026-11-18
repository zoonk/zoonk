import SwiftUI

struct ScoreAxisLabel: Equatable {
  let index: Int
  let anchor: UnitPoint
}

func scoreAxisLabels(count: Int, width: Double, labelWidth: Double) -> [ScoreAxisLabel] {
  guard count > 0 else { return [] }
  let slots = min(count, max(2, Int(width / max(labelWidth, 1))))
  let indices =
    slots == 1
    ? [0]
    : (0..<slots).map {
      Int((Double($0) * Double(count - 1) / Double(slots - 1)).rounded())
    }
  return indices.map { index in
    ScoreAxisLabel(
      index: index,
      anchor: index == 0 ? .topLeading : index == count - 1 ? .topTrailing : .top)
  }
}
