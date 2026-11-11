import Observation
import SwiftUI

enum AppSheet: Hashable, Identifiable {
  case account(AccountPage? = nil)
  case feedback(screen: String)
  case signIn
  case subscription

  var id: Self { self }
}

@MainActor
@Observable
final class AppRouter {
  var selectedTab = AppTab.today
  var sheet: AppSheet?
  /// The speaking paper's open task in this window, as main's `/speaking?task=`.
  var speakingTask: String?
  private(set) var tasks: [AppRoute] = [] {
    didSet {
      hiddenTasks = hiddenTasks.filter { tasks.count > $0 + 1 }
    }
  }
  private var hiddenTasks: Set<Int> = []
  private var paths: [AppTab: NavigationPath] = [:]
  let playback = SessionPlayback()
  @ObservationIgnored private let openBlock: BlockOpener

  typealias BlockOpener =
    @MainActor (_ blockID: String, _ router: AppRouter) async -> MutationResult<StudyDestination>

  init(openBlock: @escaping BlockOpener = { _, _ in .obsolete }) {
    self.openBlock = openBlock
  }

  func path(for tab: AppTab) -> Binding<NavigationPath> {
    Binding(
      get: { self.paths[tab] ?? NavigationPath() },
      set: { self.paths[tab] = $0 })
  }

  /// Clearing it closes it and the tasks it opened.
  func task(at depth: Int) -> Binding<AppRoute?> {
    Binding(
      get: { self.tasks.indices.contains(depth) ? self.tasks[depth] : nil },
      set: { route in
        guard route == nil, self.tasks.count > depth else {
          return
        }

        self.tasks.removeSubrange(depth...)
      })
  }

  /// The tabs are layer 0 and each task the next. Only the topmost layer presents the sheet, since a
  /// view a task covers can't present.
  func sheet(presentedBy layer: Int) -> Binding<AppSheet?> {
    Binding(
      get: { layer == self.tasks.count ? self.sheet : nil },
      set: { sheet in
        guard layer == self.tasks.count else {
          return
        }

        self.sheet = sheet
      })
  }

  func select(_ tab: AppTab) {
    selectedTab = tab
  }

  /// A push closes any task first. A Study place already selected in the sidebar goes back to its
  /// root, and a route already on the stack is gone back to, instead of stacking itself again.
  func open(_ route: AppRoute) {
    switch route.presentation {
    case .task:
      tasks.append(route)
    case .push:
      tasks = []

      var path = paths[selectedTab] ?? NavigationPath()

      if route.studyTab == selectedTab {
        path = NavigationPath()
      } else if let depth = Self.depth(of: route, in: path) {
        path.removeLast(path.count - depth)
      } else {
        path.append(route)
      }

      paths[selectedTab] = path
    }
  }

  /// A value the selected tab's own `navigationDestination` shows.
  func push(_ value: some Hashable) {
    paths[selectedTab, default: NavigationPath()].append(value)
  }

  /// `NavigationPath` doesn't show its elements, but paths compare by them.
  private static func depth(of route: AppRoute, in path: NavigationPath) -> Int? {
    var prefix = path

    while !prefix.isEmpty {
      var before = prefix
      before.removeLast()
      var candidate = before
      candidate.append(route)

      if candidate == prefix {
        return prefix.count
      }

      prefix = before
    }

    return nil
  }

  /// `beneath` takes its place at once and out of sight, so the learner sees only `route` come in,
  /// and closing `route` shows `beneath`, such as a lesson over the session that goes on after it.
  func open(_ route: AppRoute, over beneath: AppRoute) {
    var instant = Transaction()
    instant.disablesAnimations = true

    withTransaction(instant) {
      tasks.append(beneath)
      hiddenTasks.insert(tasks.count - 1)
    }

    // On the next turn, so the task beneath is in place without animation (a change in the same
    // turn would carry its own transaction to both) and `route` comes in with its own.
    let depth = tasks.count - 1
    Task { @MainActor [weak self] in
      guard let self, tasks.count == depth + 1, tasks.last == beneath else {
        return
      }

      open(route)
    }
  }

  func isHidden(taskAt depth: Int) -> Bool {
    hiddenTasks.contains(depth)
  }

  /// Changes whenever the window goes somewhere: another tab, task, pushed screen or sheet.
  var shown: Shown {
    Shown(
      tab: selectedTab, tasks: tasks, path: paths[selectedTab] ?? NavigationPath(), sheet: sheet)
  }

  struct Shown: Equatable {
    let tab: AppTab
    let tasks: [AppRoute]
    let path: NavigationPath
    let sheet: AppSheet?
  }

  @discardableResult
  func open(url: URL) -> Bool {
    switch AppLink(url: url) {
    case .tab(let tab):
      showRoot(of: tab)
      return true
    case .route(let route):
      open(route)
      return true
    case .block(let blockID):
      Task { await open(blockID: blockID) }
      return true
    case .sheet(let sheet):
      present(sheet)
      return true
    case nil:
      return false
    }
  }

  /// A block no longer free to start shows Today as it stands.
  @discardableResult
  func open(blockID: String) async -> MutationResult<StudyDestination> {
    let result = await openBlock(blockID, self)

    if case .done(.changed) = result {
      showRoot(of: .today)
    }

    return result
  }

  /// A block a buddy answer links, which says itself when the block isn't free to start anymore.
  func openAnswerLink(blockID: String) async -> MutationResult<StudyDestination> {
    await openBlock(blockID, self)
  }

  func showRoot(of tab: AppTab) {
    tasks = []
    paths[tab] = NavigationPath()
    selectedTab = tab
  }

  func present(_ sheet: AppSheet) {
    self.sheet = sheet
  }

  /// Today on the goal that still has work, made the active goal as the goal switcher does; when
  /// that fails, Today on the active goal.
  func openStudyReminder(
    goalID: String, switchGoal: (String) async -> MutationResult<Void>
  ) async {
    _ = await switchGoal(goalID)
    sheet = nil
    popToRoots()
    select(.today)
  }

  func dismissTask() {
    _ = tasks.popLast()
  }

  func popToRoots() {
    tasks = []
    paths = [:]
  }

  /// `keepingPlace` when the place still exists (the window became compact) rather than gone (a
  /// goal switch took it away).
  func leaveStudyTab(keepingPlace: Bool) {
    guard let route = selectedTab.studyRoute else {
      return
    }

    selectedTab = .today

    if keepingPlace {
      paths[.today, default: NavigationPath()].append(route)
    }
  }
}

extension View {
  /// For a sheet's content. SwiftUI holds back a modal the window opens while a sheet is up, and a
  /// push lands under it, so the sheet closes wherever the window goes, and for any place opened
  /// from it, even one the window already shows.
  func closesOnNavigation() -> some View {
    modifier(ClosesOnNavigation())
  }
}

private struct ClosesOnNavigation: ViewModifier {
  @Environment(\.dismiss) private var dismiss
  @Environment(\.tutorPlaces) private var places
  @Environment(AppRouter.self) private var router

  func body(content: Content) -> some View {
    content
      .onChange(of: router.shown) { dismiss() }
      .environment(
        \.tutorPlaces,
        TutorPlaces { place in
          dismiss()
          places.open(place)
        })
  }
}
