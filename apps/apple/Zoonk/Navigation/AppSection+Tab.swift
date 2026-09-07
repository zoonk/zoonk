import SwiftUI

struct AppSectionActions {
  let coursesScope: Binding<CoursesScope>
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
      CoursesView(
        scope: actions.coursesScope,
        onCreateCourse: { actions.selectSection(.newCourse) },
        onSignIn: actions.presentAccount)
    case .progress:
      ProgressOverviewView(onSignIn: actions.presentAccount)
    }
  }
}
