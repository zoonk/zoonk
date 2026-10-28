import SwiftUI

struct CourseView: View {
  @Environment(CourseCatalogStore.self) private var catalog
  @State private var searchText = ""

  let course: CourseReference

  var body: some View {
    Group {
      switch catalog.course(id: course.id).state {
      case .idle, .loading:
        CourseLoadingView(course: course)
      case .loaded(let detail):
        CourseDetailContent(detail: detail, searchText: $searchText)
      case .empty:
        CourseDetailEmptyView()
      case .failed(let failure):
        CatalogFailureRecoveryView(context: .course, failure: failure) {
          await catalog.course(id: course.id).refresh()
        }
      }
    }
    .background(Color(uiColor: .systemBackground))
    .loads(catalog.course(id: course.id))
  }
}

private struct CourseDetailContent: View {
  @State private var isFeedbackPresented = false
  @State private var isInformationPresented = false
  @State private var isSearchPresented = false

  let detail: CourseDetail
  @Binding var searchText: String

  var body: some View {
    CourseDetailList(
      detail: detail,
      isInformationPresented: $isInformationPresented,
      searchText: $searchText,
      showFeedback: { isFeedbackPresented = true },
      showInformation: { isInformationPresented = true }
    )
    .catalogDetailSearchPresentation(
      text: $searchText,
      isPresented: $isSearchPresented,
      prompt: Text(
        "Search chapters",
        tableName: "Courses",
        comment: "Placeholder for searching within a course's chapters.")
    )
    .sheet(isPresented: $isFeedbackPresented) {
      FeedbackSheet(
        api: FeedbackAPI.live(),
        context: FeedbackContext(contentID: detail.course.id, contentKind: .course))
    }
  }
}

private struct CourseDetailList: View {
  @Environment(\.horizontalSizeClass) private var horizontalSizeClass
  @Environment(\.isSearching) private var isSearching

  let detail: CourseDetail
  @Binding var isInformationPresented: Bool
  @Binding var searchText: String
  let showFeedback: () -> Void
  let showInformation: () -> Void

  var body: some View {
    // The header scrolls with the list, so large text on a short screen never squeezes it.
    List {
      Section {
        if !showsSearchResultsOnly {
          detailHeader
        }

        CatalogCurriculumHeader(
          title: Text(
            "Chapters",
            tableName: "Courses",
            comment: "Heading above the ordered chapter list on a course screen."))
      }
      .listRowInsets(EdgeInsets())
      .listRowSeparator(.hidden)

      if filteredChapters.isEmpty {
        emptyChaptersView
          .listRowSeparator(.hidden)
      } else {
        ForEach(courseLevelBands(filteredChapters)) { band in
          Section {
            ForEach(band.chapters) { chapter in
              chapterRow(chapter)
            }
          } header: {
            // Section headers don't take the list's content margins, so they align with the rows here.
            Text(band.level.localizedTitle)
              .font(.subheadline.weight(.medium))
              .foregroundStyle(Color(uiColor: .secondaryLabel))
              .accessibilityAddTraits(.isHeader)
              .listRowInsets(
                EdgeInsets(
                  top: 16,
                  leading: CatalogDetailLayout.horizontalInset(for: horizontalSizeClass),
                  bottom: 4,
                  trailing: 0))
          }
        }
      }
    }
    .listStyle(.plain)
    .scrollContentBackground(.hidden)
    .contentMargins(
      .horizontal,
      CatalogDetailLayout.horizontalInset(for: horizontalSizeClass),
      for: .scrollContent
    )
    .frame(maxWidth: 900)
    .frame(maxWidth: .infinity)
  }

  private func chapterRow(_ chapter: CourseChapter) -> some View {
    NavigationLink(
      value: CourseDestination.chapter(
        ChapterReference((course: detail.course, chapter: chapter)))
    ) {
      CatalogNumberedRow(
        description: chapter.description,
        imageURL: detail.course.imageURL,
        number: chapter.position + 1,
        systemImage: "rectangle.stack.fill",
        title: chapter.title
      )
    }
    .listRowInsets(
      EdgeInsets(
        top: CatalogDetailLayout.curriculumRowVerticalInset(
          for: horizontalSizeClass),
        leading: 0,
        bottom: CatalogDetailLayout.curriculumRowVerticalInset(
          for: horizontalSizeClass),
        trailing: 0))
  }

  private var detailHeader: some View {
    VStack(alignment: .leading, spacing: 16) {
      CatalogDetailHeader(
        configuration: CatalogDetailHeaderConfiguration(
          imageURL: detail.course.imageURL,
          description: detail.course.description,
          systemImage: "book.closed.fill",
          title: detail.course.title),
        showInformation: showInformation
      )
      .popover(isPresented: $isInformationPresented) {
        CourseInformationView(
          course: detail.course,
          dismiss: { isInformationPresented = false }
        )
        .presentationCompactAdaptation(.sheet)
      }

      CatalogDetailActions(
        courseID: detail.course.id,
        tryLessonID: detail.tryLessonID,
        showFeedback: showFeedback)
    }
    .frame(maxWidth: .infinity, alignment: .leading)
    .padding(.top, 16)
    .padding(.bottom, 12)
  }

  private var showsSearchResultsOnly: Bool {
    isSearching || catalogText(searchText) != nil
  }

  private var filteredChapters: [CourseChapter] {
    filterCourseChapters(CatalogSearchRequest(items: detail.chapters, query: searchText))
  }

  @ViewBuilder
  private var emptyChaptersView: some View {
    if catalogText(searchText) != nil {
      ContentUnavailableView.search(text: searchText)
    } else {
      ContentUnavailableView {
        Label {
          Text(
            "No chapters yet",
            tableName: "Courses",
            comment: "Title when a course does not have any published chapters.")
        } icon: {
          Image(systemName: "rectangle.stack")
        }
      } description: {
        Text(
          "This course's chapters will appear here when they're available.",
          tableName: "Courses",
          comment: "Guidance when a course does not have any published chapters.")
      }
    }
  }
}

private struct CourseInformationView: View {
  let course: Course
  let dismiss: () -> Void

  var body: some View {
    CatalogInformationView(
      dismiss: dismiss,
      title: LocalizedStringResource(
        "Course information",
        table: "Courses",
        comment: "Title for secondary information about a course.")
    ) {
      VStack(alignment: .leading, spacing: 16) {
        if let description = catalogText(course.description) {
          Text(description)
            .fixedSize(horizontal: false, vertical: true)
        }

        VStack(alignment: .leading, spacing: 12) {
          if let organization = course.organization {
            Text(organization.name)
              .font(.subheadline.weight(.semibold))
              .foregroundStyle(.secondary)
          }

          if !course.categories.isEmpty {
            Text(categoryDescription)
              .chip()
          }

          if course.organization?.slug == "ai" {
            Label {
              Text(
                "Created with AI",
                tableName: "Courses",
                comment: "Disclosure that a public course or chapter was created with AI.")
            } icon: {
              Image(systemName: "sparkles")
            }
            .foregroundStyle(.secondary)
          }
        }
      }
    }
  }

  private var categoryDescription: String {
    course.categories
      .map { String(localized: $0.localizedTitle) }
      .formatted(.list(type: .and, width: .short))
  }
}

/// The page as soon as it opens: what the tapped row already said about it, then a spinner where
/// its list loads. Never a skeleton.
private struct CourseLoadingView: View {
  @Environment(\.horizontalSizeClass) private var horizontalSizeClass

  let course: CourseReference

  var body: some View {
    VStack(spacing: 0) {
      CatalogDetailHeader(
        configuration: CatalogDetailHeaderConfiguration(
          imageURL: course.imageURL,
          description: course.description ?? "",
          systemImage: "book.closed.fill",
          title: course.title)
      )
      .padding(.horizontal, CatalogDetailLayout.horizontalInset(for: horizontalSizeClass))
      .padding(.top, 16)
      .padding(.bottom, 12)

      ProgressView()
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .accessibilityLabel(
          Text(
            "Loading course",
            tableName: "Courses",
            comment: "Accessibility status while a course loads."))
    }
    .frame(maxWidth: 900)
    .frame(maxWidth: .infinity)
  }
}

private struct CourseDetailEmptyView: View {
  var body: some View {
    ContentUnavailableView {
      Label {
        Text(
          "Course unavailable",
          tableName: "Courses",
          comment: "Title when a course cannot be loaded.")
      } icon: {
        Image(systemName: "book.closed")
      }
    } description: {
      Text(
        "Please return to the catalog and choose another course.",
        tableName: "Courses",
        comment: "Guidance when a course request returns no content.")
    }
  }
}
