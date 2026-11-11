import SwiftUI

extension View {
  /// Main's `useVisibleWait`: each stretch of a wait while it's on screen is one `Generation Waited`,
  /// ended by leaving it, the app going to the background, or the wait turning off. Before the goal
  /// exists, `attemptID` or `onboardingID` names the wait.
  func measuresWait(
    surface: String, contentKind: String, isActive: Bool = true, goalID: String? = nil,
    attemptID: String? = nil, onboardingID: String? = nil
  ) -> some View {
    modifier(
      VisibleWait(
        surface: surface, contentKind: contentKind, isActive: isActive, goalID: goalID,
        attemptID: attemptID, onboardingID: onboardingID))
  }
}

private struct VisibleWait: ViewModifier {
  let surface: String
  let contentKind: String
  let isActive: Bool
  let goalID: String?
  let attemptID: String?
  let onboardingID: String?

  @Environment(\.scenePhase) private var scenePhase
  /// The wait's progress pushed over it is still the wait on screen.
  @Environment(WaitVisit.self) private var visit: WaitVisit?
  @State private var startedAt: Date?
  @State private var isShown = false

  func body(content: Content) -> some View {
    content
      .onAppear {
        isShown = true
        update()
      }
      .onDisappear {
        isShown = false
        update()
      }
      .onChange(of: scenePhase) { update() }
      .onChange(of: isActive) { update() }
      .onChange(of: visit?.showsProgress) { update() }
  }

  private func update() {
    let isOnScreen = isShown || visit?.showsProgress == true
    let counts = isOnScreen && isActive && scenePhase == .active

    if counts {
      startedAt = startedAt ?? .now
      return
    }

    guard let started = startedAt else {
      return
    }

    startedAt = nil
    let ended = Date.now

    if ended > started {
      UsageAnalytics.track(
        .generationWaited(
          AnalyticsEvent.WaitSegment(
            contentKind: contentKind, surface: surface, startedAt: started, endedAt: ended,
            goalID: goalID, attemptID: attemptID, onboardingID: onboardingID)))
    }
  }
}
