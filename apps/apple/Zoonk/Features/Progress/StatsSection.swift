import SwiftUI

/// In main's order.
enum StatsSection: Hashable {
  case level
  case energy
  case activity
  case score
  case patterns

  var title: LocalizedStringResource {
    switch self {
    case .level:
      LocalizedStringResource(
        "Level", table: "Progress", comment: "Title of the stat with the learner's belt and level")
    case .energy:
      LocalizedStringResource(
        "Energy", table: "Progress", comment: "Title of the stat with the learner's Energy")
    case .activity:
      LocalizedStringResource(
        "Activity", table: "Progress",
        comment: "Title of the stat with the learner's study days, lessons and time")
    case .score:
      LocalizedStringResource(
        "Score", table: "Progress",
        comment: "Title of the stat with the learner's right answers over 90 days")
    case .patterns:
      LocalizedStringResource(
        "Patterns", table: "Progress",
        comment: "Title of the stat with when the learner answers best")
    }
  }

  var supporting: LocalizedStringResource? {
    self == .patterns
      ? LocalizedStringResource(
        "When you answer best, over the last 90 days.", table: "Progress")
      : nil
  }
}

extension EnvironmentValues {
  /// How the overview opens a stat: beside it in two columns, on top of it in one.
  @Entry var statsSectionOpen: StatsSectionOpen?
  /// The one stat a page shows, which heads it; the overview has none.
  @Entry var statsSection: StatsSection?
}

/// Two compare by the stat shown, so a new closure alone doesn't redraw the tiles.
struct StatsSectionOpen: Equatable {
  /// The stat beside the overview, outlined; none in one column.
  let shown: StatsSection?
  let open: (StatsSection) -> Void

  static func == (lhs: Self, rhs: Self) -> Bool { lhs.shown == rhs.shown }
}

struct StatsSectionLink<Label: View>: View {
  @Environment(\.statsSectionOpen) private var sectionOpen

  let section: StatsSection
  @ViewBuilder let label: Label

  var body: some View {
    Button {
      sectionOpen?.open(section)
    } label: {
      label
    }
  }
}
