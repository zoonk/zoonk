import SwiftUI

extension AppSection {
  var tabRole: TabRole? {
    self == .search ? .search : nil
  }

  @ViewBuilder
  var tabContent: some View {
    switch self {
    case .home:
      HomeView()
    case .newCourse:
      NewCourseView()
    case .courses:
      CoursesView()
    case .progress:
      ProgressOverviewView()
    case .search:
      SearchView()
    }
  }
}
