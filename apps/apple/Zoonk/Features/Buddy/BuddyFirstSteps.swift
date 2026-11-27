import SwiftUI

typealias BuddyFirstStep = Components.Schemas.BuddyFirstSteps.StepsPayloadPayload

extension StudyMission {
  /// A first step reads as the mission it is: its mark, its wait and where it opens are the
  /// mission's.
  init?(_ step: BuddyFirstStep) {
    guard let kind = Kind(rawValue: step.kind.rawValue) else {
      return nil
    }

    self.init(
      detail: nil, done: 0, kind: kind, minutes: nil,
      opens: step.opens.flatMap { try? StudyJSON.recode($0.value1, as: Opens.self) },
      status: step.status.rawValue, total: 1,
      waitReason: step.waitReason.flatMap { StudyBlock.WaitReason(rawValue: $0.rawValue) })
  }
}

extension BuddyFirstStep.KindPayload {
  /// Main's first-step names, which take its English and its translations.
  func name(buddy: String) -> String {
    switch self {
    case .somethingNew: String(localized: "Finish your first lesson", table: "Buddy")
    case .review: String(localized: "Do your first review", table: "Buddy")
    case .fixMistake: String(localized: "Fix your first mistake", table: "Buddy")
    case .pattern: String(localized: "Practice a pattern", table: "Buddy")
    case .askBuddy: String(localized: "Ask \(buddy) something", table: "Buddy")
    case .essay: String(localized: "Write your first essay", table: "Buddy")
    case .call: String(localized: "Have your first call", table: "Buddy")
    case .mock: String(localized: "Take your first mock exam", table: "Buddy")
    case .challenge: String(localized: "Beat the Trickster", table: "Buddy")
    }
  }
}
