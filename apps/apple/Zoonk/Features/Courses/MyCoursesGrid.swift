import SwiftUI

struct MyCoursesGrid: View {
  @Environment(\.dynamicTypeSize) private var dynamicTypeSize
  @Environment(\.horizontalSizeClass) private var horizontalSizeClass
  @Environment(MyCoursesStore.self) private var myCourses

  let page: MyCoursesPage

  var body: some View {
    LazyVGrid(columns: layout.columns, alignment: .leading, spacing: 14) {
      ForEach(page.courses) { course in
        courseItem(course)
      }
    }

    if page.canLoadMore {
      CourseGridLoadMoreView(
        failure: courseGridLoadMoreFailure(myCourses.loadMoreFailure),
        isLoading: myCourses.isLoadingMore
      ) {
        await myCourses.loadMoreCourses()
      }
    }
  }

  private var layout: CourseGridLayout {
    CourseGridLayout(
      dynamicTypeSize: dynamicTypeSize,
      horizontalSizeClass: horizontalSizeClass)
  }

  @ViewBuilder
  private func courseItem(_ course: UserCourseSummary) -> some View {
    if page.canLoadMore, course.id == page.courses.last?.id {
      gridItem(course)
        .task(
          id: MyCoursesPaginationTaskID(
            cursor: page.nextCursor,
            revision: myCourses.coursesRevision,
            isLoadingCourses: myCourses.isLoadingCourses)
        ) {
          await myCourses.loadMoreCourses(force: true)
        }
    } else {
      gridItem(course)
    }
  }

  private func gridItem(_ course: UserCourseSummary) -> CourseGridItem {
    CourseGridItem(
      artworkSize: layout.artworkSize,
      description: course.description,
      destination: courseDestination(course),
      imageURL: course.imageURL,
      title: course.title)
  }
}

/// Request identity also restarts pagination after a fast refresh that keeps the same cursor.
private struct MyCoursesPaginationTaskID: Equatable {
  let cursor: String?
  let revision: UUID?
  let isLoadingCourses: Bool
}

/// Public and owner-private courses use the same authenticated detail capability.
private func courseDestination(_ course: UserCourseSummary) -> CourseDestination? {
  CourseDestination.course(CourseReference(course))
}

private func courseGridLoadMoreFailure(
  _ failure: MyCoursesFailure?
) -> CourseGridLoadMoreFailure? {
  guard let failure else {
    return nil
  }

  switch failure {
  case .network:
    return .network
  case .unavailable:
    return .unavailable
  }
}
