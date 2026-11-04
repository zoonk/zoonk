import SwiftUI

struct AppTabView: View {
  @Environment(AppRouter.self) private var router
  @Environment(LearnerSummaryStore.self) private var learner
  @Environment(SessionStore.self) private var session
  @State private var tabBarPlacement: TabBarPlacement?
  @State private var guestID: String?

  var body: some View {
    tabs
      .landsActsOnInput()
      .environment(\.isCoveredByTask, !router.tasks.isEmpty)
      .fullScreenCover(item: router.task(at: 0)) { route in
        PresentedTask(route: route, depth: 0)
      }
      .sheet(item: router.sheet(presentedBy: 0)) { sheet in
        AppSheetView(sheet: sheet)
      }
      .onChange(of: session.account?.user.id) { previous, current in
        // Signing in keeps a visitor's place, and a guest's: their plan and progress move to the
        // account.
        if previous != nil, previous != current, previous != guestID {
          router.popToRoots()
        }
      }
      .onChange(of: learner.summary.value?.identity, initial: true) { _, identity in
        if let identity {
          guestID = identity.isAnonymous ? identity.userID : nil
        }
      }
      .onChange(of: isStudyShown) {
        if !isStudyShown {
          router.leaveStudyTab(keepingPlace: true)
        }
      }
      .onChange(of: studyTabs) {
        if router.selectedTab.studyRoute != nil, !studyTabs.contains(router.selectedTab) {
          router.leaveStudyTab(keepingPlace: false)
        }
      }
  }

  private var tabs: some View {
    @Bindable var router = router

    return TabView(selection: $router.selectedTab) {
      Tab(value: AppTab.today) {
        TabRoot(tab: .today, tabBarPlacement: $tabBarPlacement)
      } label: {
        TabLabel(tab: .today)
      }
      // Main counts the day's activities left in the sidebar only, quietly; a tab bar would
      // show it as an alert.
      .badge(tabBarPlacement == .sidebar ? learner.summary.value?.todayBlocksLeft ?? 0 : 0)

      Tab(value: AppTab.plan) {
        TabRoot(tab: .plan, tabBarPlacement: $tabBarPlacement)
      } label: {
        TabLabel(tab: .plan)
      }

      Tab(value: AppTab.buddy) {
        TabRoot(tab: .buddy, tabBarPlacement: $tabBarPlacement)
      } label: {
        Label {
          if let name = learner.summary.value?.buddyDisplayName {
            Text(name)
          } else {
            Text(AppTab.buddy.title)
          }
        } icon: {
          BuddyTabIcon()
        }
      }

      Tab(value: AppTab.search, role: .search) {
        TabRoot(tab: .search, tabBarPlacement: $tabBarPlacement)
      }

      if isStudyShown {
        TabSection {
          ForEach(studyTabs, id: \.self) { tab in
            Tab(value: tab) {
              TabRoot(tab: tab, tabBarPlacement: $tabBarPlacement)
            } label: {
              TabLabel(tab: tab)
            }
            .badge(tab == .mistakes ? learner.summary.value?.places.readyMistakes ?? 0 : 0)
          }
        } header: {
          Text("Study", tableName: "Navigation", comment: "Sidebar section with the study places")
        }
        .defaultVisibility(.hidden, for: .tabBar)
      }
    }
    // No `defaultTabBarPlacement(.sidebar)`: on the open iPhone Duo a sidebar would take the room
    // its two panes need.
    .tabViewStyle(.sidebarAdaptable)
    .tabViewSidebarBottomBar {
      Button {
        router.present(.feedback(screen: "sidebar"))
      } label: {
        Label {
          Text(
            "Send feedback", tableName: "Navigation",
            comment: "Sidebar button that opens the form to write to Zoonk")
        } icon: {
          Image(systemName: "bubble.left")
        }
      }
    }
  }

  private var isStudyShown: Bool {
    tabBarPlacement?.listsStudyPlaces == true
  }

  private var studyTabs: [AppTab] {
    let places = learner.summary.value?.places

    return AppTab.study.filter { tab in
      switch tab {
      case .exam: places?.exam == true
      case .speaking: places?.speaking == true
      case .mindMaps: places?.mindMaps == true
      case .completedLessons: places?.completedLessons == true
      default: true
      }
    }
  }
}

private struct TabLabel: View {
  let tab: AppTab

  var body: some View {
    Label {
      Text(tab.title)
    } icon: {
      Image(systemName: tab.systemImage)
    }
  }
}

/// Main's buddy tab: the buddy's face in today's missions ring. A tab item takes only an image, so
/// the face is drawn into one, in the tab bar's color scheme.
private struct BuddyTabIcon: View {
  @Environment(LearnerSummaryStore.self) private var learner
  @Environment(TodayStore.self) private var today
  @Environment(\.colorScheme) private var colorScheme
  @Environment(\.displayScale) private var displayScale

  var body: some View {
    if let image = rendered {
      Image(uiImage: image)
    } else {
      Image(systemName: AppTab.buddy.systemImage)
    }
  }

  private var rendered: UIImage? {
    let missions =
      if case .day(let view) = today.today.value { view.session.missions } else { [StudyMission]() }

    let renderer = ImageRenderer(
      content: MissionsRing(done: missions.count(where: \.isDone), total: missions.count) {
        BuddyCharacter(
          look: learner.summary.value?.buddy ?? BuddyLook(), expression: .happy, crop: .face
        )
        .frame(width: 22, height: 22)
      }
      .environment(\.colorScheme, colorScheme))
    renderer.scale = displayScale

    return renderer.uiImage?.withRenderingMode(.alwaysOriginal)
  }
}

private struct TabRoot: View {
  @Environment(\.tabBarPlacement) private var placement
  @Environment(AppRouter.self) private var router

  let tab: AppTab
  /// Only a tab's content can read where the tabs show.
  @Binding var tabBarPlacement: TabBarPlacement?

  var body: some View {
    NavigationStack(path: router.path(for: tab)) {
      tab.root
        .modifier(ShellToolbar(isShown: tab != .search))
        .navigationDestination(for: AppRoute.self) { route in
          route.destination
        }
    }
    .onChange(of: placement, initial: true) {
      tabBarPlacement = placement
    }
  }
}

struct AppSheetView: View {
  let sheet: AppSheet

  var body: some View {
    Group {
      switch sheet {
      case .account(let page):
        AccountSheet(page: page)
      case .feedback(let screen):
        FeedbackSheet(api: FeedbackAPI.live(), context: FeedbackContext(screen: screen))
      case .signIn:
        AccountSheet(signsIn: true)
      case .subscription:
        SubscriptionScreen()
      }
    }
    .zoonkStyles()
  }
}
