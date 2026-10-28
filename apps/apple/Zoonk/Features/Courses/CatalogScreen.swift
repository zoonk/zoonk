import SwiftUI

/// The course catalog (main's `/courses`), opened from the goal switcher's "Explore courses": its
/// title (the chosen category's on a category) and one line on what it's for, the goal box for
/// anyone whose goal no course covers, the categories that have courses, and the courses, each
/// opening its page. Search covers courses and their chapters.
struct CatalogScreen: View {
  @State private var searchText = ""
  @State private var category: CourseCategory?
  @State private var isFolded = false

  var body: some View {
    AllCoursesView(category: $category, searchText: searchText)
      .onGeometryChange(for: Bool.self) {
        PaneSpace($0).fold != nil
      } action: {
        isFolded = $0
      }
      // The drawer's field spans the width, so partially folded the search moves to the bar.
      .searchable(
        text: $searchText,
        placement: isFolded ? .toolbar : .navigationBarDrawer(displayMode: .always),
        prompt: Text(
          "Search all courses", tableName: "Courses",
          comment: "Searches the public catalog, including chapters.")
      )
      .navigationTitle(title)
      .navigationBarTitleDisplayMode(.large)
      .navigationSubtitle(
        Text(
          "Start from a course, or tell Zoonk what you're getting ready for.",
          tableName: "Courses", comment: "The line under the catalog's title")
      )
      .catalogDestinations()
  }

  private var title: Text {
    if let category {
      Text(
        "Courses in \(Text(category.localizedTitle))", tableName: "Courses",
        comment: "Title of the catalog on one category, such as Courses in Science")
    } else {
      Text(
        "Explore courses", tableName: "Courses",
        comment: "Title of the public course catalog, as the goal switcher's Explore opens it.")
    }
  }
}
