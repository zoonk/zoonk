import Foundation

enum AppSection: CaseIterable, Hashable, Identifiable {
  case home
  case newCourse
  case courses
  case progress
  case search

  var id: Self { self }

  var title: LocalizedStringResource {
    switch self {
    case .home:
      LocalizedStringResource(
        "Home",
        table: "Navigation",
        comment: "Navigation title for the app's primary home section.")
    case .newCourse:
      LocalizedStringResource(
        "New course",
        table: "Navigation",
        comment: "Navigation title for the destination where the learner creates a course.")
    case .courses:
      LocalizedStringResource(
        "Courses",
        table: "Navigation",
        comment: "Navigation title for the learner's courses.")
    case .progress:
      LocalizedStringResource(
        "Progress",
        table: "Navigation",
        comment: "Navigation title for the learner's progress overview.")
    case .search:
      LocalizedStringResource(
        "Search",
        table: "Navigation",
        comment: "Navigation title for searching Zoonk.")
    }
  }

  var tabTitle: LocalizedStringResource {
    if self == .newCourse {
      return LocalizedStringResource(
        "New",
        table: "Navigation",
        comment: "Short tab label for the destination where the learner creates a course.")
    }

    return title
  }

  var systemImage: String {
    switch self {
    case .home:
      "house"
    case .newCourse:
      "plus"
    case .courses:
      "square.grid.2x2"
    case .progress:
      "chart.line.uptrend.xyaxis"
    case .search:
      "magnifyingglass"
    }
  }
}
