import SwiftUI

/// The course catalog, opened from the goal switcher's "Explore courses".
struct CatalogScreen: View {
  @Environment(AppRouter.self) private var router
  @State private var scope = CoursesScope.all

  var body: some View {
    CoursesView(
      scope: $scope,
      onCreateCourse: { router.open(.startGoal) },
      onSignIn: { router.present(.account) }
    )
    .navigationTitle(
      Text(
        "Courses",
        tableName: "Navigation",
        comment: "Navigation title for browsing the public course catalog."))
  }
}
