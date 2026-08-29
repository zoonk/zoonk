import SwiftUI

struct CoursesView: View {
  @Environment(CourseCatalogStore.self) private var catalog
  @Environment(\.horizontalSizeClass) private var horizontalSizeClass
  @State private var isSearchPresented = false
  @State private var searchText = ""
  @State private var selectedCategory: CourseCategory?

  let onCreateCourse: () -> Void

  var body: some View {
    Group {
      if showsSearch {
        CourseCatalogSearchResultsView(
          query: searchText,
          retry: { await catalog.searchCatalog(query: searchText, force: true) })
      } else {
        browseCatalog
      }
    }
    .background(Color(uiColor: .systemBackground))
    .searchable(
      text: $searchText,
      isPresented: $isSearchPresented,
      placement: .navigationBarDrawer(displayMode: .always),
      prompt: Text(
        "Search courses and chapters",
        tableName: "Courses",
        comment: "Placeholder for searching the public course catalog.")
    )
    .navigationDestination(for: CourseDestination.self) { destination in
      destinationView(destination)
        .navigationTitle(destination.title)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar(removing: destination.showsCompactHeader ? .title : nil)
    }
    .task(id: selectedCategory) {
      await catalog.loadCourses(category: selectedCategory, force: true)
    }
    .task(id: searchText) {
      await updateSearchResults()
    }
  }

  private var browseCatalog: some View {
    ScrollView {
      VStack(spacing: 12) {
        CourseCategorySelector(selection: $selectedCategory)

        catalogContent
          .padding(.horizontal, 16)
      }
      .frame(maxWidth: 1_180, alignment: .leading)
      .padding(.top, 4)
      .padding(.bottom, horizontalSizeClass == .regular ? 32 : 20)
      .frame(maxWidth: .infinity)
    }
    .scrollBounceBehavior(.basedOnSize)
    .refreshable {
      await catalog.loadCourses(category: selectedCategory, force: true)
    }
  }

  private var showsSearch: Bool {
    isSearchPresented || catalogText(searchText) != nil
  }

  private func updateSearchResults() async {
    guard catalogText(searchText) != nil else {
      catalog.clearSearch()
      return
    }

    do {
      try await Task.sleep(for: .milliseconds(250))
    } catch {
      return
    }

    guard !Task.isCancelled else {
      return
    }

    await catalog.searchCatalog(query: searchText)
  }

  @ViewBuilder
  private var catalogContent: some View {
    switch catalog.coursesState {
    case .idle, .loading:
      CourseCatalogLoadingGrid()
    case .loaded(let page):
      CourseCatalogGrid(category: selectedCategory, page: page)
    case .empty:
      CourseCatalogEmptyView(category: selectedCategory, onCreateCourse: onCreateCourse)
    case .failed(let failure):
      CatalogFailureRecoveryView(context: .catalog, failure: failure) {
        await catalog.loadCourses(category: selectedCategory, force: true)
      }
    }
  }

  @ViewBuilder
  private func destinationView(_ destination: CourseDestination) -> some View {
    switch destination {
    case .course(let course):
      CourseView(course: course)
    case .chapter(let chapter):
      ChapterView(chapter: chapter)
    case .lesson(let lesson):
      LessonPlaceholderView(lesson: lesson)
    }
  }
}

private struct CourseCatalogEmptyView: View {
  let category: CourseCategory?
  let onCreateCourse: () -> Void

  var body: some View {
    ContentUnavailableView {
      Label {
        if let category {
          Text(
            "No \(String(localized: category.localizedTitle)) courses yet",
            tableName: "Courses",
            comment: "Title when a selected category does not contain any courses.")
        } else {
          Text(
            "No courses yet",
            tableName: "Courses",
            comment: "Title when the public course catalog is empty.")
        }
      } icon: {
        Image(systemName: category?.systemImage ?? "books.vertical")
      }
    } description: {
      Text(
        "Courses will appear here when they're available.",
        tableName: "Courses",
        comment: "Guidance when no public courses are available.")
    } actions: {
      if let category {
        Button(action: onCreateCourse) {
          Label {
            Text(
              "Create a course about \(String(localized: category.localizedTitle))",
              tableName: "Courses",
              comment:
                "Opens course creation from an empty category. The interpolated value is the category name."
            )
          } icon: {
            Image(systemName: "plus")
          }
        }
        .buttonStyle(.bordered)
      }
    }
    .frame(maxWidth: .infinity, minHeight: 280)
  }
}
