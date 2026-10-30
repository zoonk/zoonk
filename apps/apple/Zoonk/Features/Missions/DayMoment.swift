import SwiftUI

struct DayResult: Decodable, Hashable, Sendable {
  struct MissionMoment: Decodable, Hashable, Sendable {
    struct FullMeal: Decodable, Hashable, Sendable {
      let bonus: Int
      let paid: Bool
    }

    let completed: [StudyMission.Kind]
    let fullMeal: FullMeal
    let missions: [StudyMission]
  }

  struct Reached: Decodable, Hashable, Sendable {
    struct Level: Decodable, Hashable, Sendable {
      let color: String
      let level: Int
    }

    /// The tenth of Energy reached going up (60, 80, 100).
    let energy: Int?
    let level: Level?
  }

  let ceremony: Milestone?
  let missionMoment: MissionMoment?
  let reached: Reached?

  init(ceremony: Milestone?, missionMoment: MissionMoment?, reached: Reached?) {
    self.ceremony = ceremony
    self.missionMoment = missionMoment
    self.reached = reached
  }

  init?(_ completion: some Encodable) {
    guard let result = try? StudyJSON.recode(completion, as: DayResult.self) else {
      return nil
    }

    self = result
  }

  var isEmpty: Bool {
    missionMoment == nil && reached?.level == nil && reached?.energy == nil
  }
}

/// Main's `DayMoment`: the missions this work completed, then the level and Energy it reached, a
/// beat after them.
struct DayMomentSections: View {
  let result: DayResult

  var body: some View {
    DayMomentContent(result: result)
      .celebratesOnce(id: result)
  }
}

private struct DayMomentContent: View {
  @Environment(LearnerSummaryStore.self) private var learner
  @Environment(\.celebrates) private var celebrates

  let result: DayResult

  private var buddy: String {
    learner.buddyDisplayName
  }

  private var level: DayResult.Reached.Level? {
    result.reached?.level
  }

  private var afterMissions: TimeInterval {
    guard let moment = result.missionMoment, moment.isShown else { return .beat }
    return moment.isPayoff ? 3 * .beat : 2 * .beat
  }

  var body: some View {
    if let moment = result.missionMoment, moment.isShown {
      missions(moment)
    }

    if let level, let belt = ProgressBelt(rawValue: level.color) {
      Section {
        VStack(alignment: .leading, spacing: 8) {
          HStack(spacing: 12) {
            LevelBadge(belt: belt, level: level.level)
              .settles(delay: afterMissions)

            VStack(alignment: .leading, spacing: 2) {
              Text("Level up!", tableName: "Session", comment: "A new belt level")
                .font(.headline)
              Text(
                "\(beltName(level.color) ?? level.color), level \(level.level)",
                tableName: "Session", comment: "The belt and level reached"
              )
              .font(.subheadline)
              .foregroundStyle(.secondary)
            }
          }

          BeltTicks(
            belt: belt, level: level.level, fillsNewLevel: true, delay: afterMissions)
        }
        .accessibilityElement(children: .combine)
      }
    }

    if let energy = result.reached?.energy {
      Section {
        VStack(alignment: .leading, spacing: 8) {
          HStack(spacing: 12) {
            EnergyMark(delay: level == nil ? afterMissions : afterMissions + .beat)

            VStack(alignment: .leading, spacing: 2) {
              Group {
                if energy >= 100 {
                  Text("Max Energy: \(energy)%", tableName: "Session", comment: "Energy at its top")
                } else {
                  Text(
                    "Energy at \(energy)%", tableName: "Session", comment: "A new tenth of Energy")
                }
              }
              .font(.headline)

              energyLine(energy)
                .font(.subheadline)
                .foregroundStyle(.secondary)
            }
          }

          // Where Energy is now: the moment doesn't know where it came from.
          ProgressView(value: Double(min(energy, 100)), total: 100)
            .tint(.energy)
        }
        .accessibilityElement(children: .combine)
      }
    }
  }

  private func missions(_ moment: DayResult.MissionMoment) -> some View {
    let justDone = moment.justDone
    let payoff = moment.isPayoff

    return Section {
      ForEach(Array(moment.missions.enumerated()), id: \.offset) { _, mission in
        MissionRow(
          mission: mission, buddyName: buddy,
          justDone: justDone.firstIndex(of: mission))
      }
    } header: {
      VStack(alignment: .leading, spacing: 12) {
        HStack(spacing: payoff ? 16 : 12) {
          MissionsBuddy(look: learner.summary.value?.buddy ?? BuddyLook(), isPayoff: payoff)
            // Each result's missions are its own moment, even on a screen that stays.
            .id(moment.completed)

          VStack(alignment: .leading, spacing: payoff ? 8 : 2) {
            missionsTitle(moment, justDone: justDone.count)
              .font(payoff ? .title3.bold() : .headline)
              .foregroundStyle(.primary)

            if payoff {
              bonus(moment.fullMeal.bonus)
            } else {
              missionsStatus(moment)
                .font(.footnote)
                .foregroundStyle(.secondary)
            }
          }
          .accessibilityElement(children: .combine)
        }

        MissionTrack(
          missions: moment.missions, from: celebrates ? moment.before : nil, delay: .beat)
      }
      .textCase(nil)
      .padding(.bottom, 4)
    }
  }

  private func missionsTitle(_ moment: DayResult.MissionMoment, justDone: Int) -> Text {
    if moment.left == 0 {
      return Text("Today's missions done!", tableName: "Session", comment: "Every mission is done")
    }

    return Text(
      "\(justDone) missions done!", tableName: "Session", comment: "Missions this result completed")
  }

  private func missionsStatus(_ moment: DayResult.MissionMoment) -> Text {
    let bonus = moment.fullMeal.bonus

    if moment.left > 0 {
      return Text(
        "\(moment.left) more for +\(bonus) Brain Power", tableName: "Session",
        comment: "Missions still to do today, then the bonus finishing them earns")
    }

    if moment.fullMeal.paid {
      return Text(
        "You earned +\(bonus) Brain Power.", tableName: "Session",
        comment: "The bonus for every mission done")
    }

    return Text(
      "Today's +\(bonus) Brain Power is already earned.", tableName: "Session",
      comment: "Another goal already earned the day's missions bonus")
  }

  private func bonus(_ points: Int) -> some View {
    HStack(alignment: .firstTextBaseline, spacing: 6) {
      EarnedNumber(value: points, delay: 2 * .beat)
        .font(.largeTitle.weight(.semibold))
        .foregroundStyle(.brain)

      Text("Brain Power", tableName: "Session", comment: "Under the missions' bonus")
        .font(.subheadline.weight(.medium))
        .foregroundStyle(.secondary)
    }
    .settles(delay: 2 * .beat, from: 0.9)
    .background(alignment: .leading) {
      if celebrates {
        Burst(delay: 3 * .beat)
          .offset(x: 36)
      }
    }
    .accessibilityElement(children: .ignore)
    .accessibilityLabel(
      Text(
        "You earned +\(points) Brain Power.", tableName: "Session",
        comment: "The bonus for every mission done"))
  }

  private func energyLine(_ energy: Int) -> Text {
    if energy >= 100 {
      return Text(
        "\(buddy) is glowing as bright as it gets.", tableName: "Session",
        comment: "Energy at its top")
    }

    // Main's `GLOWING_ENERGY`: the buddy starts glowing at 80.
    if energy == 80 {
      return Text(
        "\(buddy) is glowing now.", tableName: "Session", comment: "Energy at 80% or more")
    }

    return Text(
      "Right answers raise it. A day away lowers it a little.", tableName: "Session",
      comment: "What moves Energy")
  }
}

extension DayResult.MissionMoment {
  var justDone: [StudyMission] {
    missions.filter { $0.isDone && completed.contains($0.kind) }
  }

  var left: Int {
    missions.filter { !$0.isDone }.count
  }

  var isShown: Bool {
    !justDone.isEmpty || fullMeal.paid
  }

  var isPayoff: Bool {
    fullMeal.paid && left == 0
  }

  /// Each mission this work completed, a step before it.
  var before: [StudyMission] {
    missions.map { mission in
      guard justDone.contains(mission) else { return mission }

      return StudyMission(
        detail: mission.detail, done: max(0, mission.total - 1), kind: mission.kind,
        minutes: mission.minutes, opens: mission.opens, status: mission.status,
        total: mission.total, waitReason: mission.waitReason)
    }
  }
}

private struct EnergyMark: View {
  let delay: TimeInterval

  @Environment(\.celebrates) private var celebrates
  @Environment(\.accessibilityReduceMotion) private var reduceMotion
  @State private var pops = false
  @ScaledMetric(relativeTo: .body) private var size = 40.0

  var body: some View {
    Image(systemName: "bolt.fill")
      .font(.title3)
      .foregroundStyle(.energy)
      .symbolEffect(.bounce, value: pops)
      .frame(width: size, height: size)
      .accessibilityHidden(true)
      .task {
        guard celebrates, !reduceMotion else { return }
        try? await Task.sleep(for: .seconds(delay))
        pops = true
      }
  }
}

private struct MissionsBuddy: View {
  @Environment(\.celebrates) private var celebrates

  let look: BuddyLook
  let isPayoff: Bool

  var body: some View {
    var studied = look
    studied.studiedToday = true

    return Group {
      if isPayoff {
        BuddyCharacter(
          look: studied, expression: .happy,
          reaction: celebrates ? ActReaction(act: .cheer, delay: 2 * .beat) : nil
        )
        .frame(width: 96, height: 96)
      } else {
        BuddyCharacter(
          look: studied, expression: .neutral, crop: .face,
          reaction: celebrates ? ActReaction(act: .smile, delay: .beat) : nil
        )
        .frame(width: 48, height: 48)
      }
    }
  }
}
