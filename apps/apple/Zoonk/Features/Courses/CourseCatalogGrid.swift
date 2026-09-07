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
      CourseGridLoadMoreView(
        failure: courseGridLoadMoreFailure(catalog.loadMoreFailure),
        isLoading: catalog.isLoadingMore
      ) {
        await catalog.loadMoreCourses(category: category)
      }
    }
  }

  private var layout: CourseGridLayout {
    CourseGridLayout(
      dynamicTypeSize: dynamicTypeSize,
      horizontalSizeClass: horizontalSizeClass)
  }

  @ViewBuilder
  private func courseItem(_ course: CourseSummary) -> some View {
    if page.canLoadMore, course.id == page.courses.last?.id {
      CourseGridItem(
        artworkSize: layout.artworkSize,
        description: course.description,
        destination: .course(CourseReference(course)),
        imageURL: course.imageURL,
        title: course.title
      )
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
      CourseGridItem(
        artworkSize: layout.artworkSize,
        description: course.description,
        destination: .course(CourseReference(course)),
        imageURL: course.imageURL,
        title: course.title)
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

  private var layout: CourseGridLayout {
    CourseGridLayout(
      dynamicTypeSize: dynamicTypeSize,
      horizontalSizeClass: horizontalSizeClass)
  }
}

private struct CourseCatalogLoadingItem: View {
  let artworkSize: CGFloat

  var body: some View {
    CourseGridRow(imageURL: nil, artworkSize: artworkSize) {
      textContent
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

struct CourseGridItem: View {
  @Environment(\.dynamicTypeSize) private var dynamicTypeSize

  let artworkSize: CGFloat
  let description: String?
  let destination: CourseDestination?
  let imageURL: URL?
  let title: String

  @ViewBuilder
  var body: some View {
    if let destination {
      NavigationLink(value: destination) {
        row
          .contentShape(Rectangle())
      }
      .buttonStyle(.plain)
      .accessibilityHint(
        Text(
          "Opens the course",
          tableName: "Courses",
          comment: "Accessibility hint for a course in the catalog."))
    } else {
      row
        .accessibilityElement(children: .combine)
    }
  }

  private var row: some View {
    CourseGridRow(imageURL: imageURL, artworkSize: artworkSize) {
      textContent
    }
  }

  private var textContent: some View {
    VStack(alignment: .leading, spacing: 3) {
      Text(title)
        .font(.headline)
        .foregroundStyle(.primary)
        .lineLimit(dynamicTypeSize.isAccessibilitySize ? nil : 2)

      if let description = catalogText(description) {
        Text(description)
          .font(.subheadline)
          .foregroundStyle(.secondary)
          .lineLimit(dynamicTypeSize.isAccessibilitySize ? nil : 2)
      }
    }
  }
}

struct CourseGridRow<Content: View>: View {
  @Environment(\.dynamicTypeSize) private var dynamicTypeSize
  @Environment(\.horizontalSizeClass) private var horizontalSizeClass

  let imageURL: URL?
  let artworkSize: CGFloat
  @ViewBuilder let content: Content

  var body: some View {
    HStack(alignment: dynamicTypeSize.isAccessibilitySize ? .top : .center, spacing: 12) {
      CourseArtwork(imageURL: imageURL)
        .frame(width: artworkSize, height: artworkSize)

      content
        .frame(maxWidth: .infinity, alignment: .leading)
    }
    .padding(.top, usesBalancedRegularLayout ? 8 : 0)
    .padding(.bottom, usesBalancedRegularLayout ? 8 : 14)
    .overlay(alignment: .bottom) {
      Color(uiColor: .separator)
        .frame(height: 0.5)
        .padding(.leading, artworkSize + 12)
    }
  }

  private var usesBalancedRegularLayout: Bool {
    horizontalSizeClass == .regular && !dynamicTypeSize.isAccessibilitySize
  }
}

struct CourseGridLayout {
  let dynamicTypeSize: DynamicTypeSize
  let horizontalSizeClass: UserInterfaceSizeClass?

  var artworkSize: CGFloat {
    horizontalSizeClass == .regular && !dynamicTypeSize.isAccessibilitySize ? 88 : 64
  }

  var columns: [GridItem] {
    guard horizontalSizeClass == .regular, !dynamicTypeSize.isAccessibilitySize else {
      return [GridItem(.flexible(), alignment: .top)]
    }

    return [GridItem(.adaptive(minimum: 300, maximum: 420), spacing: 24, alignment: .top)]
  }
}

enum CourseGridLoadMoreFailure: Equatable {
  case network
  case unavailable
}

struct CourseGridLoadMoreView: View {
  let failure: CourseGridLoadMoreFailure?
  let isLoading: Bool
  let retry: @MainActor () async -> Void

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
              await retry()
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
  private func failureDescription(_ failure: CourseGridLoadMoreFailure) -> some View {
    switch failure {
    case .network:
      Text(
        "Couldn't load more while offline.",
        tableName: "Courses",
        comment: "Message when another course page cannot load because the device is offline.")
    case .unavailable:
      Text(
        "Couldn't load more courses.",
        tableName: "Courses",
        comment: "Message when another course page cannot be loaded.")
    }
  }
}

private func courseGridLoadMoreFailure(
  _ failure: CourseCatalogFailure?
) -> CourseGridLoadMoreFailure? {
  guard let failure else {
    return nil
  }

  return failure == .network ? .network : .unavailable
}
