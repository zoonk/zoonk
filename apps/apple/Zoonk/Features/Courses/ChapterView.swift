import SwiftUI

struct ChapterView: View {
  @Environment(CourseCatalogStore.self) private var catalog
  @Environment(SessionStore.self) private var session
  @State private var searchText = ""

  let chapter: ChapterReference

  var body: some View {
    Group {
      switch catalog.chapterState(for: chapter.id) {
      case .idle, .loading:
        ChapterLoadingView(chapter: chapter)
      case .loaded(let detail):
        ChapterDetailContent(
          chapter: chapter,
          detail: detail,
          searchText: $searchText)
      case .empty:
        ChapterDetailContent(
          chapter: chapter,
          detail: ChapterDetail(lessons: []),
          searchText: $searchText)
      case .failed(let failure):
        CatalogFailureRecoveryView(context: .chapter, failure: failure) {
          await catalog.loadChapter(id: chapter.id, force: true)
        }
      }
    }
    .background(Color(uiColor: .systemBackground))
    .task(
      id: CatalogDetailTaskID(
        resourceID: chapter.id,
        session: session.authenticatedSession)
    ) {
      await catalog.loadChapterIfNeeded(id: chapter.id)
    }
    .refreshable {
      await catalog.loadChapter(id: chapter.id, force: true)
    }
  }
}

private struct ChapterDetailContent: View {
  @Environment(SessionStore.self) private var session
  @State private var isFeedbackPresented = false
  @State private var isInformationPresented = false
  @State private var isSearchPresented = false

  let chapter: ChapterReference
  let detail: ChapterDetail
  @Binding var searchText: String

  var body: some View {
    ChapterDetailList(
      chapter: resolvedChapter,
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
        "Search lessons",
        tableName: "Courses",
        comment: "Placeholder for searching within a chapter's lessons.")
    )
    .sheet(isPresented: $isFeedbackPresented) {
      FeedbackSheet(
        api: FeedbackAPI.live(),
        defaultEmail: session.account?.user.email)
    }
  }

  private var resolvedChapter: ChapterReference {
    guard let canonicalChapter = detail.chapter else {
      return chapter
    }

    return ChapterReference((reference: chapter, chapter: canonicalChapter))
  }
}

private struct ChapterDetailList: View {
  @Environment(\.dynamicTypeSize) private var dynamicTypeSize
  @Environment(\.horizontalSizeClass) private var horizontalSizeClass
  @Environment(\.isSearching) private var isSearching

  let chapter: ChapterReference
  let detail: ChapterDetail
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
        CatalogCurriculumHeader(title: lessonsTitle)
      }

      List {
        if dynamicTypeSize.isAccessibilitySize {
          if !showsSearchResultsOnly {
            detailHeader
              .listRowInsets(EdgeInsets())
              .listRowSeparator(.hidden)
          }
          lessonsTitle
            .font(.headline)
            .accessibilityAddTraits(.isHeader)
            .listRowInsets(EdgeInsets())
            .listRowSeparator(.hidden)
        }
        if filteredLessons.isEmpty {
          emptyLessonsView
            .listRowSeparator(.hidden)
        } else {
          ForEach(filteredLessons) { lesson in
            NavigationLink(
              value: CourseDestination.lesson(
                LessonReference((chapter: chapter, lesson: lesson)))
            ) {
              CatalogNumberedRow(
                description: lesson.displayDescription(),
                imageURL: lesson.imageURL,
                number: (detail.primaryLessons.firstIndex(where: { $0.id == lesson.id })
                  ?? lesson.position) + 1,
                symbolTint: lesson.kind.symbolTint,
                systemImage: lesson.kind.systemImage,
                title: lesson.displayTitle()
              ) {
                if let progress = catalogLessonProgress(
                  lesson: lesson,
                  progress: detail.progress), progress != .notStarted
                {
                  CatalogProgressLabel(progress: progress)
                }
              }
            }
            .accessibilityValue(Text(lesson.kind.localizedTitle))
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
        if !showsSearchResultsOnly, let course = detail.course, let chapter = detail.chapter {
          ChapterOptionalPractice(detail: detail, course: course, chapter: chapter)
            .listRowSeparator(.hidden)
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
          imageURL: chapter.imageURL,
          description: chapter.description,
          systemImage: "rectangle.stack.fill",
          title: numberedTitle),
        showInformation: showInformation
      )
      .popover(isPresented: $isInformationPresented) {
        ChapterInformationView(
          chapter: chapter,
          dismiss: { isInformationPresented = false }
        )
        .presentationCompactAdaptation(.sheet)
      }

      if detail.primaryLessons.isEmpty && detail.canPrepareContent,
        let course = detail.course, let chapter = detail.chapter
      {
        Link(
          destination: courseWebURL(course).appending(component: "ch").appending(
            component: chapter.slug)
        ) {
          Label {
            Text(
              "Open chapter on web", tableName: "Courses",
              comment: "Opens a chapter on the website where missing lessons can be created")
          } icon: {
            Image(systemName: "arrow.up.right")
          }
        }
        .buttonStyle(.borderedProminent)
        .controlSize(.large)
      } else {
        CatalogDetailActions(
          continuation: detail.continuation,
          destination: continuationDestination,
          percentComplete: detail.progress?.percentComplete,
          showFeedback: showFeedback)
      }
    }
    .frame(maxWidth: .infinity, alignment: .leading)
    .padding(.horizontal, horizontalInset)
    .padding(.top, 16)
    .padding(.bottom, 12)
  }

  private var numberedTitle: String {
    chapter.title
  }

  private var lessonsTitle: Text {
    Text(
      "Lessons",
      tableName: "Courses",
      comment: "Heading above the ordered lesson list on a chapter screen.")
  }

  private var showsSearchResultsOnly: Bool {
    isSearching || catalogText(searchText) != nil
  }

  private var continuationDestination: CourseDestination? {
    chapterContinuationDestination(chapter: chapter, detail: detail)
  }

  private var filteredLessons: [CourseLesson] {
    filterCourseLessons(CatalogSearchRequest(items: detail.primaryLessons, query: searchText))
  }

  @ViewBuilder
  private var emptyLessonsView: some View {
    if catalogText(searchText) != nil {
      ContentUnavailableView.search(text: searchText)
    } else {
      ContentUnavailableView {
        Label {
          Text(
            "No lessons yet",
            tableName: "Courses",
            comment: "Title when a chapter does not have any published lessons.")
        } icon: {
          Image(systemName: "list.bullet.rectangle")
        }
      } description: {
        Text(
          "This chapter's lessons will appear here when they're available.",
          tableName: "Courses",
          comment: "Guidance when a chapter does not have any published lessons.")
      }
    }
  }
}

private struct ChapterInformationView: View {
  let chapter: ChapterReference
  let dismiss: () -> Void

  var body: some View {
    CatalogInformationView(
      dismiss: dismiss,
      title: LocalizedStringResource(
        "Chapter information",
        table: "Courses",
        comment: "Title for secondary information about a chapter.")
    ) {
      VStack(alignment: .leading, spacing: 16) {
        if let description = catalogText(chapter.description) {
          Text(description)
            .fixedSize(horizontal: false, vertical: true)
        }

        if chapter.organizationSlug == "ai" {
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

private struct ChapterLoadingView: View {
  @Environment(\.dynamicTypeSize) private var dynamicTypeSize
  @Environment(\.horizontalSizeClass) private var horizontalSizeClass

  let chapter: ChapterReference

  var body: some View {
    VStack(spacing: 0) {
      VStack(alignment: .leading, spacing: 16) {
        CatalogDetailHeader(
          configuration: CatalogDetailHeaderConfiguration(
            imageURL: chapter.imageURL,
            description: chapter.description,
            systemImage: "rectangle.stack.fill",
            title: chapter.title))

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

      CatalogCurriculumHeader(title: Text(verbatim: "Lessons"))

      List {
        ForEach(0..<5, id: \.self) { index in
          CatalogNumberedRow(
            description: "A short lesson description",
            imageURL: nil,
            number: index + 1,
            symbolTint: .orange,
            systemImage: "lightbulb",
            title: "Lesson title"
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
        "Loading chapter",
        tableName: "Courses",
        comment: "Accessibility status while a chapter loads."))
  }
}
