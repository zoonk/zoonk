import SwiftUI

struct AppSectionActions {
  let presentAccount: () -> Void
  let selectSection: (AppSection) -> Void
}

extension AppSection {
  @MainActor
  @ViewBuilder
  func tabContent(actions: AppSectionActions) -> some View {
    switch self {
    case .home:
      HomeView()
    case .newCourse:
      NewCourseView()
    case .courses:
      CoursesView {
        actions.selectSection(.newCourse)
      }
    case .progress:
      ProgressOverviewView(onSignIn: actions.presentAccount)
    }
  }
}
