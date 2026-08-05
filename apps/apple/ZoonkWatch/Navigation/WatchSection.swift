import Foundation

enum WatchSection: CaseIterable, Hashable, Identifiable {
  case progress
  case activity
  case score
  case patterns
  case level
  case energy

  var id: Self { self }

  var title: LocalizedStringResource {
    switch self {
    case .progress:
      LocalizedStringResource(
        "Progress",
        table: "Navigation",
        comment: "Navigation title for the learner's progress overview.")
    case .activity:
      LocalizedStringResource(
        "Activity",
        table: "Navigation",
        comment: "Navigation title for the learner's activity history.")
    case .score:
      LocalizedStringResource(
        "Score",
        table: "Navigation",
        comment: "Navigation title for the learner's score.")
    case .patterns:
      LocalizedStringResource(
        "Patterns",
        table: "Navigation",
        comment: "Navigation title for patterns in the learner's progress.")
    case .level:
      LocalizedStringResource(
        "Level",
        table: "Navigation",
        comment: "Navigation title for the learner's current level.")
    case .energy:
      LocalizedStringResource(
        "Energy",
        table: "Navigation",
        comment: "Navigation title for the learner's Energy metric.")
    }
  }

  var systemImage: String {
    switch self {
    case .progress:
      "chart.line.uptrend.xyaxis"
    case .activity:
      "chart.bar.xaxis"
    case .score:
      "target"
    case .patterns:
      "chart.xyaxis.line"
    case .level:
      "brain"
    case .energy:
      "bolt"
    }
  }
}
