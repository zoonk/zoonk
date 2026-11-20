import SwiftUI

// The target's default actor isolation stays nonisolated: under MainActor, every model's Codable
// and Hashable conformance becomes main-actor isolated and can't satisfy a Sendable generic
// parameter (https://docs.swift.org/compiler/documentation/diagnostics/isolated-conformances).
@main
struct ZoonkApp: App {
  @UIApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate
  /// The stores live as long as the app, whatever happens to its windows.
  @State private var dependencies: AppDependencies
  #if DEBUG
    private let uiTestFixtureFailure: String?
  #endif

  init() {
    ErrorReporting.start()

    // On its light capsule the system draws the current page white and the others gray, so the
    // dot that stands out is the wrong one. Main's step dots show the current step in the text
    // color.
    UIPageControl.appearance().currentPageIndicatorTintColor = .label
    UIPageControl.appearance().pageIndicatorTintColor = .tertiaryLabel

    #if DEBUG
      let configuration = UITestConfiguration.current
      let dependencies = configuration?.dependencies ?? .live()
      uiTestFixtureFailure = configuration?.fixtureFailure
    #else
      let dependencies = AppDependencies.live()
    #endif

    _dependencies = State(initialValue: dependencies)
  }

  var body: some Scene {
    WindowGroup {
      AppWindow(today: dependencies.todayStore)
        #if DEBUG
          .modifier(UITestFixtureFailureCover(failure: uiTestFixtureFailure))
        #endif
        .loads(dependencies.learnerSummaryStore.summary, refreshable: false)
        .usageAnalytics()
        .task(id: dependencies.learnerSummaryStore.summary.value?.nextChangeAt) {
          await dependencies.learnerSummaryStore.refreshAtNextChange()
        }
        .onChange(of: dependencies.sessionStore.authenticatedSession) {
          dependencies.cache.followSession()
        }
        .appDependencies(dependencies)
        .zoonkStyles()
    }
  }
}

private struct AppWindow: View {
  @Environment(LearnerSummaryStore.self) private var learner
  @Environment(PushNotifications.self) private var notifications
  @Environment(SessionStore.self) private var session
  @Environment(VoiceServices.self) private var voice
  @State private var router: AppRouter
  @SceneStorage(TestOutScreen.openResultKey) private var openTestOutResult: URL?
  @State private var restoresTestOutResult = true

  init(today: TodayStore) {
    _router = State(initialValue: AppRouter(openBlock: AppRouter.openingTodayBlocks(today: today)))
  }

  var body: some View {
    AppView()
      #if DEBUG
        .modifier(DebugLaunch())
        // Inside the app's environment, so the gallery's screens get the app's renderers.
        .modifier(ActivityGalleryLaunch())
        .modifier(DebugCharacterGallery())
        .modifier(DebugComponentGallery())
      #endif
      // Made from the router the window keeps: `init` runs again on every update of the app.
      .environment(router)
      .environment(\.lessonPlayerRoutes, .routed(by: router))
      .environment(\.practiceHooks, .routed(by: router, voice: voice))
      .environment(\.tutorPlaces, .routed(by: router))
      .onOpenURL { url in
        if !router.open(url: url) {
          session.handleGoogleSignInURL(url)
        }
      }
      .onChange(of: notifications.openedGoalID, initial: true) {
        if let goalID = notifications.takeOpenedGoal() {
          Task {
            await router.openStudyReminder(goalID: goalID) { await learner.switchGoal(to: $0) }
          }
        }
      }
      // Once the saved sign-in is checked, so the result only reopens for a learner it can load for;
      // a check that couldn't reach the server keeps it for the next one.
      .onChange(of: session.state, initial: true) { _, state in
        guard restoresTestOutResult else {
          return
        }

        switch state {
        case .signedIn:
          restoresTestOutResult = false

          if let openTestOutResult {
            router.open(url: openTestOutResult)
          }
        case .signedOut:
          restoresTestOutResult = false
          openTestOutResult = nil
        case .restoring, .unavailable:
          break
        }
      }
  }
}
