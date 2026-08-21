import SwiftUI

extension AppSection {
  var tabRole: TabRole? {
    self == .search ? .search : nil
  }

  @MainActor
  @ViewBuilder
  func tabContent(onPresentAccount: @escaping () -> Void) -> some View {
    switch self {
    case .home:
      HomeView()
    case .newCourse:
      NewCourseView()
    case .courses:
      CoursesView()
    case .progress:
      ProgressOverviewView(onSignIn: onPresentAccount)
    case .search:
      SearchView()
    }
  }
}
