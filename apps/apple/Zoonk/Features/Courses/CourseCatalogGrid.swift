import SwiftUI

/// The chosen category's courses inside the catalog's list: one row each on a narrow screen, and
/// on a wide one as many columns as fit, so a wider screen shows more courses instead of wider
/// rows (main's grid from `lg`). The last course loads the next page.
struct CourseCatalogGrid: View {
  @Environment(\.dynamicTypeSize) private var dynamicTypeSize
  @Environment(\.horizontalSizeClass) private var horizontalSizeClass
  @Environment(CourseCatalogStore.self) private var catalog

  let category: CourseCategory?
  let page: CourseCatalogPage

  var body: some View {
    Section {
      if usesColumns {
        LazyVGrid(
          columns: [GridItem(.adaptive(minimum: 240), spacing: 24, alignment: .top)],
          alignment: .leading, spacing: 24
        ) {
          ForEach(page.courses) { course in
            cell(course, isColumn: true)
          }
        }
        .padding(.vertical, 8)
      } else {
        ForEach(page.courses) { course in
          cell(course, isColumn: false)
        }
      }
    } footer: {
      if page.canLoadMore {
        CourseGridLoadMoreView(
          failure: courseGridLoadMoreFailure(catalog.loadMoreFailure),
          isLoading: catalog.isLoadingMore
        ) {
          await catalog.loadMoreCourses(category: category)
        }
      }
    }
  }

  private var usesColumns: Bool {
    horizontalSizeClass == .regular && !dynamicTypeSize.isAccessibilitySize
  }

  @ViewBuilder
  private func cell(_ course: CourseSummary, isColumn: Bool) -> some View {
    if page.canLoadMore, course.id == page.courses.last?.id {
      link(course, isColumn: isColumn).task(
        id: CourseCatalogPaginationTaskID(
          cursor: page.nextCursor,
          isRefreshing: catalog.courses(category: category).isRefreshing)
      ) {
        guard !catalog.courses(category: category).isRefreshing else {
          return
        }

        await catalog.loadMoreCourses(category: category)
      }
    } else {
      link(course, isColumn: isColumn)
    }
  }

  /// A row is the list's own link, chevron included; a column is a plain link of its own.
  @ViewBuilder
  private func link(_ course: CourseSummary, isColumn: Bool) -> some View {
    let destination = CourseDestination.course(CourseReference(course))
    let cell = CourseCell(
      course: course, isColumn: isColumn, showsSubject: course.subject != category)

    if isColumn {
      NavigationLink(value: destination) { cell }
        .buttonStyle(.plain)
    } else {
      NavigationLink(value: destination) { cell }
    }
  }
}

private struct CourseCatalogPaginationTaskID: Equatable {
  let cursor: String?
  let isRefreshing: Bool
}

/// A course: its mark, its subject (where the page isn't that subject's already), its title, the
/// first sentence of what it is and its numbers. In a row the mark sits beside the words; in a
/// column over them, the numbers at the foot.
private struct CourseCell: View {
  @Environment(\.dynamicTypeSize) private var dynamicTypeSize

  let course: CourseSummary
  let isColumn: Bool
  let showsSubject: Bool

  var body: some View {
    let layout =
      isColumn
      ? AnyLayout(VStackLayout(alignment: .leading, spacing: 12))
      : AnyLayout(HStackLayout(alignment: .top, spacing: 12))

    layout {
      HStack(alignment: .top) {
        CourseMark(course)

        if isColumn {
          Spacer(minLength: 8)
          subjectLabel
        }
      }

      VStack(alignment: .leading, spacing: 4) {
        if isColumn {
          title
        } else if dynamicTypeSize.isAccessibilitySize {
          title
          subjectLabel
        } else {
          HStack(alignment: .firstTextBaseline, spacing: 8) {
            title
            Spacer(minLength: 0)
            subjectLabel
          }
        }

        if let lead = firstSentence(course.description) {
          Text(lead)
            .font(.subheadline)
            .foregroundStyle(.secondary)
            .lineLimit(dynamicTypeSize.isAccessibilitySize ? nil : 2)
        }

        if let length = courseLengthText(
          lessonCount: course.lessonCount, minutes: course.estimatedMinutes)
        {
          Text(length)
            .font(.footnote.monospacedDigit())
            .foregroundStyle(.secondary)
            .padding(.top, 2)
        }
      }
      .frame(maxWidth: .infinity, alignment: .leading)
    }
    .contentShape(.rect)
  }

  private var title: some View {
    Text(course.title)
      .font(.body.weight(.semibold))
      .foregroundStyle(.primary)
      .fixedSize(horizontal: false, vertical: true)
  }

  @ViewBuilder
  private var subjectLabel: some View {
    if showsSubject, let subject = course.subject {
      CourseSubjectLabel(subject: subject)
    }
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
  _ failure: APIError?
) -> CourseGridLoadMoreFailure? {
  guard let failure else {
    return nil
  }

  return failure == .network ? .network : .unavailable
}
