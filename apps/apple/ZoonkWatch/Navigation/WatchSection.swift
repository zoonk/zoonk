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
      .Navigation.progress
    case .activity:
      .Navigation.activity
    case .score:
      .Navigation.score
    case .patterns:
      .Navigation.patterns
    case .level:
      .Navigation.level
    case .energy:
      .Navigation.energy
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
