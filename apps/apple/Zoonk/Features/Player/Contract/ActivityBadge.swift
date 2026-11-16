import Foundation

/// Main's `ActivityBadge`: a chip above an activity's prompt only where it says what the prompt is
/// told never to say, how the screen is worked or what comes first. An activity's prompt already
/// says what to do with its content, so a chip naming the task would say it twice.
enum ActivityBadge: Sendable {
  /// A template's badge, or the one its fields call for.
  enum Rule: Sendable {
    case always(ActivityBadge)
    case by(@Sendable (ActivityStepContent) -> ActivityBadge?)

    func badge(for content: ActivityStepContent) -> ActivityBadge? {
      switch self {
      case .always(let badge): badge
      case .by(let rule): rule(content)
      }
    }
  }

  case beforeAfter
  case dragCorner
  case earTraining
  case estimateFirst
  case moveLine
  case predictFirst
  case stepByStep
  case stepThrough
  case tapAlong
  case turnIt

  /// Main's `opensTitle`: a chip whose words open the title under it says the same thing twice, so
  /// the title says it alone.
  func isShown(over title: String) -> Bool {
    let label = String(localized: self.title).trimmingCharacters(in: .whitespaces).lowercased()
    return label.isEmpty
      || !title.trimmingCharacters(in: .whitespaces).lowercased().hasPrefix(label)
  }

  var title: LocalizedStringResource {
    switch self {
    case .beforeAfter:
      LocalizedStringResource(
        "Before and after", table: "Player",
        comment: "What the learner does in an activity, named above its prompt")
    case .dragCorner:
      LocalizedStringResource(
        "Drag a corner", table: "Player",
        comment: "What the learner does in an activity, named above its prompt")
    case .earTraining:
      LocalizedStringResource(
        "Ear training", table: "Player",
        comment: "What the learner does in an activity, named above its prompt")
    case .estimateFirst:
      LocalizedStringResource(
        "Estimate first", table: "Player",
        comment: "What the learner does in an activity, named above its prompt")
    case .moveLine:
      LocalizedStringResource(
        "Move a line", table: "Player",
        comment: "What the learner does in an activity, named above its prompt")
    case .predictFirst:
      LocalizedStringResource(
        "Predict first", table: "Player",
        comment: "What the learner does in an activity, named above its prompt")
    case .stepByStep:
      LocalizedStringResource(
        "Step by step", table: "Player",
        comment: "What the learner does in an activity, named above its prompt")
    case .stepThrough:
      LocalizedStringResource(
        "Step through", table: "Player",
        comment: "What the learner does in an activity, named above its prompt")
    case .tapAlong:
      LocalizedStringResource(
        "Tap along", table: "Player",
        comment: "What the learner does in an activity, named above its prompt")
    case .turnIt:
      LocalizedStringResource(
        "Turn it", table: "Player",
        comment: "What the learner does in an activity, named above its prompt")
    }
  }

  var systemImage: String {
    switch self {
    case .beforeAfter: "arrow.left.arrow.right.square"
    case .dragCorner: "arrow.up.and.down.and.arrow.left.and.right"
    case .earTraining: "ear"
    case .estimateFirst: "target"
    case .moveLine: "arrow.left.arrow.right"
    case .predictFirst: "dice"
    case .stepByStep: "list.number"
    case .stepThrough: "shoeprints.fill"
    case .tapAlong: "hand.tap"
    case .turnIt: "rotate.right"
    }
  }
}
