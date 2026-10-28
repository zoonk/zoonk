import SwiftUI

struct AllCoursesView: View {
  @Environment(CourseCatalogStore.self) private var catalog
  /// Partially folded, iPhone Duo keeps the box and the categories under the title, on the page
  /// before the fold, while the courses take both pages. Nil, the list's own margin, elsewhere.
  @State private var leadingPageMargin: CGFloat?

  @Binding var category: CourseCategory?
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

  /// The goal box, the categories and the courses in one list, so the box keeps its native field
  /// and the courses scroll under it.
  private var browseCatalog: some View {
    List {
      GoalStartEntry(isBoxOnly: true)
        .listSectionMargins(.trailing, leadingPageMargin)

      if let counts = catalog.categoryCounts.value {
        Section {
          CourseCategorySelector(
            categories: populatedCategories(counts: counts, open: category),
            selection: $category)
        }
        .listRowInsets(EdgeInsets())
        .listRowBackground(Color.clear)
        .listSectionMargins(.trailing, leadingPageMargin)
      }

      CatalogCourses(category: category)
    }
    // Section margins count from the list's whole bounds, which run under the vertical bar.
    .onGeometryChange(for: CGFloat?.self) { proxy in
      PaneSpace(proxy).fold.map {
        proxy.size.width - $0.lowerBound + proxy.safeAreaInsets.trailing
      }
    } action: {
      leadingPageMargin = $0
    }
    .loads(catalog.courses(category: category), catalog.categoryCounts)
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
}

/// The categories that have courses in the reader's language, in its alphabetical order: an empty
/// one would only lead to "Start a goal", which the box above already offers. The open one stays
/// listed, so the row always says where it is.
func populatedCategories(
  counts: CourseCategoryCounts, open: CourseCategory?, locale: Locale = .current
) -> [CourseCategory] {
  localizedCourseCategories(locale: locale).filter { category in
    (counts.counts[category] ?? 0) > 0 || category == open
  }
}

/// The chosen category's courses: one row each, or on a wide screen as many columns as fit.
private struct CatalogCourses: View {
  @Environment(CourseCatalogStore.self) private var catalog
  @Environment(AppRouter.self) private var router

  let category: CourseCategory?

  var body: some View {
    switch catalog.courses(category: category).state {
    case .idle, .loading:
      ProgressView()
        .frame(maxWidth: .infinity)
        .listRowBackground(Color.clear)
        .accessibilityLabel(
          Text(
            "Loading courses", tableName: "Courses",
            comment: "Accessibility status while the course catalog loads."))
    case .loaded(let page):
      CourseCatalogGrid(category: category, page: page)
    case .empty:
      CourseCatalogEmptyView(category: category) { router.open(.startGoal()) }
        .listRowBackground(Color.clear)
    case .failed(let failure):
      CatalogFailureRecoveryView(context: .catalog, failure: failure) {
        await catalog.courses(category: category).refresh()
      }
      .listRowBackground(Color.clear)
    }
  }
}

private struct CourseCatalogEmptyView: View {
  let category: CourseCategory?
  let startGoal: () -> Void

  var body: some View {
    ContentUnavailableView {
      Label {
        Text("No courses", tableName: "Courses", comment: "Title when the catalog has no courses")
      } icon: {
        Image(systemName: "square.and.pencil")
      }
    } description: {
      Text(
        "No courses available yet.", tableName: "Courses",
        comment: "Guidance when the catalog or a category has no courses")
    } actions: {
      if category != nil {
        Button(action: startGoal) {
          Label {
            Text(
              "Start a goal", tableName: "Courses",
              comment: "Opens the start of a new goal from an empty category")
          } icon: {
            Image(systemName: "plus")
          }
        }
        .buttonStyle(.bordered)
      }
    }
  }
}
