import SwiftUI

/// Everything but the catalog comes from cached reads, so typing requests only the debounced
/// catalog search.
struct SearchScreen: View {
  @Environment(AppRouter.self) private var router
  @Environment(BuddyStore.self) private var buddy
  @Environment(CourseCatalogStore.self) private var catalog
  @Environment(ExamStore.self) private var exams
  @Environment(LearnerSummaryStore.self) private var learner
  @Environment(PlanStore.self) private var plans
  @Environment(SessionStore.self) private var session
  @Environment(\.horizontalSizeClass) private var horizontalSizeClass
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
    // On a phone the tab bar doesn't turn the search tab into a field, so it stays under the
    // title; wider windows keep the system's place in the bar, which leaves the tabs reachable.
    .searchable(
      text: $query,
      placement: horizontalSizeClass == .compact
        ? .navigationBarDrawer(displayMode: .always) : .automatic,
      prompt: Text(
        "Search or ask…", tableName: "Search",
        comment: "Placeholder of the search field that also asks the buddy or starts a goal")
    )
    .task(id: query) {
      await searchCatalog()
    }
    .catalogDestinations()
    .sheet(isPresented: $isFeedbackPresented) {
      FeedbackSheet(api: FeedbackAPI.live())
    }
  }

  private var text: String? {
    catalogText(query)
  }

  private var groups: [SearchGroup] {
    searchGroups(
      summary: learner.summary.value, isSignedIn: session.authenticatedSession != nil,
      syllabus: syllabus?.value, mocks: exam?.value?.mocks ?? []
    )
    .compactMap { group in
      guard let text else {
        return group.isShownWithoutQuery ? group : nil
      }

      // A year of weekly mocks would bury the rest: main shows the six newest that match.
      let matching = group.items.filter { $0.matches(text) }
      let items = group.id == "mocks" ? Array(matching.prefix(6)) : matching
      return items.isEmpty ? nil : SearchGroup(id: group.id, title: group.title, items: items)
    }
  }

  private var syllabus: Resource<GoalSyllabus>? {
    learner.summary.value?.shownGoal.map { plans.syllabus(goalId: $0.id) }
  }

  private var exam: Resource<ExamView>? {
    guard learner.summary.value?.places.exam == true,
      let goal = learner.summary.value?.shownGoal
    else {
      return nil
    }

    return exams.exam(goalId: goal.id)
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

  private func searchCatalog() async {
    guard text != nil else {
      catalog.clearSearch()
      return
    }

    catalog.prepareSearch(query: query)
    let plan = syllabus
    let exam = exam
    async let planLoaded: Void = { await plan?.load() }()
    async let examLoaded: Void = { await exam?.load() }()

    do {
      try await Task.sleep(for: .milliseconds(250))
    } catch {
      return
    }

    await catalog.searchCatalog(query: query)
    await planLoaded
    await examLoaded
  }

  private func perform(_ action: SearchItem.Action) {
    switch action {
    case .ask(let question):
      buddy.broughtQuestion = question
      router.showRoot(of: .buddy)
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
