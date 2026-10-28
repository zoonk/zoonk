import Observation
import SwiftUI

/// App-wide sheets: the account (sign in, settings hub), sign-in on its own (where a visitor or a
/// guest is asked to log in or create an account; it closes once they have), and the Plus
/// subscription a lock opens.
enum AppSheet: Hashable, Identifiable {
  case account
  case signIn
  case subscription

  var id: Self { self }
}

/// The shell's navigation state: the selected tab, one stack per tab (kept across tab switches),
/// the full-screen tasks on top of them, and the app-wide sheet. Features navigate only through
/// `open(_:)`, `select(_:)`, `present(_:)` and `dismissTask()`.
@MainActor
@Observable
final class AppRouter {
  var selectedTab: AppTab
  var sheet: AppSheet?
  private(set) var tasks: [AppRoute] = [] {
    didSet {
      // A task opened beneath another comes into sight once nothing covers it.
      hiddenTasks = hiddenTasks.filter { tasks.count > $0 + 1 }
    }
  }
  /// The depths of tasks opened beneath the task the learner asked for (see `open(_:over:)`).
  private var hiddenTasks: Set<Int> = []
  private var paths: [AppTab: NavigationPath] = [:]

  init(selectedTab: AppTab = .today, sheet: AppSheet? = nil) {
    self.selectedTab = selectedTab
    self.sheet = sheet
  }

  func path(for tab: AppTab) -> Binding<NavigationPath> {
    Binding(
      get: { self.paths[tab] ?? NavigationPath() },
      set: { self.paths[tab] = $0 })
  }

  /// The task at `depth` in the stack of full-screen covers; clearing it closes it and the ones
  /// it opened.
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

  /// The app sheet as one presentation layer sees it: the tabs are layer 0 and each task the next.
  /// Only the topmost layer shows it, since a view already covered by a task can't present.
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

  /// Covers everything with a task, or pushes a page on the selected tab after closing any task,
  /// so a lesson's "See the plan" lands on the stack. A Study place already selected in the
  /// sidebar goes back to its root instead of stacking itself again.
  func open(_ route: AppRoute) {
    switch route.presentation {
    case .task:
      tasks.append(route)
    case .push:
      tasks = []

      if route.studyTab == selectedTab {
        paths[selectedTab] = NavigationPath()
      } else {
        paths[selectedTab, default: NavigationPath()].append(route)
      }
    }
  }

  /// Opens `route` with `beneath` under it as one transition: `beneath` takes its place at once and
  /// out of sight, so the learner sees only `route` come in, and closing `route` shows `beneath`
  /// where it was, such as a lesson over the session that goes on after it.
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

  /// Whether the task at `depth` waits out of sight under the task it was opened beneath.
  func isHidden(taskAt depth: Int) -> Bool {
    hiddenTasks.contains(depth)
  }

  /// Opens a link to one of main's pages; false when the app has no place for it.
  @discardableResult
  func open(url: URL) -> Bool {
    switch AppLink(url: url) {
    case .tab(let tab):
      showRoot(of: tab)
      return true
    case .route(let route):
      open(route)
      return true
    case nil:
      return false
    }
  }

  /// Shows a tab at its root, closing any task: where "Start free" and "Start a goal" lead.
  func showRoot(of tab: AppTab) {
    tasks = []
    paths[tab] = NavigationPath()
    selectedTab = tab
  }

  func present(_ sheet: AppSheet) {
    self.sheet = sheet
  }

  /// Closes the top task; nothing when a learner already closed it (or a session change did).
  func dismissTask() {
    _ = tasks.popLast()
  }

  /// Drops every pushed page and task, for a goal switch or a different learner: what they
  /// showed belonged to the previous goal or account.
  func popToRoots() {
    tasks = []
    paths = [:]
  }

  /// Leaves a Study place the sidebar showed once it can't stay selected: on Today, with the
  /// place pushed when it still exists (the window became compact) rather than gone (a goal
  /// switch took it away).
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
