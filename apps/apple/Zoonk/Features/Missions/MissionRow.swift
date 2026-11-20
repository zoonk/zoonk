import SwiftUI

struct StudyMission: Decodable, Hashable, Sendable {
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

  struct Detail: Decodable, Hashable, Sendable {
    let areaTitle: String?
    let chapterTitle: String?
    let patternTitle: String?
    let rematch: Bool?
    let title: String?
  }

  /// A block by id, or by its place on a day not opened yet.
  struct Opens: Decodable, Hashable, Sendable {
    struct Ref: Decodable, Hashable, Sendable {
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
          localized: "Beat the Trickster", table: "Today", comment: "Mission: a phase challenge")
    case .weeklyChallenge:
      String(localized: "Weekly challenge", table: "Today", comment: "The week's challenge block")
    case .mock:
      String(localized: "Take the mock exam", table: "Today", comment: "Mission: a mock exam")
    case .essay:
      String(localized: "Practice writing", table: "Today", comment: "Mission: write an essay")
    case .practice:
      String(localized: "Practice", table: "Today", comment: "Mission: practice")
    case .fixMistake:
      String(localized: "Fix \(total) mistakes", table: "Today", comment: "Mission: fix mistakes")
    case .pattern:
      String(localized: "Practice a pattern", table: "Today", comment: "Mission: a pattern")
    case .pronunciation:
      String(
        localized: "Practice pronunciation", table: "Today", comment: "Mission: pronunciation")
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
}

struct MissionRow: View {
  @Environment(LearnerSummaryStore.self) private var learner

  let mission: StudyMission
  let buddyName: String
  /// Its place among the missions a result just completed, which stamp in one after another.
  var justDone: Int?
  var isBusy = false
  var failed = false
  var open: (() -> Void)?

  private var waits: Bool { mission.waitReason != nil }

  private var opensSomewhere: Bool {
    open != nil && !mission.isDone && !waits && mission.opens != nil
  }

  var body: some View {
    let row = MarkedRow(stackedSpacing: 4) {
      mark
        .frame(minWidth: 20)
    } content: {
      text
    } end: {
      trailing
    }
    .accessibilityElement(children: .combine)
    .accessibilityValue(
      mission.isDone && justDone == nil
        ? Text("Done", tableName: "Today", comment: "A mission that's done") : Text(""))

    if let open, opensSomewhere {
      // Its caller ignores a second tap while it opens, so it keeps its look.
      Button(action: open) {
        row
      }
      .tint(.primary)
      .accessibilityBusy(isBusy)
    } else {
      row
    }
  }

  private var text: some View {
    VStack(alignment: .leading, spacing: 2) {
      Text(mission.name(buddy: buddyName))
        .foregroundStyle((mission.isDone && justDone == nil) || waits ? .mutedForeground : .primary)

      if failed {
        FailureLine(
          message: LocalizedStringResource(
            "We couldn't open this step. Try again.", table: "Today",
            comment: "Under a step of the day, or a mission, that didn't open")
        )
        .typeStyle(.note)
      }

      if !mission.isDone, waits {
        Text(
          "After today's lessons", tableName: "Today",
          comment: "A challenge that opens once the lessons before it are done"
        )
        .typeStyle(.meta)
        .foregroundStyle(.mutedForeground)
      }
    }
  }

  @ViewBuilder
  private var trailing: some View {
    if justDone != nil {
      Text("Just done", tableName: "Today", comment: "A mission the result just completed")
        .typeStyle(.meta.weight(.medium))
        .foregroundStyle(.successText)
    }

    if opensSomewhere {
      DisclosureChevron()
        .coveredBySpinner(isBusy, alignment: .trailing)
    }
  }

  @ViewBuilder
  private var mark: some View {
    if let justDone {
      StatusMark(status: .done)
        .settles(delay: .beat + Double(justDone) * .stagger)
    } else if mission.isDone {
      StatusMark(status: .done)
    } else if mission.kind == .askBuddy {
      let buddy = learner.summary.value?.buddy ?? BuddyLook()
      BuddyFace(kind: buddy.kind, glasses: buddy.glasses)
    } else {
      KindMark(kind: mission.kind.learnKind)
    }
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

}
