import SwiftUI

struct CourseCategorySelector: View {
  let categories: [CourseCategory]
  @Binding var selection: CourseCategory?

  var body: some View {
    FilterChips(
      groups: categories, selection: $selection,
      name: Text(
        "Course categories",
        tableName: "Courses",
        comment: "Accessibility label for the horizontally scrolling course category selector.")
    ) { category in
      if let category {
        SubjectGlyph(subject: category)
        Text(category.localizedTitle)
      } else {
        Text(
          "All",
          tableName: "Courses",
          comment: "Category option that shows courses from every category.")
      }
    }
  }
}

#Preview {
  @Previewable @State var selection: CourseCategory?

  CourseCategorySelector(categories: localizedCourseCategories(), selection: $selection)
}
