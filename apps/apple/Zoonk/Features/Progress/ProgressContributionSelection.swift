import CoreGraphics

enum ProgressContributionSelection {
  static func nearestPoint(
    to location: CGPoint,
    in weeks: [ProgressContributionWeek],
    cellSize: CGFloat,
    headerHeight: CGFloat
  ) -> ProgressContributionPoint? {
    guard cellSize > 0, location.y >= headerHeight else {
      return nil
    }

    return candidates(
      in: weeks,
      cellSize: cellSize,
      headerHeight: headerHeight
    )
    .min { lhs, rhs in
      lhs.distanceSquared(to: location) < rhs.distanceSquared(to: location)
    }?
    .point
  }

  private static func candidates(
    in weeks: [ProgressContributionWeek],
    cellSize: CGFloat,
    headerHeight: CGFloat
  ) -> [Candidate] {
    weeks.enumerated().flatMap { weekIndex, week in
      week.slots.enumerated().compactMap { dayIndex, slot in
        candidate(
          for: slot,
          weekIndex: weekIndex,
          dayIndex: dayIndex,
          cellSize: cellSize,
          headerHeight: headerHeight)
      }
    }
  }

  private static func candidate(
    for slot: ProgressContributionSlot,
    weekIndex: Int,
    dayIndex: Int,
    cellSize: CGFloat,
    headerHeight: CGFloat
  ) -> Candidate? {
    guard let point = slot.point else {
      return nil
    }

    return Candidate(
      point: point,
      center: CGPoint(
        x: (CGFloat(weekIndex) + 0.5) * cellSize,
        y: headerHeight + (CGFloat(dayIndex) + 0.5) * cellSize))
  }
}

private struct Candidate {
  let point: ProgressContributionPoint
  let center: CGPoint

  func distanceSquared(to location: CGPoint) -> CGFloat {
    let horizontalDistance = center.x - location.x
    let verticalDistance = center.y - location.y
    return horizontalDistance * horizontalDistance + verticalDistance * verticalDistance
  }
}
