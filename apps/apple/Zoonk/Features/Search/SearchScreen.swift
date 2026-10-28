import SwiftUI

/// The search tab, main's command palette as a native search: with no query, the learner's actions,
/// places and other goals; with one, those that match plus settings and help, quick explanations
/// and the catalog's courses and chapters, then asking the buddy about it or starting a goal with
/// it. Everything but the catalog comes from the learner summary, so typing requests only the
/// debounced catalog search.
struct SearchScreen: View {
  @Environment(AppRouter.self) private var router
  @Environment(CourseCatalogStore.self) private var catalog
  @Environment(LearnerSummaryStore.self) private var learner
  @Environment(SessionStore.self) private var session
  @State private var query = ""
  @State private var isFeedbackPresented = false

  var body: some View {
    List {
      ForEach(groups) { group in
        Section {
          ForEach(group.items) { item in
            Button {
              perform(item.action)
            } label: {
              Label(item.title, systemImage: item.systemImage)
            }
            .badge(item.badge)
            .foregroundStyle(.primary)
          }
        } header: {
          Text(group.title)
        }
      }

      if let results = catalogResults, !results.isEmpty {
        Section {
          ForEach(results.courses) { course in
            NavigationLink(value: CourseDestination.course(CourseReference(course))) {
              Label(course.title, systemImage: "book.closed")
            }
          }

          ForEach(results.chapters) { chapter in
            NavigationLink(value: CourseDestination.chapter(ChapterReference(chapter))) {
              Label {
                Text(chapter.title)
                Text(chapter.courseTitle)
              } icon: {
                Image(systemName: "rectangle.stack")
              }
            }
          }
        } header: {
          Text("In the catalog", tableName: "Search", comment: "Search results from the catalog")
        }
      }

      if let fallback {
        Section {
          ForEach(fallback.items) { item in
            Button {
              perform(item.action)
            } label: {
              Label(item.title, systemImage: item.systemImage)
            }
            .foregroundStyle(.primary)
          }
        } header: {
          Text(fallback.title)
        }
      }
    }
    .navigationTitle(Text(AppTab.search.title))
    .searchable(
      text: $query,
      prompt: Text(
        "Search or ask…", tableName: "Search",
        comment: "Placeholder of the search field that also asks the buddy or starts a goal")
    )
    .task(id: query) {
      await searchCatalog()
    }
    .navigationDestination(for: CourseDestination.self) { destination in
      Group {
        switch destination {
        case .course(let course):
          CourseView(course: course)
        case .chapter(let chapter):
          ChapterView(chapter: chapter)
        }
      }
      .navigationTitle(destination.title)
      .navigationBarTitleDisplayMode(.inline)
      .toolbar(removing: .title)
    }
    .sheet(isPresented: $isFeedbackPresented) {
      FeedbackSheet(
        api: FeedbackAPI.live(),
        defaultEmail: session.account?.user.email,
        token: session.authenticatedSession?.bearerToken)
    }
  }

  private var text: String? {
    catalogText(query)
  }

  private var groups: [SearchGroup] {
    searchGroups(summary: learner.summary.value, isSignedIn: session.authenticatedSession != nil)
      .compactMap { group in
        guard let text else {
          return group.isShownWithoutQuery ? group : nil
        }

        let items = group.items.filter { $0.title.localizedStandardContains(text) }
        return items.isEmpty ? nil : SearchGroup(id: group.id, title: group.title, items: items)
      }
  }

  private var catalogResults: CatalogSearchResults? {
    guard text != nil, case .loaded(let results) = catalog.searchState else {
      return nil
    }

    return results
  }

  private var fallback: SearchGroup? {
    text.map { searchFallback(question: $0, summary: learner.summary.value) }
  }

  /// Waits for typing to pause before asking the catalog, and drops the results of a cleared query.
  private func searchCatalog() async {
    guard text != nil else {
      catalog.clearSearch()
      return
    }

    catalog.prepareSearch(query: query)

    do {
      try await Task.sleep(for: .milliseconds(250))
    } catch {
      return
    }

    await catalog.searchCatalog(query: query)
  }

  private func perform(_ action: SearchItem.Action) {
    switch action {
    case .open(let route):
      router.open(route)
    case .select(let tab):
      router.showRoot(of: tab)
    case .present(let sheet):
      router.present(sheet)
    case .feedback:
      isFeedbackPresented = true
    case .switchGoal(let goalID):
      Task {
        await learner.switchGoal(to: goalID)
      }
      router.showRoot(of: .today)
    }
  }
}
