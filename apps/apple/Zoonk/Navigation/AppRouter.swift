import Observation
import SwiftUI

enum AppSheet: Hashable, Identifiable {
  case account
  case signIn
  case subscription

  var id: Self { self }
}

@MainActor
@Observable
final class AppRouter {
  var selectedTab: AppTab
  var sheet: AppSheet?
  private(set) var tasks: [AppRoute] = [] {
    didSet {
      hiddenTasks = hiddenTasks.filter { tasks.count > $0 + 1 }
    }
  }
  private var hiddenTasks: Set<Int> = []
  private var paths: [AppTab: NavigationPath] = [:]
  let playback = SessionPlayback()
  @ObservationIgnored private let openBlock: BlockOpener

  typealias BlockOpener = @MainActor (_ blockID: String, _ router: AppRouter) -> Void

  init(
    selectedTab: AppTab = .today, sheet: AppSheet? = nil,
    openBlock: @escaping BlockOpener = { _, _ in }
  ) {
    self.selectedTab = selectedTab
    self.sheet = sheet
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
  /// root instead of stacking itself again.
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
      open(blockID: blockID)
      return true
    case nil:
      return false
    }
  }

  func open(blockID: String) {
    openBlock(blockID, self)
  }

  func showRoot(of tab: AppTab) {
    tasks = []
    paths[tab] = NavigationPath()
    selectedTab = tab
  }

  func present(_ sheet: AppSheet) {
    self.sheet = sheet
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
