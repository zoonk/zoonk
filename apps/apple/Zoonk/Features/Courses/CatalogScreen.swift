import SwiftUI

/// The course catalog (main's `/courses`), opened from the goal switcher's "Explore courses":
/// courses by category, searchable with their chapters, each opening its public course page.
struct CatalogScreen: View {
  @State private var searchText = ""

  var body: some View {
    AllCoursesView(searchText: searchText)
      .background(Color(uiColor: .systemBackground))
      .searchable(
        text: $searchText,
        placement: .navigationBarDrawer(displayMode: .always),
        prompt: Text(
          "Search all courses", tableName: "Courses",
          comment: "Searches the public catalog, including chapters.")
      )
      .navigationTitle(
        Text(
          "Explore courses", tableName: "Courses",
          comment: "Title of the public course catalog, as the goal switcher's Explore opens it.")
      )
      .catalogDestinations()
  }
}
