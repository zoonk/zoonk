import SwiftUI

struct ChapterView: View {
  @Environment(CourseCatalogStore.self) private var catalog
  @State private var searchText = ""

  let chapter: ChapterReference

  var body: some View {
    Group {
      switch catalog.chapter(chapter.key).state {
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
          detail: ChapterDetail(chapter: nil, lessons: []),
          searchText: $searchText)
      case .failed(let failure):
        CatalogFailureRecoveryView(context: .chapter, failure: failure) {
          await catalog.chapter(chapter.key).refresh()
        }
      }
    }
    .background(Color(uiColor: .systemBackground))
    .loads(catalog.chapter(chapter.key))
  }
}

private struct ChapterDetailContent: View {
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
        context: FeedbackContext(contentID: chapter.id, contentKind: .chapter))
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
  @Environment(AppRouter.self) private var router
  @Environment(\.horizontalSizeClass) private var horizontalSizeClass
  @Environment(\.isSearching) private var isSearching

  let chapter: ChapterReference
  let detail: ChapterDetail
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
            "Lessons",
            tableName: "Courses",
            comment: "Heading above the ordered lesson list on a chapter screen."))
      }
      .listRowInsets(EdgeInsets())
      .listRowSeparator(.hidden)

      if filteredLessons.isEmpty {
        emptyLessonsView
          .listRowSeparator(.hidden)
      } else {
        ForEach(filteredLessons) { lesson in
          Button {
            router.open(.lesson(lessonId: lesson.id))
          } label: {
            CatalogNumberedRow(
              description: lesson.displayDescription(),
              imageURL: nil,
              number: lesson.position + 1,
              systemImage: "book.pages",
              title: lesson.displayTitle()
            )
          }
          .foregroundStyle(.primary)
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
      for: .scrollContent
    )
    .frame(maxWidth: 900)
    .frame(maxWidth: .infinity)
  }

  private var detailHeader: some View {
    VStack(alignment: .leading, spacing: 16) {
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

      CatalogDetailActions(
        courseID: chapter.courseID,
        chapterID: chapter.id,
        tryLessonID: detail.tryLessonID,
        showFeedback: showFeedback)
    }
    .frame(maxWidth: .infinity, alignment: .leading)
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

/// The page as soon as it opens: what the tapped row already said about it, then a spinner where
/// its list loads. Never a skeleton.
private struct ChapterLoadingView: View {
  @Environment(\.horizontalSizeClass) private var horizontalSizeClass

  let chapter: ChapterReference

  var body: some View {
    VStack(spacing: 0) {
      CatalogDetailHeader(
        configuration: CatalogDetailHeaderConfiguration(
          imageURL: chapter.imageURL,
          description: chapter.description,
          systemImage: "rectangle.stack.fill",
          title: chapter.position.map { "\(($0 + 1).formatted()). \(chapter.title)" }
            ?? chapter.title)
      )
      .padding(.horizontal, CatalogDetailLayout.horizontalInset(for: horizontalSizeClass))
      .padding(.top, 16)
      .padding(.bottom, 12)

      ProgressView()
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .accessibilityLabel(
          Text(
            "Loading chapter",
            tableName: "Courses",
            comment: "Accessibility status while a chapter loads."))
    }
    .frame(maxWidth: 900)
    .frame(maxWidth: .infinity)
  }
}
