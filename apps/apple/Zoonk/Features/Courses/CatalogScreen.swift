import SwiftUI

struct CatalogScreen: View {
  @State private var category: CourseCategory?

  var body: some View {
    AllCoursesView(category: $category)
      .navigationTitle(title)
      .navigationBarTitleDisplayMode(.large)
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
