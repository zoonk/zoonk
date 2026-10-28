import SwiftUI

/// Statistics' pages: the overview, then each stat's own, in main's order. On a phone the overview
/// opens each one; from a tablet up they're the section's tabs.
enum StatsSection: CaseIterable, Hashable, Identifiable {
  case overview
  case level
  case energy
  case activity
  case score
  case patterns

  var id: Self { self }

  var title: LocalizedStringResource {
    switch self {
    case .overview:
      LocalizedStringResource(
        "Overview", table: "Progress", comment: "Tab with every stat at a glance on Statistics")
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
  /// Set where Statistics shows its pages as tabs: a tile then switches the tab instead of pushing.
  @Entry var statsSectionOpen: StatsSectionOpen?
}

/// How a tile opens its stat's tab. Two compare equal, so setting one doesn't redraw the tiles.
struct StatsSectionOpen: Equatable {
  let open: (StatsSection) -> Void

  static func == (lhs: Self, rhs: Self) -> Bool { true }
}

/// The way to a stat's page from the overview: a navigation link on a phone, a tab switch where
/// the section shows its pages as tabs.
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
