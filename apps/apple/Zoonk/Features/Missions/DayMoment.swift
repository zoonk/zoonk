import SwiftUI

/// What a learner's work did to their day, the same on every result that earns Brain Power or
/// Energy (a block, a call, a pronunciation round): the missions it completed with the day's bonus
/// when it paid it, the belt level it reached and the tenth of Energy it reached, and the milestone
/// whose ceremony opens the result (main's `DayMoment`). Read from any completion that carries
/// `missionMoment`, `reached` and `ceremony`.
struct DayResult: Decodable, Equatable, Sendable {
  struct MissionMoment: Decodable, Equatable, Sendable {
    struct FullMeal: Decodable, Equatable, Sendable {
      let bonus: Int
      let paid: Bool
    }

    let completed: [StudyMission.Kind]
    let fullMeal: FullMeal
    let missions: [StudyMission]
  }

  struct Reached: Decodable, Equatable, Sendable {
    struct Level: Decodable, Equatable, Sendable {
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

  /// A completion read through the generated client (a call, a round), as its day moment.
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

/// The day's part of a result, as sections under the result's own: the missions it completed (all
/// the day's, those just done marked), the bonus once every mission is done, then a new belt level
/// and a new tenth of Energy. Nothing when it did none of that.
struct DayMomentSections: View {
  @Environment(LearnerSummaryStore.self) private var learner

  let result: DayResult
  /// Whether the buddy acts out the missions now; a copy shown before the result's own screen
  /// draws it still in the pose it starts from, so the act plays once.
  var celebrates = true

  private var buddy: String {
    learner.buddyDisplayName
  }

  var body: some View {
    if let moment = result.missionMoment {
      Section {
        ForEach(Array(moment.missions.enumerated()), id: \.offset) { _, mission in
          MissionRow(mission: mission, buddyName: buddy)
        }
      } header: {
        HStack(spacing: moment.fullMeal.paid ? 16 : 12) {
          MissionsBuddy(
            look: learner.summary.value?.buddy ?? BuddyLook(), isPayoff: moment.fullMeal.paid,
            celebrates: celebrates
          )
          // Each result's missions are its own moment, even on a screen that stays.
          .id(moment.completed)

          if moment.fullMeal.paid {
            Text("Today's missions done!", tableName: "Session", comment: "Every mission is done")
          } else {
            Text(
              "\(moment.completed.count) missions done!", tableName: "Session",
              comment: "Missions this result completed")
          }
        }
      } footer: {
        if moment.fullMeal.paid {
          Text(
            "You earned +\(moment.fullMeal.bonus) Brain Power.", tableName: "Session",
            comment: "The bonus for every mission done")
        }
      }
    }

    if let level = result.reached?.level {
      Section {
        Label {
          VStack(alignment: .leading, spacing: 2) {
            Text("Level up!", tableName: "Session", comment: "A new belt level")
              .font(.headline)
            Text(
              "\(beltName(level.color) ?? level.color), level \(level.level)", tableName: "Session",
              comment: "The belt and level reached"
            )
            .foregroundStyle(.secondary)
          }
        } icon: {
          Image(systemName: "figure.martial.arts")
            .foregroundStyle(.brain)
        }
      }
    }

    if let energy = result.reached?.energy {
      Section {
        Label {
          VStack(alignment: .leading, spacing: 2) {
            Group {
              if energy >= 100 {
                Text("Max Energy: \(energy)%", tableName: "Session", comment: "Energy at its top")
              } else {
                Text("Energy at \(energy)%", tableName: "Session", comment: "A new tenth of Energy")
              }
            }
            .font(.headline)

            energyLine(energy)
              .foregroundStyle(.secondary)
          }
        } icon: {
          Image(systemName: "bolt.fill")
            .foregroundStyle(.energy)
        }
      }
    }
  }

  /// What the Energy means: the buddy glowing from 80%, as bright as it gets at 100%.
  private func energyLine(_ energy: Int) -> Text {
    if energy >= 100 {
      return Text(
        "\(buddy) is glowing as bright as it gets.", tableName: "Session",
        comment: "Energy at its top")
    }

    if energy >= 80 {
      return Text(
        "\(buddy) is glowing now.", tableName: "Session", comment: "Energy at 80% or more")
    }

    return Text(
      "Right answers raise it. A day away lowers it a little.", tableName: "Session",
      comment: "What moves Energy")
  }
}

/// The learner's buddy, glad about the missions (main's `MomentBuddy`): beside a mission done its
/// face smiles a beat in, as the mission's check lands; when the day's missions are all done the
/// whole buddy cheers two beats in, as the bonus lands, and violet sparks fly a beat later. It acts
/// with its parts, once; drawn still where the moment doesn't play.
private struct MissionsBuddy: View {
  let look: BuddyLook
  let isPayoff: Bool
  let celebrates: Bool

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
        .background {
          if celebrates {
            Burst(delay: 3 * .beat)
          }
        }
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
