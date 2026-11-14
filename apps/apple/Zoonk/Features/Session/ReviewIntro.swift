import SwiftUI

/// Main's `ReviewIntro`: what a review is and how it picks its questions, one closed row a learner
/// can open.
struct ReviewIntro: View {
  let block: StudyBlock
  @Binding var isOpen: Bool

  /// Counted per goal, so another learner or goal on the device starts with it open.
  private static func startsKey(goalID: String?) -> String {
    "review-intro-starts:\(goalID ?? "")"
  }

  /// A goal's first three reviews on a device say what a review is in their row's line.
  static func isEarly(goalID: String?) -> Bool {
    UserDefaults.standard.integer(forKey: startsKey(goalID: goalID)) < 3
  }

  static let earlyLine = String(
    localized: "Questions on what you studied before, so it stays with you.", table: "Session",
    comment: "Under a goal's first reviews on the session's next step: what a review is")

  static func noteStart(of block: StudyBlock, goalID: String?) {
    let key = startsKey(goalID: goalID)

    if block.kind == .review, !block.capsules.isEmpty {
      UserDefaults.standard.set(UserDefaults.standard.integer(forKey: key) + 1, forKey: key)
    }
  }

  var body: some View {
    if block.capsules.isEmpty {
      // The first week's warm-up is only placement's questions: it checks, it doesn't review.
      Text(
        "A short test, so your plan skips what you know.", tableName: "Session",
        comment: "Under the first week's warm-up, which checks what the learner knows"
      )
      .foregroundStyle(.mutedForeground)
    } else {
      DisclosureGroup(isExpanded: $isOpen) {
        if block.weakest {
          row(
            "scope",
            Text(
              "Your hardest topics today", tableName: "Session",
              comment: "How reviews work: a review of the weakest topics when nothing was due"),
            Text(
              "Nothing is close to being forgotten, so you practice what's been hardest for you.",
              tableName: "Session",
              comment: "How reviews work: a review of the weakest topics when nothing was due"))
        } else {
          row(
            "hourglass",
            Text(
              "Just before you forget", tableName: "Session",
              comment: "How reviews work: when an idea comes back"),
            Text(
              "Each idea you study comes back right before you'd start to forget it.",
              tableName: "Session", comment: "How reviews work: when an idea comes back"))
        }

        row(
          "calendar.badge.clock",
          Text(
            "Right answers wait longer", tableName: "Session",
            comment: "How reviews work: how answers move an idea's next review"),
          Text(
            "Get it right and it returns in days, then weeks, then months. Miss it and it's back sooner.",
            tableName: "Session",
            comment: "How reviews work: how answers move an idea's next review"))

        row(
          "timer",
          Text(
            "First, and always short", tableName: "Session",
            comment: "How reviews work: where reviews go in a session"),
          Text(
            "Reviews open your session and take a small part of it, even after days away.",
            tableName: "Session", comment: "How reviews work: where reviews go in a session"))
      } label: {
        ListRow(
          Text(
            "How reviews work", tableName: "Session",
            comment: "Opens what a review is, on the session's next step when it's a review")
        ) {
          Image(systemName: "arrow.counterclockwise")
            .accessibilityHidden(true)
        }
      }
    }
  }

  private func row(_ symbol: String, _ title: Text, _ description: Text) -> some View {
    ListRow(title, description: description) {
      Image(systemName: symbol)
        .accessibilityHidden(true)
    }
    .accessibilityElement(children: .combine)
  }
}
