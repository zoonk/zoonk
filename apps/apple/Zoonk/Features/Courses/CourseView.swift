import SwiftUI

struct CourseView: View {
  @Environment(CourseCatalogStore.self) private var catalog
  @Environment(SessionStore.self) private var session
  @State private var searchText = ""

  let course: CourseReference

  var body: some View {
    Group {
      switch catalog.courseState(for: course.id) {
      case .idle, .loading:
        CourseLoadingView(course: course)
      case .loaded(let detail):
        CourseDetailContent(detail: detail, searchText: $searchText)
      case .empty:
        CourseDetailEmptyView()
      case .failed(let failure):
        CatalogFailureRecoveryView(context: .course, failure: failure) {
          await catalog.loadCourse(id: course.id, force: true)
        }
      }
    }
    .background(Color(uiColor: .systemBackground))
    .task(
      id: CatalogDetailTaskID(
        resourceID: course.id,
        session: session.authenticatedSession)
    ) {
      await catalog.loadCourseIfNeeded(id: course.id)
    }
    .refreshable {
      await catalog.loadCourse(id: course.id, force: true)
    }
  }
}

private struct CourseDetailContent: View {
  @Environment(SessionStore.self) private var session
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
        defaultEmail: session.account?.user.email)
    }
  }
}

private struct CourseDetailList: View {
  @Environment(\.dynamicTypeSize) private var dynamicTypeSize
  @State private var showsFullCourse = false
  @State private var selectedLevel = "all"
  @Environment(\.horizontalSizeClass) private var horizontalSizeClass
  @Environment(\.isSearching) private var isSearching

  let detail: CourseDetail
  @Binding var isInformationPresented: Bool
  @Binding var searchText: String
  let showFeedback: () -> Void
  let showInformation: () -> Void

  var body: some View {
    VStack(spacing: 0) {
      if !showsSearchResultsOnly && !dynamicTypeSize.isAccessibilitySize {
        detailHeader
      }

      if !dynamicTypeSize.isAccessibilitySize {
        curriculumControls
      }

      List {
        if dynamicTypeSize.isAccessibilitySize {
          if !showsSearchResultsOnly {
            detailHeader
              .listRowInsets(EdgeInsets())
              .listRowSeparator(.hidden)
          }
          curriculumControls
            .listRowInsets(EdgeInsets())
            .listRowSeparator(.hidden)
        }
        if filteredChapters.isEmpty {
          emptyChaptersView
            .listRowSeparator(.hidden)
        } else {
          ForEach(filteredChapters) { chapter in
            NavigationLink(
              value: CourseDestination.chapter(
                ChapterReference((course: detail.course, chapter: chapter)))
            ) {
              CatalogNumberedRow(
                description: chapter.description,
                imageURL: chapter.imageURL ?? detail.course.imageURL,
                number: showsFullCourse && selectedLevel == "all"
                  ? chapter.position + 1
                  : (filteredChapters.firstIndex(where: { $0.id == chapter.id }) ?? 0) + 1,
                systemImage: "rectangle.stack.fill",
                title: chapter.title
              ) {
                if let progress = catalogChapterProgress(
                  chapter: chapter,
                  progress: showsFullCourse ? detail.progress : detail.pathProgress),
                  progress != .notStarted
                {
                  CatalogProgressLabel(progress: progress)
                }
              }
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
        }
      }
      .listStyle(.plain)
      .scrollContentBackground(.hidden)
      .contentMargins(
        .horizontal,
        CatalogDetailLayout.horizontalInset(for: horizontalSizeClass),
        for: .scrollContent)
    }
    .frame(maxWidth: 900)
    .frame(maxWidth: .infinity)
  }

  private var detailHeader: some View {
    let horizontalInset =
      dynamicTypeSize.isAccessibilitySize
      ? 0 : CatalogDetailLayout.horizontalInset(for: horizontalSizeClass)

    return VStack(alignment: .leading, spacing: 16) {
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

      if needsWebSetup {
        CourseWebLearningLink(
          course: detail.course, isResuming: detail.learningPath?.requiresFocusedReselection == true
        )
        .frame(maxWidth: horizontalSizeClass == .regular ? 280 : .infinity)
      } else {
        CatalogDetailActions(
          continuation: detail.continuation,
          destination: continuationDestination,
          percentComplete: detail.pathProgress?.percentComplete,
          showFeedback: showFeedback,
          course: detail.course,
          supportsLearningPlan: detail.learningPath?.supportsLearningPlan == true)
      }

      if let summary = detail.learningPath?.summary, !summary.isEmpty {
        Text(summary).font(.subheadline).foregroundStyle(.secondary)
      }
    }
    .frame(maxWidth: .infinity, alignment: .leading)
    .padding(.horizontal, horizontalInset)
    .padding(.top, 16)
    .padding(.bottom, 12)
  }

  private var showsSearchResultsOnly: Bool {
    isSearching || catalogText(searchText) != nil
  }

  private var curriculumControls: some View {
    CourseCurriculumControls(
      detail: detail, showsFullCourse: $showsFullCourse, level: $selectedLevel
    )
    .padding(
      .horizontal,
      dynamicTypeSize.isAccessibilitySize
        ? 0
        : CatalogDetailLayout.horizontalInset(for: horizontalSizeClass)
    )
    .padding(.vertical, 8)
  }

  private var continuationDestination: CourseDestination? {
    courseContinuationDestination(detail)
  }

  private var needsWebSetup: Bool {
    if detail.chapters.isEmpty { return detail.canPrepareContent }
    if detail.learningPath?.supportsLearningPlan == false { return false }
    guard !detail.course.isPrivate else { return false }
    if detail.learningPath?.requiresFocusedReselection == true { return true }
    return detail.learningPath?.needsPlan == true && detail.continuation?.hasStarted != true
  }

  private var filteredChapters: [CourseChapter] {
    let chapters =
      showsFullCourse
      ? detail.chapters.filter { selectedLevel == "all" || $0.level == selectedLevel }
      : detail.selectedChapters
    let matchingIDs = Set(
      filterCourseChapters(CatalogSearchRequest(items: chapters, query: searchText)).map(\.id))
    return chapters.filter { matchingIDs.contains($0.id) }
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
          Text(
            course.organization?.name
              ?? String(
                localized: "Personal course", table: "Courses",
                comment: "Owner-private course information label")
          )
          .font(.subheadline.weight(.semibold))
          .foregroundStyle(.secondary)

          if !course.categories.isEmpty {
            Text(categoryDescription)
              .font(.caption.weight(.medium))
              .foregroundStyle(.secondary)
              .padding(.horizontal, 10)
              .padding(.vertical, 6)
              .background(.quaternary, in: Capsule())
          }

          if course.resolvedBrandSlug == "ai" {
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

private struct CourseLoadingView: View {
  @Environment(\.dynamicTypeSize) private var dynamicTypeSize
  @Environment(\.horizontalSizeClass) private var horizontalSizeClass

  let course: CourseReference

  var body: some View {
    VStack(spacing: 0) {
      VStack(alignment: .leading, spacing: 16) {
        CatalogDetailHeader(
          configuration: CatalogDetailHeaderConfiguration(
            imageURL: course.imageURL,
            description: course.description ?? "Course description",
            systemImage: "book.closed.fill",
            title: course.title))

        HStack(spacing: 8) {
          Text(verbatim: "Start")
            .frame(maxWidth: horizontalSizeClass == .regular ? 260 : .infinity)
            .frame(minHeight: 44)
          Image(systemName: "ellipsis")
            .frame(width: 44, height: 44)
        }
        .padding(
          .leading,
          CatalogDetailLayout.actionLeadingInset(
            for: horizontalSizeClass,
            dynamicTypeSize: dynamicTypeSize))
      }
      .padding(.horizontal, CatalogDetailLayout.horizontalInset(for: horizontalSizeClass))
      .padding(.top, 16)
      .padding(.bottom, 12)

      CatalogCurriculumHeader(title: Text(verbatim: "Chapters"))

      List {
        ForEach(0..<4, id: \.self) { index in
          CatalogNumberedRow(
            description: "A short chapter description",
            imageURL: nil,
            number: index + 1,
            systemImage: "rectangle.stack.fill",
            title: "Chapter title"
          ) {
            Text(verbatim: "Not started")
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
      }
      .listStyle(.plain)
      .contentMargins(
        .horizontal,
        CatalogDetailLayout.horizontalInset(for: horizontalSizeClass),
        for: .scrollContent)
    }
    .frame(maxWidth: 900)
    .frame(maxWidth: .infinity)
    .redacted(reason: .placeholder)
    .accessibilityElement(children: .ignore)
    .accessibilityLabel(
      Text(
        "Loading course",
        tableName: "Courses",
        comment: "Accessibility status while a course loads."))
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
