import SwiftUI

struct MissionsSummary: View {
  @Environment(LearnerSummaryStore.self) private var learner

  let missions: [StudyMission]
  let bonus: Int
  let earned: Bool

  var body: some View {
    let left = missions.filter { !$0.isDone }

    if earned {
      if left.isEmpty {
        HStack {
          Text("Missions done", tableName: "Today", comment: "Today's missions are done")
            .font(.body.weight(.medium))
          Spacer()
          BrainPowerReward(points: bonus, earned: true)
        }
      } else {
        Text(
          "Today's +\(bonus) Brain Power is already earned.", tableName: "Today",
          comment: "Another goal already earned the day's missions reward"
        )
        .foregroundStyle(.secondary)
      }
    } else {
      VStack(alignment: .leading, spacing: 12) {
        HStack(spacing: 10) {
          MissionsRing(done: missions.count - left.count, total: missions.count) {
            let buddy = learner.summary.value?.buddy ?? BuddyLook()
            BuddyFace(kind: buddy.kind, glasses: buddy.glasses)
          }

          Text(
            "\(left.count) left · ~\(studyDuration(minutes: minutesLeft(left)))",
            tableName: "Today", comment: "Missions left and their time"
          )
          .font(.subheadline)
          .monospacedDigit()

          Spacer()

          BrainPowerReward(points: bonus, earned: false)
        }

        MissionTrack(missions: missions)
      }
    }
  }

  private func minutesLeft(_ missions: [StudyMission]) -> Int {
    Int(missions.reduce(0) { $0 + ($1.minutes ?? 0) }.rounded())
  }
}
