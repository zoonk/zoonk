import SwiftUI

struct StudyMission: Decodable, Equatable, Sendable {
  enum Kind: String, Decodable, Sendable {
    case askBuddy
    case call
    case challenge
    case essay
    case finishChapter
    case fixMistake
    case mock
    case pattern
    case practice
    case pronunciation
    case review
    case somethingNew
    case weakSpot
    case weeklyChallenge
  }

  struct Detail: Decodable, Equatable, Sendable {
    let areaTitle: String?
    let chapterTitle: String?
    let patternTitle: String?
    let rematch: Bool?
    let title: String?
  }

  /// A block by id, or by its place on a day not opened yet.
  struct Opens: Decodable, Equatable, Sendable {
    struct Ref: Decodable, Equatable, Sendable {
      let position: Int
    }

    let kind: String
    let areaId: String?
    let blockId: String?
    let chapterId: String?
    let patternId: String?
    let ref: Ref?
  }

  let detail: Detail?
  let done: Int
  let kind: Kind
  let minutes: Double?
  let opens: Opens?
  let status: String
  let total: Int
  let waitReason: StudyBlock.WaitReason?

  var isDone: Bool { status == "done" }

  func opens(_ block: StudyBlock) -> Bool {
    guard let opens, opens.kind == "block" else {
      return false
    }

    if let blockId = opens.blockId {
      return blockId == block.id
    }

    return opens.ref?.position == block.position
  }
}

extension StudyMission {
  init?(_ mission: Components.Schemas.StudyMission) {
    guard let mission = try? StudyJSON.recode(mission, as: StudyMission.self) else {
      return nil
    }

    self = mission
  }
}

extension StudyMission {
  func name(buddy: String) -> String {
    switch kind {
    case .review:
      String(localized: "Review", table: "Today", comment: "Mission: do the day's review")
    case .somethingNew:
      String(localized: "Do a new lesson", table: "Today", comment: "Mission: a new lesson")
    case .finishChapter:
      detail?.chapterTitle.map {
        String(localized: "Finish “\($0)”", table: "Today", comment: "Mission: finish a chapter")
      }
        ?? String(localized: "Finish the chapter", table: "Today", comment: "Mission")
    case .challenge:
      detail?.rematch == true
        ? String(
          localized: "Rematch the Trickster", table: "Today", comment: "Mission: a rematch")
        : String(
          localized: "Take on the Trickster", table: "Today", comment: "Mission: a phase challenge")
    case .weeklyChallenge:
      String(localized: "Weekly challenge", table: "Today", comment: "The week's challenge block")
    case .mock:
      String(localized: "Take the mock", table: "Today", comment: "Mission: a mock exam")
    case .essay:
      String(localized: "Practice writing", table: "Today", comment: "Mission: write an essay")
    case .practice:
      String(localized: "Practice", table: "Today", comment: "Mission: practice")
    case .fixMistake:
      String(localized: "Fix \(total) mistakes", table: "Today", comment: "Mission: fix mistakes")
    case .pattern:
      String(localized: "Practice a pattern", table: "Today", comment: "Mission: a pattern")
    case .pronunciation:
      String(localized: "Pronunciation", table: "Today", comment: "Mission: pronunciation")
    case .call:
      String(localized: "Have a call", table: "Today", comment: "Mission: a practice call")
    case .askBuddy:
      String(
        localized: "Ask \(buddy) something", table: "Today", comment: "Mission: ask the buddy")
    case .weakSpot:
      detail?.areaTitle.map {
        String(localized: "Practice \($0)", table: "Today", comment: "Mission: practice an area")
      } ?? String(localized: "Practice", table: "Today", comment: "Mission: practice")
    }
  }

  /// Mirrors main's `useMissionStep`: only Today knows the block a mission opens.
  func step(block: StudyBlock?) -> String? {
    switch waitReason {
    case .lessons:
      return String(localized: "After today's lessons", table: "Today", comment: "Mission waits")
    case .challenge:
      return String(
        localized: "After the challenge before it", table: "Today", comment: "Mission waits")
    case nil:
      break
    }

    switch kind {
    case .fixMistake:
      return String(
        localized: "From your mistakes notebook", table: "Today", comment: "Where a mission is done"
      )
    case .pattern:
      return detail?.patternTitle
    case .pronunciation:
      return String(localized: "Due today", table: "Today", comment: "Pronunciation mission")
    case .call:
      return detail?.chapterTitle.map {
        String(localized: "Quick call · \($0)", table: "Today", comment: "A call mission's unit")
      } ?? String(localized: "A quick call", table: "Today", comment: "A call mission")
    case .askBuddy:
      return String(
        localized: "Anything about today's lessons", table: "Today", comment: "Ask buddy mission")
    case .finishChapter:
      return chapterStep
    default:
      break
    }

    if let title = detail?.title {
      return title
    }

    if let block, kind != .weeklyChallenge, kind != .mock {
      return block.displayTitle
    }

    switch kind {
    case .review:
      return (minutes ?? 0) > 5
        ? String(localized: "Reviews", table: "Today", comment: "A review block longer than 5 min")
        : String(localized: "Quick review", table: "Today", comment: "A short review block")
    case .somethingNew:
      return String(
        localized: "Finish today's new lesson", table: "Today",
        comment: "Mission: the step that finishes the day's new lesson")
    case .weakSpot:
      return String(
        localized: "Most room to grow", table: "Today",
        comment: "Mission: the area where the learner has the most to gain")
    default:
      return nil
    }
  }

  private var chapterStep: String {
    let more = total - done - 1

    guard let title = detail?.title else {
      return String(
        localized: "The last \(total - done) lessons are in today's plan", table: "Today",
        comment: "Mission to finish a chapter whose remaining lessons are all in today's plan")
    }

    return more > 0
      ? String(
        localized: "\(title) (+\(more) lessons)", table: "Today",
        comment: "The chapter's next lesson, then how many more the mission needs")
      : title
  }
}

struct MissionRow: View {
  @Environment(LearnerSummaryStore.self) private var learner

  let mission: StudyMission
  let buddyName: String
  var block: StudyBlock?
  var open: (() -> Void)?

  private var waits: Bool { mission.waitReason != nil }

  private var opensSomewhere: Bool {
    open != nil && !mission.isDone && !waits && mission.opens != nil
  }

  var body: some View {
    let row = HStack(alignment: .firstTextBaseline, spacing: 12) {
      mark
        .frame(minWidth: 20)

      VStack(alignment: .leading, spacing: 2) {
        Text(mission.name(buddy: buddyName))
          .foregroundStyle(mission.isDone || waits ? .secondary : .primary)

        if !mission.isDone, !detail.isEmpty {
          Text(verbatim: detail.joined(separator: " · "))
            .font(.footnote)
            .monospacedDigit()
            .foregroundStyle(.secondary)
        }
      }

      Spacer(minLength: 8)

      if !mission.isDone, !waits, mission.opens?.kind == "block" {
        Image(systemName: "target")
          .foregroundStyle(.brain)
          .accessibilityHidden(true)
      }

      if opensSomewhere {
        Image(systemName: "chevron.right")
          .font(.footnote.weight(.semibold))
          .foregroundStyle(.tertiary)
          .accessibilityHidden(true)
      }
    }
    .accessibilityElement(children: .combine)
    .accessibilityValue(
      mission.isDone ? Text("Done", tableName: "Today", comment: "A mission that's done") : Text("")
    )

    if let open, opensSomewhere {
      Button(action: open) {
        row
      }
      .tint(.primary)
    } else {
      row
    }
  }

  @ViewBuilder
  private var mark: some View {
    if mission.isDone {
      StatusMark(status: .done)
    } else if mission.kind == .askBuddy {
      let buddy = learner.summary.value?.buddy ?? BuddyLook()
      BuddyFace(kind: buddy.kind, glasses: buddy.glasses)
    } else {
      KindMark(kind: mission.kind.learnKind)
    }
  }

  private var detail: [String] {
    var parts: [String] = []

    if mission.total > 1 {
      parts.append("\(mission.done)/\(mission.total)")
    }

    if let step = mission.step(block: block) {
      parts.append(step)
    }

    if let minutes = mission.minutes, minutes > 0 {
      let duration = studyDuration(minutes: max(1, Int(minutes.rounded())))
      parts.append(
        mission.kind.isEstimated
          ? String(
            localized: "~\(duration)", table: "Today",
            comment: "About how long a mission outside the day's blocks takes, as in ~5 min")
          : duration)
    }

    return parts
  }
}

extension StudyMission.Kind {
  /// Mirrors main's `MISSION_MARKS`.
  var learnKind: LearnKind {
    switch self {
    case .call: .conversation
    case .challenge, .weeklyChallenge: .challenge
    case .essay: .essay
    case .finishChapter, .somethingNew, .askBuddy: .lesson
    case .fixMistake, .pattern: .mistakes
    case .mock: .mock
    case .practice, .weakSpot: .practice
    case .pronunciation, .review: .review
    }
  }

  /// Mirrors main's `ESTIMATED_KINDS`: done outside the day's blocks, so its minutes are an estimate.
  var isEstimated: Bool {
    switch self {
    case .askBuddy, .call, .fixMistake, .pattern, .pronunciation: true
    default: false
    }
  }
}
