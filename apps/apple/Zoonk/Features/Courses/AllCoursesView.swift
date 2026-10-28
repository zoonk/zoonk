import SwiftUI

struct AllCoursesView: View {
  @Environment(CourseCatalogStore.self) private var catalog
  @Environment(AppRouter.self) private var router
  @Environment(\.horizontalSizeClass) private var horizontalSizeClass
  @State private var selectedCategory: CourseCategory?

  let searchText: String

  var body: some View {
    Group {
      if catalogText(searchText) != nil {
        CourseCatalogSearchResultsView(
          query: searchText,
          retry: { await catalog.searchCatalog(query: searchText, force: true) })
      } else {
        browseCatalog
      }
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
    .loads(catalog.courses(category: selectedCategory))
  }

  private func updateSearchResults() async {
    guard catalogText(searchText) != nil else {
      catalog.clearSearch()
      return
    }

    catalog.prepareSearch(query: searchText)

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
    switch catalog.courses(category: selectedCategory).state {
    case .idle, .loading:
      CourseCatalogLoadingGrid()
    case .loaded(let page):
      CourseCatalogGrid(category: selectedCategory, page: page)
    case .empty:
      CourseCatalogEmptyView(category: selectedCategory) { router.open(.startGoal) }
    case .failed(let failure):
      CatalogFailureRecoveryView(context: .catalog, failure: failure) {
        await catalog.courses(category: selectedCategory).refresh()
      }
    }
  }
}

private struct CourseCatalogEmptyView: View {
  let category: CourseCategory?
  let startGoal: () -> Void

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
      Button(action: startGoal) {
        Text(
          "Start a goal", tableName: "Courses",
          comment: "Opens the start of a new goal from an empty catalog")
      }
      .buttonStyle(.bordered)
    }
    .frame(maxWidth: .infinity, minHeight: 280)
  }
}
