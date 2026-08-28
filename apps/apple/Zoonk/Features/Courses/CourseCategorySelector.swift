import SwiftUI

struct CourseCategorySelector: View {
  @Environment(\.accessibilityReduceMotion) private var accessibilityReduceMotion
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

          ForEach(localizedCourseCategories(), id: \.rawValue) { category in
            CourseCategoryButton(
              category: category,
              isSelected: selection == category,
              selection: $selection
            )
            .id(scrollID(for: category))
          }
        }
        .padding(.horizontal, 16)
      }
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
  @Environment(\.dynamicTypeSize) private var dynamicTypeSize

  let category: CourseCategory?
  let isSelected: Bool
  @Binding var selection: CourseCategory?

  var body: some View {
    Button {
      selection = category
    } label: {
      Label {
        title
      } icon: {
        Image(systemName: category?.systemImage ?? "square.grid.2x2")
          .font(.system(size: 15, weight: .semibold))
      }
      .font(.subheadline.weight(.semibold))
      .foregroundStyle(isSelected ? selectedForegroundStyle : Color.primary)
      .fixedSize(horizontal: true, vertical: false)
      .padding(.horizontal, 14)
      .padding(.vertical, dynamicTypeSize.isAccessibilitySize ? 10 : 0)
      .frame(height: dynamicTypeSize.isAccessibilitySize ? nil : 38)
      .background(backgroundStyle, in: Capsule())
    }
    .buttonStyle(.plain)
    .frame(minHeight: 44)
    .accessibilityAddTraits(isSelected ? .isSelected : [])
  }

  private var backgroundStyle: Color {
    isSelected ? .primary : Color(uiColor: .secondarySystemBackground)
  }

  private var selectedForegroundStyle: Color {
    Color(uiColor: .systemBackground)
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

  CourseCategorySelector(selection: $selection)
}
