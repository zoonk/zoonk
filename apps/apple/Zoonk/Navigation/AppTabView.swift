import SwiftUI

/// The app's frame, main's learn frame natively: Today, Plan, the buddy and search as tabs, which
/// become a sidebar with the Study places where there's room. Each tab keeps its own stack; tasks
/// cover everything, and the account and subscription open as sheets.
struct AppTabView: View {
  @Environment(AppRouter.self) private var router
  @Environment(LearnerSummaryStore.self) private var learner
  @Environment(SessionStore.self) private var session
  @State private var tabBarPlacement: TabBarPlacement?

  var body: some View {
    @Bindable var router = router

    TabView(selection: $router.selectedTab) {
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
        if let name = learner.summary.value?.buddyName {
          Label(name, systemImage: AppTab.buddy.systemImage)
        } else {
          TabLabel(tab: .buddy)
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
    .tabViewStyle(.sidebarAdaptable)
    .fullScreenCover(item: router.task(at: 0)) { route in
      PresentedTask(route: route, depth: 0)
    }
    .sheet(item: router.sheet(presentedBy: 0)) { sheet in
      AppSheetView(sheet: sheet)
    }
    .onChange(of: session.account?.user.id) { previous, current in
      // A learner's pages and tasks end with their session (signed out, expired or another
      // account), so nothing is left loading for someone who can't read it. Signing in keeps
      // the visitor's place.
      if previous != nil, previous != current {
        router.popToRoots()
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

  /// The Study places live in the sidebar (and as one "Study" item in a top bar); a bottom tab
  /// bar has no room for them, so phones and compact windows reach them as pushes.
  private var isStudyShown: Bool {
    tabBarPlacement != nil && tabBarPlacement != .bottomBar
  }

  /// Main's Study shortcuts: the notebook and statistics always, the rest where the goal has them.
  private var studyTabs: [AppTab] {
    let places = learner.summary.value?.places

    return AppTab.study.filter { tab in
      switch tab {
      case .exam: places?.exam == true
      case .speaking: places?.speaking == true
      case .mindMaps: places?.mindMaps == true
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

/// One tab's stack, kept by the router across tab switches, with the shell's bar on its root.
private struct TabRoot: View {
  @Environment(\.tabBarPlacement) private var placement
  @Environment(AppRouter.self) private var router

  let tab: AppTab
  /// Where the tabs show (a bar or the sidebar), which only a tab's content can read.
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
  @Environment(SessionStore.self) private var session

  let sheet: AppSheet

  var body: some View {
    switch sheet {
    case .account:
      AccountSheet()
    case .subscription:
      if let account = session.account, let appAccountToken = UUID(uuidString: account.user.id) {
        NavigationStack {
          SubscriptionView(appAccountToken: appAccountToken)
        }
      } else {
        AccountSheet()
      }
    }
  }
}
