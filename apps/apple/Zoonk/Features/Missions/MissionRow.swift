import SwiftUI

/// A mission of the day: what it asks, how far it is, and what a tap on it opens.
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

  /// What a tap on the mission opens: a block of the day (by id, or by its place on a day not
  /// opened yet) or a place of its own.
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

  /// Whether the mission opens this block of the day.
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
  /// A mission another feature read through the generated client, such as the buddy's day.
  init?(_ mission: Components.Schemas.StudyMission) {
    guard let mission = try? StudyJSON.recode(mission, as: StudyMission.self) else {
      return nil
    }

    self = mission
  }
}

extension StudyMission {
  /// What the mission asks, by name.
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
      String(localized: "Practice writing", table: "Today", comment: "Mission: an essay")
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

  /// What the mission still asks, in words: what it waits for, or where it's done.
  var step: String? {
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
    default:
      return detail?.title
    }
  }
}

/// One of the day's missions, the same wherever missions are listed (Today, the buddy's day): its
/// mark, what it asks, what it still asks or waits for, and how far it is. A mission still to do
/// that opens somewhere is a button calling `open`; a done or waiting one is one quiet row.
struct MissionRow: View {
  let mission: StudyMission
  let buddyName: String
  var open: (() -> Void)?

  var body: some View {
    let row = HStack(alignment: .firstTextBaseline, spacing: 12) {
      StatusMark(status: mission.isDone ? .done : .todo)

      VStack(alignment: .leading, spacing: 2) {
        Text(mission.name(buddy: buddyName))
          .foregroundStyle(mission.isDone ? .secondary : .primary)

        if !mission.isDone, let step = mission.step {
          Text(step)
            .font(.footnote)
            .foregroundStyle(.secondary)
        }
      }

      Spacer(minLength: 8)

      if !mission.isDone, mission.total > 1 {
        Text(verbatim: "\(mission.done)/\(mission.total)")
          .font(.footnote.monospacedDigit())
          .foregroundStyle(.secondary)
      }
    }
    .accessibilityElement(children: .combine)
    .accessibilityValue(
      mission.isDone ? Text("Done", tableName: "Today", comment: "A mission that's done") : Text("")
    )

    if let open, !mission.isDone, mission.waitReason == nil, mission.opens != nil {
      Button(action: open) {
        row
      }
      .tint(.primary)
    } else {
      row
    }
  }
}
