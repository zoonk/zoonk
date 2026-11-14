import SwiftUI

/// Main's missions header: the buddy in its ring, "Today's missions" with how many are done, the
/// day's bonus and the track. With `isOpen`, a press on the title shows or hides the missions.
struct MissionsSummary: View {
  @Environment(LearnerSummaryStore.self) private var learner

  let missions: [StudyMission]
  let bonus: Int
  let earned: Bool
  var isOpen: Binding<Bool>?

  var body: some View {
    let done = missions.filter(\.isDone).count

    if earned && done == missions.count {
      AccessibilityStack(spacing: 8) {
        Text("Missions done", tableName: "Today", comment: "Today's missions are done")
          .typeStyle(.body.weight(.medium))
          .frame(maxWidth: .infinity, alignment: .leading)
        BrainPowerReward(points: bonus, earned: true)
      }
    } else {
      VStack(alignment: .leading, spacing: 12) {
        MarkedRow(alignment: .center, stackedSpacing: 8) {
          MissionsRing(done: done, total: missions.count) {
            let buddy = learner.summary.value?.buddy ?? BuddyLook()
            BuddyFace(kind: buddy.kind, glasses: buddy.glasses)
          }
        } content: {
          if let isOpen {
            Button {
              isOpen.wrappedValue.toggle()
            } label: {
              title(done: done, isOpen: isOpen.wrappedValue)
            }
            .buttonStyle(.plain)
            .accessibilityValue(
              isOpen.wrappedValue
                ? Text("Shown", tableName: "Today", comment: "The missions' list is open")
                : Text("Hidden", tableName: "Today", comment: "The missions' list is closed"))
          } else {
            title(done: done, isOpen: nil)
          }
        } end: {
          BrainPowerReward(points: bonus, earned: false)
        }

        MissionTrack(missions: missions)
      }
    }
  }

  private func title(done: Int, isOpen: Bool?) -> some View {
    VStack(alignment: .leading, spacing: 2) {
      HStack(spacing: 6) {
        Text("Today's missions", tableName: "Today", comment: "Today's missions header")
          .typeStyle(.rowTitle)

        if let isOpen {
          Image(systemName: "chevron.down")
            .imageScale(.small)
            .foregroundStyle(.mutedForeground)
            .rotationEffect(.degrees(isOpen ? 0 : -90))
            .accessibilityHidden(true)
        }
      }

      Text(
        "\(done) of \(missions.count) done", tableName: "Today",
        comment: "How many of today's missions are done"
      )
      .typeStyle(.meta)
      .foregroundStyle(.mutedForeground)
    }
    .frame(maxWidth: .infinity, alignment: .leading)
    .contentShape(.rect)
  }
}
