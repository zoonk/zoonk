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

          remaining(left)
            .font(.subheadline)
            .monospacedDigit()

          Spacer()

          BrainPowerReward(points: bonus, earned: false)
        }

        MissionTrack(missions: missions)
      }
    }
  }

  private func remaining(_ left: [StudyMission]) -> Text {
    let count =
      left.count == missions.count
      ? Text(
        "\(left.count) missions", tableName: "Today",
        comment: "How many missions today has, before any is done")
      : Text("\(left.count) left", tableName: "Today", comment: "Today's missions still to do")
    let minutes = minutesLeft(left)

    guard minutes > 0 else {
      return count
    }

    return Text(
      "\(count) · ~\(studyDuration(minutes: minutes))", tableName: "Today",
      comment: "Today's missions and the time they take, such as “2 missions · ~12 min”")
  }

  private func minutesLeft(_ missions: [StudyMission]) -> Int {
    Int(missions.reduce(0) { $0 + ($1.minutes ?? 0) }.rounded())
  }
}
