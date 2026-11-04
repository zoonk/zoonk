import SwiftUI

struct CatalogScreen: View {
  @State private var category: CourseCategory?

  var body: some View {
    AllCoursesView(category: $category)
      .navigationTitle(Text(catalogTitle(category)))
      .barTitleAfterHero(String(localized: catalogTitle(category)))
      .catalogDestinations()
  }
}

func catalogTitle(_ category: CourseCategory?) -> LocalizedStringResource {
  if let category {
    LocalizedStringResource(
      "Courses in \(String(localized: category.localizedTitle))", table: "Courses",
      comment: "Title of the catalog on one category, such as Courses in Science")
  } else {
    LocalizedStringResource(
      "Explore courses", table: "Courses",
      comment: "Title of the public course catalog, as the goal switcher's Explore opens it.")
  }
}
