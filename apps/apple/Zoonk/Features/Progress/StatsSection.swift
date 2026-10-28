import SwiftUI

/// Statistics' stat pages, in main's order. The overview opens each one, pushed on a phone and
/// beside it where there's room.
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
}

extension EnvironmentValues {
  /// Set where Statistics shows a stat beside the overview: a tile then shows its stat there
  /// instead of pushing it.
  @Entry var statsSectionOpen: StatsSectionOpen?
}

/// The stat shown beside the overview and how a tile shows another. Two compare by the stat shown,
/// so a new closure alone doesn't redraw the tiles.
struct StatsSectionOpen: Equatable {
  let shown: StatsSection
  let open: (StatsSection) -> Void

  static func == (lhs: Self, rhs: Self) -> Bool { lhs.shown == rhs.shown }
}

/// The way to a stat's page from the overview: a navigation link on a phone, showing it beside the
/// overview where there's room.
struct StatsSectionLink<Label: View>: View {
  @Environment(\.statsSectionOpen) private var sectionOpen

  let section: StatsSection
  @ViewBuilder let label: Label

  var body: some View {
    if let sectionOpen {
      Button {
        sectionOpen.open(section)
      } label: {
        label
      }
    } else {
      NavigationLink(value: section) {
        label
      }
    }
  }
}
