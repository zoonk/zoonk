import SwiftUI

struct CourseCatalogSearchResultsView: View {
  @Environment(\.horizontalSizeClass) private var horizontalSizeClass
  @Environment(CourseCatalogStore.self) private var catalog

  let query: String
  let retry: @MainActor () async -> Void

  var body: some View {
    Group {
      switch catalog.searchState {
      case .idle:
        searchPrompt
      case .loading:
        ProgressView()
          .frame(maxWidth: .infinity, maxHeight: .infinity)
          .accessibilityLabel(
            Text(
              "Searching the catalog",
              tableName: "Courses",
              comment: "Accessibility status while catalog search results load."))
      case .loaded(let results):
        resultsList(results)
      case .empty:
        ContentUnavailableView.search(text: query)
      case .failed(let failure):
        CatalogFailureRecoveryView(context: .catalog, failure: failure, retry: retry)
      }
    }
    .frame(maxWidth: 900)
    .frame(maxWidth: .infinity)
  }

  private var searchPrompt: some View {
    ContentUnavailableView {
      Label {
        Text(
          "Search the catalog",
          tableName: "Courses",
          comment: "Title shown before the learner enters a catalog search query.")
      } icon: {
        Image(systemName: "magnifyingglass")
      }
    } description: {
      Text(
        "Find a course or jump directly to a chapter.",
        tableName: "Courses",
        comment: "Guidance shown before the learner enters a catalog search query.")
    }
  }

  private func resultsList(_ results: CatalogSearchResults) -> some View {
    List {
      if !results.courses.isEmpty {
        Section {
          ForEach(results.courses) { course in
            NavigationLink(
              value: CourseDestination.course(CourseReference(course))
            ) {
              CatalogSearchResultRow(
                description: course.description,
                imageURL: course.imageURL,
                systemImage: "book.closed.fill",
                title: course.title)
            }
          }
        } header: {
          Text(
            "Courses",
            tableName: "Courses",
            comment: "Heading above matching course search results.")
        }
      }

      if !results.chapters.isEmpty {
        Section {
          ForEach(results.chapters) { chapter in
            NavigationLink(
              value: CourseDestination.chapter(ChapterReference(chapter))
            ) {
              CatalogSearchResultRow(
                description: chapter.courseTitle,
                imageURL: chapter.imageURL,
                systemImage: "rectangle.stack.fill",
                title: chapter.title)
            }
          }
        } header: {
          Text(
            "Chapters",
            tableName: "Courses",
            comment: "Heading above matching chapter search results.")
        }
      }
    }
    .listStyle(.plain)
    .contentMargins(
      .horizontal,
      CatalogDetailLayout.horizontalInset(for: horizontalSizeClass),
      for: .scrollContent
    )
    .scrollDismissesKeyboard(.immediately)
  }
}

private struct CatalogSearchResultRow: View {
  @Environment(\.dynamicTypeSize) private var dynamicTypeSize

  let description: String?
  let imageURL: URL?
  let systemImage: String
  let title: String

  var body: some View {
    HStack(alignment: .top, spacing: 12) {
      CourseArtwork(
        imageURL: imageURL,
        cornerRadius: 12,
        systemImage: systemImage
      )
      .frame(width: 56, height: 56)

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
      .frame(maxWidth: .infinity, alignment: .leading)
    }
    .padding(.vertical, 4)
    .alignmentGuide(.listRowSeparatorLeading) { _ in
      68
    }
    .accessibilityElement(children: .combine)
  }
}
