import Observation
import SwiftUI

enum AppSheet: Hashable, Identifiable {
  case account(AccountPage? = nil)
  case feedback(screen: String)
  case makeRoom(LearnerWaitingGoal)
  case signIn
  case subscription
  /// Over the screen, above its panes, so a resize never takes it away.
  case practiceCall(Components.Schemas.TutorToolOffer.Case4Payload)
  /// The buddy's panel an Ask button opens, over the screen for the same reason.
  case tutor(TutorScope, quote: String?)

  var id: Self { self }
}

@MainActor
@Observable
final class AppRouter {
  var selectedTab = AppTab.today
  /// The places the window's sidebar lists, where opening one marks its own row (main's
  /// `getActiveTab`); none where the window has no sidebar. A place opened before the sidebar listed
  /// it, such as by a link the app starts with, moves to its own row once it does, under whatever
  /// task is open over it.
  var sidebarTabs: Set<AppTab> = [] {
    didSet {
      moveListedPlaceToItsRow()
    }
  }
  var sheet: AppSheet?
  /// The speaking paper's open task in this window, as main's `/speaking?task=`.
  var speakingTask: String?
  private(set) var tasks: [AppRoute] = [] {
    didSet {
      hiddenTasks = hiddenTasks.filter { tasks.count > $0 + 1 }
    }
  }
  private var hiddenTasks: Set<Int> = []
  private var stacks: [AppTab: TabStack] = [:]
  let playback = SessionPlayback()
  @ObservationIgnored private let openBlock: BlockOpener

  typealias BlockOpener =
    @MainActor (_ blockID: String, _ router: AppRouter) async -> MutationResult<StudyDestination>

  init(openBlock: @escaping BlockOpener = { _, _ in .obsolete }) {
    self.openBlock = openBlock
  }

  func path(for tab: AppTab) -> Binding<NavigationPath> {
    Binding(
      get: { self.stacks[tab]?.path ?? NavigationPath() },
      set: { self.stacks[tab, default: TabStack()].show($0) })
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

  /// A push closes any task first. A place the sidebar lists opens at its own row's root, and a
  /// route already on the stack, or a task already open, is gone back to, instead of stacking
  /// itself again.
  func open(_ route: AppRoute) {
    switch route.presentation {
    case .task:
      if let depth = tasks.lastIndex(of: route) {
        task(at: depth + 1).wrappedValue = nil
      } else {
        tasks.append(route)
      }
    case .push:
      if let tab = route.sidebarTab, sidebarTabs.contains(tab) {
        showRoot(of: tab)
        return
      }

      tasks = []

      var stack = stacks[selectedTab] ?? TabStack()

      if route.studyTab == selectedTab {
        stack = TabStack()
      } else if let depth = Self.depth(of: route, in: stack.path) {
        stack.removeLast(stack.path.count - depth)
      } else {
        stack.append(route)
      }

      stacks[selectedTab] = stack
    }
  }

  /// A value the selected tab's own `navigationDestination` shows.
  func push(_ value: some Hashable) {
    stacks[selectedTab, default: TabStack()].push(value)
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

  /// Changes whenever the window goes somewhere: another tab, task, pushed screen or sheet. A
  /// sidebar place, with the pages over it, is on its own row and pushed on the tab it was opened
  /// from, so a resize that moves it between them goes nowhere.
  var shown: Shown {
    let stack = stacks[selectedTab] ?? TabStack()
    let page: Shown.Page =
      if let listed = Self.listedPlace(of: selectedTab, stack: stack) {
        .place(listed.place, listed.above)
      } else {
        .stack(selectedTab, stack.path)
      }

    return Shown(page: page, tasks: tasks, sheet: sheet)
  }

  struct Shown: Equatable {
    enum Page: Equatable {
      case place(AppTab, [AppRoute])
      case stack(AppTab, NavigationPath)
    }

    let page: Page
    let tasks: [AppRoute]
    let sheet: AppSheet?
  }

  /// The sidebar place a tab shows, with the pages over it: the tab itself, or the last place on its
  /// stack.
  private static func listedPlace(
    of tab: AppTab, stack: TabStack
  ) -> (place: AppTab, above: [AppRoute])? {
    if tab.studyRoute != nil {
      return stack.routes.map { (tab, $0) }
    }

    let places = AppTab.sidebarPlaces.compactMap(\.studyRoute) + [.statistics()]

    if let index = stack.top.lastIndex(where: { places.contains($0) }) {
      return stack.top[index].sidebarTab.map { ($0, Array(stack.top[(index + 1)...])) }
    }

    // A place a link pushed, which the stack doesn't know.
    guard !stack.path.isEmpty else {
      return nil
    }

    var below = stack.path
    below.removeLast()

    let place = places.first { route in
      var candidate = below
      candidate.append(route)
      return candidate == stack.path
    }

    return place?.sidebarTab.map { ($0, []) }
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
    stacks[tab] = TabStack()
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
    stacks = [:]
  }

  private func moveListedPlaceToItsRow() {
    guard selectedTab.studyRoute == nil, var stack = stacks[selectedTab] else {
      return
    }

    if let (tab, above) = Self.listedPlace(of: selectedTab, stack: stack), sidebarTabs.contains(tab)
    {
      stack.removeLast(above.count + 1)
      stacks[selectedTab] = stack
      stacks[tab] = TabStack(above)
      selectedTab = tab
    }
  }

  /// `keepingPlace` when the place still exists (the window became compact) rather than gone (a
  /// goal switch took it away).
  func leaveStudyTab(keepingPlace: Bool) {
    guard let route = selectedTab.studyRoute else {
      return
    }

    let above = stacks.removeValue(forKey: selectedTab)?.routes ?? []
    selectedTab = .today

    if keepingPlace {
      for page in [route] + above {
        stacks[.today, default: TabStack()].append(page)
      }
    }
  }
}

/// A tab's pushed pages. `NavigationPath` doesn't show its elements, so the routes the router pushed
/// on top are kept beside it, for a resize to carry a sidebar place's pages to Today and back.
struct TabStack: Equatable {
  private(set) var path = NavigationPath()
  /// The routes at the top of `path`, as far down as they're known.
  private(set) var top: [AppRoute] = []

  init(_ routes: [AppRoute] = []) {
    path = NavigationPath(routes)
    top = routes
  }

  /// Every page on it, when each is known.
  var routes: [AppRoute]? {
    top.count == path.count ? top : nil
  }

  mutating func append(_ route: AppRoute) {
    path.append(route)
    top.append(route)
  }

  mutating func push(_ value: some Hashable) {
    path.append(value)
    top = []
  }

  mutating func removeLast(_ count: Int) {
    path.removeLast(count)
    top.removeLast(min(count, top.count))
  }

  /// The path the stack shows after its own back and links: going back keeps what's known below.
  mutating func show(_ shown: NavigationPath) {
    var kept = self

    if shown.count <= path.count {
      kept.removeLast(path.count - shown.count)
    }

    top = kept.path == shown ? kept.top : []
    path = shown
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
