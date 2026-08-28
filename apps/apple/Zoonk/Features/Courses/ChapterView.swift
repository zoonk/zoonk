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
      await catalog.loadChapter(id: chapter.id, force: true)
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
      if !showsSearchResultsOnly {
        detailHeader
      }

      List {
        Section {
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
                  number: lesson.position + 1,
                  systemImage: lesson.kind.systemImage,
                  title: lesson.displayTitle()
                ) {
                  if let progress = catalogLessonProgress(
                    lesson: lesson,
                    progress: detail.progress)
                  {
                    CatalogProgressLabel(progress: progress)
                  }
                }
              }
              .listRowInsets(
                EdgeInsets(top: 10, leading: 0, bottom: 10, trailing: 0))
            }
          }
        } header: {
          Text(
            "Lessons",
            tableName: "Courses",
            comment: "Heading above the ordered lesson list on a chapter screen."
          )
          .listRowInsets(EdgeInsets(top: 0, leading: 0, bottom: 0, trailing: 0))
          .padding(
            .leading,
            CatalogDetailLayout.horizontalInset(for: horizontalSizeClass))
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
    let horizontalInset = CatalogDetailLayout.horizontalInset(for: horizontalSizeClass)

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

      HStack(spacing: 8) {
        if let continuationDestination {
          CatalogContinueLink(
            continuation: detail.continuation,
            destination: continuationDestination,
            percentComplete: detail.progress?.percentComplete)
        } else {
          Spacer(minLength: 0)
        }

        CatalogActionsMenu(showFeedback: showFeedback)

        if horizontalSizeClass == .regular, continuationDestination != nil {
          Spacer(minLength: 0)
        }
      }
    }
    .frame(maxWidth: .infinity, alignment: .leading)
    .padding(.horizontal, horizontalInset)
    .padding(.top, 16)
    .padding(.bottom, 12)
  }

  private var numberedTitle: String {
    guard let position = chapter.position else {
      return chapter.title
    }

    return "\((position + 1).formatted()). \(chapter.title)"
  }

  private var showsSearchResultsOnly: Bool {
    isSearching || catalogText(searchText) != nil
  }

  private var continuationDestination: CourseDestination? {
    chapterContinuationDestination(chapter: chapter, detail: detail)
  }

  private var filteredLessons: [CourseLesson] {
    filterCourseLessons(CatalogSearchRequest(items: detail.lessons, query: searchText))
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
  @Environment(\.horizontalSizeClass) private var horizontalSizeClass

  let chapter: ChapterReference

  var body: some View {
    List {
      VStack(alignment: .leading, spacing: 16) {
        CatalogDetailHeader(
          configuration: CatalogDetailHeaderConfiguration(
            imageURL: chapter.imageURL,
            description: chapter.description,
            systemImage: "rectangle.stack.fill",
            title: chapter.position.map { "\(($0 + 1).formatted()). \(chapter.title)" }
              ?? chapter.title))

        HStack(spacing: 8) {
          Text(verbatim: "Start")
            .frame(maxWidth: horizontalSizeClass == .regular ? 260 : .infinity)
            .frame(minHeight: 44)
          Image(systemName: "ellipsis")
            .frame(width: 44, height: 44)
        }
      }
      .listRowSeparator(.hidden)

      Section {
        ForEach(0..<5, id: \.self) { index in
          CatalogNumberedRow(
            description: "A short lesson description",
            imageURL: nil,
            number: index + 1,
            systemImage: "lightbulb",
            title: "Lesson title"
          ) {
            Text(verbatim: "Not started")
          }
          .listRowInsets(
            EdgeInsets(top: 10, leading: 0, bottom: 10, trailing: 0))
        }
      } header: {
        Text(verbatim: "Lessons")
          .listRowInsets(EdgeInsets(top: 0, leading: 0, bottom: 0, trailing: 0))
          .padding(
            .leading,
            CatalogDetailLayout.horizontalInset(for: horizontalSizeClass))
      }
    }
    .listStyle(.plain)
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
