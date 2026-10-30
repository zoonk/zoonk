import SwiftUI

struct CourseCategorySelector: View {
  @Environment(\.accessibilityReduceMotion) private var accessibilityReduceMotion
  let categories: [CourseCategory]
  @Binding var selection: CourseCategory?

  var body: some View {
    ScrollViewReader { proxy in
      ScrollView(.horizontal) {
        LazyHStack(spacing: 8) {
          CourseCategoryButton(
            category: nil,
            isSelected: selection == nil,
            selection: $selection
          )
          .id(scrollID(for: nil))

          ForEach(categories, id: \.rawValue) { category in
            CourseCategoryButton(
              category: category,
              isSelected: selection == category,
              selection: $selection
            )
            .id(scrollID(for: category))
          }
        }
      }
      // The row scrolls to the screen's edges while its first chip lines up with the courses.
      .scrollClipDisabled()
      .scrollIndicators(.hidden)
      .accessibilityElement(children: .contain)
      .accessibilityLabel(
        Text(
          "Course categories",
          tableName: "Courses",
          comment: "Accessibility label for the horizontally scrolling course category selector.")
      )
      .onChange(of: selection) { _, selection in
        if accessibilityReduceMotion {
          proxy.scrollTo(scrollID(for: selection), anchor: .center)
        } else {
          withAnimation {
            proxy.scrollTo(scrollID(for: selection), anchor: .center)
          }
        }
      }
    }
  }

  private func scrollID(for category: CourseCategory?) -> String {
    category?.rawValue ?? "all"
  }
}

private struct CourseCategoryButton: View {
  let category: CourseCategory?
  let isSelected: Bool
  @Binding var selection: CourseCategory?

  var body: some View {
    Group {
      if isSelected {
        button.buttonStyle(.mainAction)
      } else {
        button.buttonStyle(.bordered)
      }
    }
    .accessibilityAddTraits(isSelected ? .isSelected : [])
  }

  private var button: some View {
    Button {
      selection = category
    } label: {
      HStack(spacing: 6) {
        if let category {
          SubjectGlyph(subject: category)
        }

        title
      }
      .font(.subheadline.weight(.semibold))
    }
  }

  @ViewBuilder
  private var title: some View {
    if let category {
      Text(category.localizedTitle)
    } else {
      Text(
        "All",
        tableName: "Courses",
        comment: "Category option that shows courses from every category.")
    }
  }
}

#Preview {
  @Previewable @State var selection: CourseCategory?

  CourseCategorySelector(categories: localizedCourseCategories(), selection: $selection)
}
