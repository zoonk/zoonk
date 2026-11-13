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
  /// Unshown, oldest first.
  let certificates: [CertificateFacts]
  let missionMoment: MissionMoment?
  let reached: Reached?

  init(
    ceremony: Milestone?, certificates: [CertificateFacts], missionMoment: MissionMoment?,
    reached: Reached?
  ) {
    self.ceremony = ceremony
    self.certificates = certificates
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
    moment(hasChapter: false) == nil
  }
}

/// Main's `DayMoment` (B2's R2): at most one extra moment at a block's end, the first that applies:
/// the belt's number moved, today's missions all done, a chapter finished, then one mission done.
/// Energy never shows here. A new belt's number isn't said twice: its ceremony shows before.
struct DayMomentSections: View {
  let result: DayResult
  var chapter: Components.Schemas.FinishedChapter?

  var body: some View {
    DayMomentContent(result: result, chapter: chapter)
      .celebratesOnce(id: result)
  }
}

extension DayResult {
  enum Moment {
    case belt(ProgressBelt, level: Int)
    case missionsDone(MissionMoment)
    case chapter
    case missionDone(MissionMoment)
  }

  func moment(hasChapter: Bool) -> Moment? {
    if ceremony?.kind != "belt", let level = reached?.level,
      let belt = ProgressBelt(rawValue: level.color)
    {
      return .belt(belt, level: level.level)
    }

    if let missions = missionMoment, missions.isPayoff {
      return .missionsDone(missions)
    }

    if hasChapter {
      return .chapter
    }

    if let missions = missionMoment, !missions.justDone.isEmpty {
      return .missionDone(missions)
    }

    return nil
  }
}

private struct DayMomentContent: View {
  @Environment(LearnerSummaryStore.self) private var learner
  @Environment(\.celebrates) private var celebrates

  let result: DayResult
  let chapter: Components.Schemas.FinishedChapter?

  var body: some View {
    switch result.moment(hasChapter: chapter != nil) {
    case .belt(let belt, let level):
      Section {
        BeltStepRow(belt: belt, level: level)
      }
    case .missionsDone(let moment):
      missions(moment, payoff: true)
    case .chapter:
      if let chapter {
        FinishedChapterSection(chapter: chapter)
      }
    case .missionDone(let moment):
      missions(moment, payoff: false)
    case nil:
      EmptyView()
    }
  }

  private func missions(_ moment: DayResult.MissionMoment, payoff: Bool) -> some View {
    Section {
      VStack(alignment: .leading, spacing: 12) {
        HStack(spacing: payoff ? 16 : 12) {
          MissionsBuddy(look: learner.summary.value?.buddy ?? BuddyLook(), isPayoff: payoff)
            // Each result's missions are its own moment, even on a screen that stays.
            .id(moment.completed)

          VStack(alignment: .leading, spacing: payoff ? 8 : 2) {
            missionsTitle(moment)
              .typeStyle(payoff ? .section : .body.weight(.semibold))

            if payoff {
              bonus(moment.fullMeal.bonus)
            } else {
              Text(
                "\(moment.left) more for +\(moment.fullMeal.bonus) Brain Power",
                tableName: "Session",
                comment: "Missions still to do today, then the bonus finishing them earns"
              )
              .typeStyle(.meta)
              .foregroundStyle(.mutedForeground)
            }
          }
          .accessibilityElement(children: .combine)
        }

        MissionTrack(
          missions: moment.missions, from: celebrates ? moment.before : nil, delay: .beat)
      }
    }
  }

  private func missionsTitle(_ moment: DayResult.MissionMoment) -> Text {
    if moment.left == 0 {
      return Text("Today's missions done!", tableName: "Session", comment: "Every mission is done")
    }

    return moment.justDone.count == 1
      ? Text("Mission done!", tableName: "Session", comment: "One mission this work completed")
      : Text(
        "\(moment.justDone.count) missions done!", tableName: "Session",
        comment: "Missions this work completed, when it completed more than one")
  }

  private func bonus(_ points: Int) -> some View {
    HStack(alignment: .firstTextBaseline, spacing: 6) {
      EarnedNumber(value: points, delay: 2 * .beat)
        .typeStyle(.heroTitle)
        .foregroundStyle(.brainText)

      Text("Brain Power", tableName: "Session", comment: "Under the missions' bonus")
        .typeStyle(.note.weight(.medium))
        .foregroundStyle(.mutedForeground)
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
}

/// The belt's number, taught by the row itself: the badge, "White belt 3", which belt comes after
/// this one's tenth step, and the ten ticks.
struct BeltStepRow: View {
  let belt: ProgressBelt
  let level: Int
  var delay: TimeInterval = 0

  var body: some View {
    VStack(alignment: .leading, spacing: 8) {
      HStack(spacing: 12) {
        LevelBadge(belt: belt, level: level)
          .settles(delay: delay)

        VStack(alignment: .leading, spacing: 2) {
          Text(beltStep(belt, level))
            .typeStyle(.body.weight(.semibold))

          if let next = belt.next {
            Text(
              "\(beltName(next.rawValue) ?? "") comes after \(beltName(belt.rawValue) ?? "") \(10)",
              tableName: "Session",
              comment:
                "Under the belt's number: the next belt, then this belt and its last step, such as \"Yellow belt comes after White belt 10\""
            )
            .typeStyle(.note)
            .foregroundStyle(.mutedForeground)
          }
        }
      }

      BeltTicks(belt: belt, level: level, fillsNewLevel: true, delay: delay)
    }
    .accessibilityElement(children: .combine)
  }
}

/// "White belt 3": the belt and its step, never called a level (B2's R4).
func beltStep(_ belt: ProgressBelt, _ level: Int) -> String {
  String(
    localized: "\(beltName(belt.rawValue) ?? belt.rawValue) \(level)", table: "Session",
    comment: "A belt and its step from 1 to 10, such as \"White belt 3\"")
}

extension ProgressBelt {
  var next: ProgressBelt? {
    let all = Self.allCases
    return all.firstIndex(of: self).flatMap { $0 + 1 < all.count ? all[$0 + 1] : nil }
  }
}

extension DayResult.MissionMoment {
  var justDone: [StudyMission] {
    missions.filter { $0.isDone && completed.contains($0.kind) }
  }

  var left: Int {
    missions.filter { !$0.isDone }.count
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
        .frame(width: 112, height: 112)
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
