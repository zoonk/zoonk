import SwiftUI

struct CourseCatalogGrid: View {
  @Environment(\.dynamicTypeSize) private var dynamicTypeSize
  @Environment(\.horizontalSizeClass) private var horizontalSizeClass
  @Environment(CourseCatalogStore.self) private var catalog

  let category: CourseCategory?
  let page: CourseCatalogPage

  var body: some View {
    LazyVGrid(columns: layout.columns, alignment: .leading, spacing: 14) {
      ForEach(page.courses) { course in
        courseItem(course)
      }
    }

    if page.canLoadMore {
      CourseCatalogLoadMoreView(
        category: category,
        failure: catalog.loadMoreFailure,
        isLoading: catalog.isLoadingMore)
    }
  }

  private var layout: CourseCatalogLayout {
    CourseCatalogLayout(
      dynamicTypeSize: dynamicTypeSize,
      horizontalSizeClass: horizontalSizeClass)
  }

  @ViewBuilder
  private func courseItem(_ course: CourseSummary) -> some View {
    if page.canLoadMore, course.id == page.courses.last?.id {
      CourseCatalogItem(course: course, artworkSize: layout.artworkSize)
        .task(
          id: CourseCatalogPaginationTaskID(
            cursor: page.nextCursor,
            isLoadingCourses: catalog.isLoadingCourses)
        ) {
          guard !catalog.isLoadingCourses else {
            return
          }

          await catalog.loadMoreCourses(category: category, force: true)
        }
    } else {
      CourseCatalogItem(course: course, artworkSize: layout.artworkSize)
    }
  }
}

private struct CourseCatalogPaginationTaskID: Equatable {
  let cursor: String?
  let isLoadingCourses: Bool
}

struct CourseCatalogLoadingGrid: View {
  @Environment(\.dynamicTypeSize) private var dynamicTypeSize
  @Environment(\.horizontalSizeClass) private var horizontalSizeClass

  var body: some View {
    LazyVGrid(columns: layout.columns, alignment: .leading, spacing: 14) {
      ForEach(0..<8, id: \.self) { _ in
        CourseCatalogLoadingItem(artworkSize: layout.artworkSize)
      }
    }
    .accessibilityElement(children: .ignore)
    .accessibilityLabel(
      Text(
        "Loading courses",
        tableName: "Courses",
        comment: "Accessibility status while the course catalog loads."))
  }

  private var layout: CourseCatalogLayout {
    CourseCatalogLayout(
      dynamicTypeSize: dynamicTypeSize,
      horizontalSizeClass: horizontalSizeClass)
  }
}

private struct CourseCatalogLoadingItem: View {
  let artworkSize: CGFloat

  var body: some View {
    HStack(alignment: .top, spacing: 12) {
      CourseArtwork(imageURL: nil)
        .frame(width: artworkSize, height: artworkSize)

      textContent
        .frame(maxWidth: .infinity, alignment: .leading)
    }
    .padding(.bottom, 14)
    .overlay(alignment: .bottom) {
      Color(uiColor: .separator)
        .frame(height: 0.5)
        .padding(.leading, artworkSize + 12)
    }
    .redacted(reason: .placeholder)
  }

  private var textContent: some View {
    VStack(alignment: .leading, spacing: 3) {
      Text(verbatim: "A course title")
        .font(.headline)
      Text(verbatim: "A short description of this course")
        .font(.subheadline)
    }
  }
}

private struct CourseCatalogItem: View {
  @Environment(\.dynamicTypeSize) private var dynamicTypeSize

  let course: CourseSummary
  let artworkSize: CGFloat

  var body: some View {
    NavigationLink(value: CourseDestination.course(CourseReference(course))) {
      HStack(alignment: .top, spacing: 12) {
        CourseArtwork(imageURL: course.imageURL)
          .frame(width: artworkSize, height: artworkSize)

        textContent
          .frame(maxWidth: .infinity, alignment: .leading)
      }
      .padding(.bottom, 14)
      .overlay(alignment: .bottom) {
        Color(uiColor: .separator)
          .frame(height: 0.5)
          .padding(.leading, artworkSize + 12)
      }
      .contentShape(Rectangle())
    }
    .buttonStyle(.plain)
    .accessibilityHint(
      Text(
        "Opens the course",
        tableName: "Courses",
        comment: "Accessibility hint for a course in the catalog."))
  }

  private var textContent: some View {
    VStack(alignment: .leading, spacing: 3) {
      Text(course.title)
        .font(.headline)
        .foregroundStyle(.primary)
        .lineLimit(dynamicTypeSize.isAccessibilitySize ? nil : 2)

      if let description = catalogText(course.description) {
        Text(description)
          .font(.subheadline)
          .foregroundStyle(.secondary)
          .lineLimit(dynamicTypeSize.isAccessibilitySize ? nil : 2)
      }
    }
  }
}

private struct CourseCatalogLayout {
  let dynamicTypeSize: DynamicTypeSize
  let horizontalSizeClass: UserInterfaceSizeClass?

  var artworkSize: CGFloat {
    horizontalSizeClass == .regular && !dynamicTypeSize.isAccessibilitySize ? 88 : 80
  }

  var columns: [GridItem] {
    guard horizontalSizeClass == .regular, !dynamicTypeSize.isAccessibilitySize else {
      return [GridItem(.flexible(), alignment: .top)]
    }

    return [GridItem(.adaptive(minimum: 300, maximum: 420), spacing: 24, alignment: .top)]
  }
}

private struct CourseCatalogLoadMoreView: View {
  @Environment(CourseCatalogStore.self) private var catalog

  let category: CourseCategory?
  let failure: CourseCatalogFailure?
  let isLoading: Bool

  var body: some View {
    Group {
      if let failure {
        VStack(spacing: 10) {
          Label {
            failureDescription(failure)
          } icon: {
            Image(
              systemName: failure == .network
                ? "wifi.exclamationmark" : "exclamationmark.triangle")
          }
          .font(.subheadline)
          .foregroundStyle(.secondary)

          Button {
            Task {
              await catalog.loadMoreCourses(category: category)
            }
          } label: {
            Text(
              "Try again",
              tableName: "Courses",
              comment: "Retries loading catalog content after a failure.")
          }
          .buttonStyle(.bordered)
        }
      } else if isLoading {
        ProgressView()
          .accessibilityLabel(
            Text(
              "Loading more courses",
              tableName: "Courses",
              comment: "Accessibility status while the next course page loads."))
      }
    }
    .frame(maxWidth: .infinity)
    .padding(.vertical, 16)
  }

  @ViewBuilder
  private func failureDescription(_ failure: CourseCatalogFailure) -> some View {
    switch failure {
    case .network:
      Text(
        "Couldn't load more while offline.",
        tableName: "Courses",
        comment: "Message when another course page cannot load because the device is offline.")
    case .notFound, .unavailable:
      Text(
        "Couldn't load more courses.",
        tableName: "Courses",
        comment: "Message when another course page cannot be loaded.")
    }
  }
}
