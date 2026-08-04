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
      .Navigation.home
    case .newCourse:
      .Navigation.newCourse
    case .courses:
      .Navigation.courses
    case .progress:
      .Navigation.progress
    case .search:
      .Navigation.search
    }
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
