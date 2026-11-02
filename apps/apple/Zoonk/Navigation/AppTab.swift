import SwiftUI

enum AppTab: Hashable, CaseIterable {
  case today
  case plan
  case buddy
  case search
  case mistakes
  case exam
  case speaking
  case mindMaps
  case statistics

  static let study: [AppTab] = [.mistakes, .exam, .speaking, .mindMaps, .statistics]

  var studyRoute: AppRoute? {
    switch self {
    case .mistakes: .mistakes
    case .exam: .exam
    case .speaking: .speaking
    case .mindMaps: .mindMaps
    case .statistics: .statistics
    case .today, .plan, .buddy, .search: nil
    }
  }

  var title: LocalizedStringResource {
    switch self {
    case .today:
      LocalizedStringResource(
        "Today", table: "Navigation", comment: "Tab for the learner's day of lessons and reviews")
    case .plan:
      LocalizedStringResource(
        "Plan", table: "Navigation", comment: "Tab for the learner's plan toward their goal")
    case .buddy:
      LocalizedStringResource(
        "Buddy", table: "Navigation",
        comment: "Tab for the learner's study buddy, used until the buddy's name is known")
    case .search:
      LocalizedStringResource(
        "Search", table: "Navigation", comment: "Tab for searching the plan and the catalog")
    case .mistakes:
      LocalizedStringResource(
        "Mistakes notebook", table: "Navigation",
        comment: "Study place listing the questions the learner got wrong")
    case .exam:
      LocalizedStringResource(
        "Exam", table: "Navigation", comment: "Study place for the learner's exam and mock exams")
    case .speaking:
      LocalizedStringResource(
        "Speaking", table: "Navigation",
        comment: "Study place for speaking practice in the language the learner studies")
    case .mindMaps:
      LocalizedStringResource(
        "Mind maps", table: "Navigation", comment: "Study place with a mind map for each chapter")
    case .statistics:
      LocalizedStringResource(
        "Statistics", table: "Navigation", comment: "Study place with the learner's statistics")
    }
  }

  var systemImage: String {
    switch self {
    case .today: "sun.max"
    case .plan: "map"
    case .buddy: "face.smiling"
    case .search: "magnifyingglass"
    case .mistakes: "square.and.pencil"
    case .exam: "graduationcap"
    case .speaking: "mic"
    case .mindMaps: "point.3.connected.trianglepath.dotted"
    case .statistics: "chart.bar"
    }
  }
}

extension TabBarPlacement {
  /// iPhone Duo's vertical bar reports itself as `.bottomBar` even open, and has no room for them
  /// either; there the pages that lead to them link them.
  var listsStudyPlaces: Bool {
    self != .bottomBar
  }
}
