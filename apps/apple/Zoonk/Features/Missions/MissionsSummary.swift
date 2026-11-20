import SwiftUI

/// Main's missions header: "Today's missions", then the track with the day's bonus at its end. With
/// `isOpen`, a press on the title shows or hides the missions; with `collapsesWhenWon`, a won day
/// is one line.
struct MissionsSummary: View {
  let missions: [StudyMission]
  let bonus: Int
  let earned: Bool
  var isOpen: Binding<Bool>?
  var collapsesWhenWon = true

  var body: some View {
    let done = missions.filter(\.isDone).count
    let won = earned && done == missions.count

    if won && collapsesWhenWon {
      AccessibilityStack(spacing: 8) {
        Text("Missions done", tableName: "Today", comment: "Today's missions are done")
          .typeStyle(.body.weight(.medium))
          .frame(maxWidth: .infinity, alignment: .leading)
        BrainPowerReward(points: bonus, earned: true)
      }
    } else {
      VStack(alignment: .leading, spacing: 12) {
        if let isOpen {
          Button {
            isOpen.wrappedValue.toggle()
          } label: {
            title(won: won, isOpen: isOpen.wrappedValue)
          }
          .buttonStyle(.plain)
          .accessibilityValue(
            isOpen.wrappedValue
              ? Text("Shown", tableName: "Today", comment: "The missions' list is open")
              : Text("Hidden", tableName: "Today", comment: "The missions' list is closed"))
        } else {
          title(won: won, isOpen: nil)
        }

        HStack(spacing: 12) {
          MissionTrack(
            missions: missions,
            label: Text(
              String(
                localized: "missionsDone", defaultValue: "\(done) of \(missions.count) done",
                table: "Today",
                comment: "Under the title Today's missions: how many of today's missions are done."
              )))

          BrainPowerReward(points: bonus, earned: won)
            .fixedSize()
        }
      }
    }
  }

  private func title(won: Bool, isOpen: Bool?) -> some View {
    HStack(spacing: 6) {
      (won
        ? Text("Missions done", tableName: "Today", comment: "Today's missions are done")
        : Text("Today's missions", tableName: "Today", comment: "Today's missions header"))
        .typeStyle(.rowTitle)

      if let isOpen {
        Image(systemName: "chevron.down")
          .imageScale(.small)
          .foregroundStyle(.mutedForeground)
          .rotationEffect(.degrees(isOpen ? 0 : -90))
          .accessibilityHidden(true)
      }
    }
    .frame(maxWidth: .infinity, alignment: .leading)
    .contentShape(.rect)
  }
}
