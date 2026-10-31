import SwiftUI

/// Main's `MissionTrack`: a segment per mission, the furthest along first. With `from`, the
/// segments this work moved fill from where they were.
struct MissionTrack: View {
  let missions: [StudyMission]
  var from: [StudyMission]?
  var delay: TimeInterval = 0

  private static func fill(_ mission: StudyMission) -> Double {
    mission.total > 0 ? min(1, Double(mission.done) / Double(mission.total)) : 0
  }

  var body: some View {
    let fills = missions.map(Self.fill).sorted(by: >)
    let before = missions.map { mission in
      from?.first { $0.kind == mission.kind }.map(Self.fill) ?? Self.fill(mission)
    }
    .sorted(by: >)
    let moved = zip(fills, before).map { $0 > $1 }

    HStack(spacing: 2) {
      ForEach(fills.indices, id: \.self) { index in
        MeterSegment(
          share: fills[index], from: moved[index] ? before[index] : nil, color: .brain,
          track: .brain.opacity(0.18),
          delay: delay + Double(moved[..<index].filter { $0 }.count) * .stagger)
      }
    }
    .frame(height: 6)
    .accessibilityHidden(true)
  }
}
