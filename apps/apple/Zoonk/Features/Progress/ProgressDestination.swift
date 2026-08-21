import SwiftUI

enum ProgressDestination: CaseIterable, Hashable, Identifiable {
  case activity
  case score
  case patterns
  case level
  case energy

  var id: Self { self }

  var title: LocalizedStringResource {
    switch self {
    case .activity:
      LocalizedStringResource(
        "Activity",
        table: "Progress",
        comment: "Title for the learner's completed lessons and learning time progress.")
    case .score:
      LocalizedStringResource(
        "Score",
        table: "Progress",
        comment: "Title for the learner's answer accuracy progress.")
    case .patterns:
      LocalizedStringResource(
        "Patterns",
        table: "Progress",
        comment: "Title for insights about when the learner answers best.")
    case .level:
      LocalizedStringResource(
        "Level",
        table: "Progress",
        comment: "Title for the learner's Brain Power level progress.")
    case .energy:
      LocalizedStringResource(
        "Energy",
        table: "Progress",
        comment: "Title for the learner's Energy progress.")
    }
  }

  var systemImage: String {
    switch self {
    case .activity:
      "chart.bar.xaxis"
    case .score:
      "target"
    case .patterns:
      "waveform.path.ecg"
    case .level:
      "brain.head.profile"
    case .energy:
      "bolt.fill"
    }
  }

  var tint: Color {
    switch self {
    case .activity:
      .blue
    case .score:
      .green
    case .patterns:
      .green
    case .level:
      .orange
    case .energy:
      .orange
    }
  }
}
