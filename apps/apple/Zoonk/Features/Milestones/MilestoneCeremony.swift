import SwiftUI

/// Marks itself as shown when it appears, so it never repeats.
struct MilestoneCeremony: View {
  @Environment(BuddyStore.self) private var buddyStore
  @Environment(LearnerSummaryStore.self) private var learner
  @Environment(StudySessionStore.self) private var sessions
  /// Folding or unfolding draws the stage again; it celebrates only the first time.
  @State private var hasPlayed = false

  let milestone: Milestone
  let onClose: () -> Void

  var body: some View {
    PaneSplit {
      stage
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .scenePadding()
    } secondary: {
      VStack(spacing: 24) {
        Spacer()
        words
        Spacer()
        buttons
      }
      .scenePadding()
    } single: {
      VStack(spacing: 24) {
        Spacer()
        stage
        words
        Spacer()
        buttons
          .keepsOffFold()
      }
      .scenePadding()
    }
    .landsActsOnInput()
    .task(id: milestone.id) {
      if let ceremony = AnalyticsEvent.Ceremony(milestoneKind: milestone.kind) {
        UsageAnalytics.track(.ceremonyShown(ceremony))
      }

      await sessions.markShown(milestone)
    }
  }

  private var stage: some View {
    MilestoneStage(
      milestone: milestone, buddy: learner.summary.value?.buddy ?? BuddyLook(), plays: !hasPlayed
    )
    .onDisappear {
      hasPlayed = true
    }
  }

  private var words: some View {
    VStack(spacing: 8) {
      Text(title)
        .typeStyle(.heroTitle)
        .multilineTextAlignment(.center)
        .accessibilityAddTraits(.isHeader)

      Text(detail)
        .typeStyle(.reading)
        .foregroundStyle(.mutedForeground)
        .multilineTextAlignment(.center)
    }
  }

  /// Main's task actions: "Not now" beside the main action, stacking when they don't fit.
  private var buttons: some View {
    PracticeActionRow {
      if let glasses = newGlasses, let summary = learner.summary.value {
        PracticeSecondaryButton(
          title: LocalizedStringResource(
            "Not now", table: "Session",
            comment: "Closes a glasses ceremony without wearing them"),
          action: onClose)

        PracticeMainButton(
          title: LocalizedStringResource(
            "Wear them", table: "Session",
            comment: "Puts the glasses just earned on the buddy; \"them\" is the glasses")
        ) {
          // The buddy wears them at once; the save finishes after the ceremony closes.
          Task {
            await buddyStore.save(
              BuddyChoice(kind: summary.buddy.kind, name: summary.buddyName, glasses: glasses))
          }
          onClose()
        }
      } else {
        PracticeMainButton(
          title: LocalizedStringResource(
            "Continue", table: "Session", comment: "Closes a milestone's ceremony"),
          action: onClose)
      }
    }
  }

  private var buddy: String {
    learner.buddyDisplayName
  }

  private var newGlasses: BuddyGlasses? {
    milestone.kind == "glasses" ? BuddyGlasses(rawValue: milestone.key) : nil
  }

  private var title: String {
    switch milestone.kind {
    case "belt":
      beltName(milestone.key).map {
        String(localized: "\($0)!", table: "Session", comment: "A new belt's ceremony title")
      } ?? String(localized: "A new belt!", table: "Session", comment: "A new belt's ceremony")
    case "buddyStage":
      String(
        localized: "\(buddy) grew up!", table: "Session", comment: "The buddy's new stage")
    case "glasses":
      glassesTitle
    default:
      String(localized: "A new badge!", table: "Session", comment: "A badge's ceremony")
    }
  }

  private var detail: String {
    switch milestone.kind {
    case "belt":
      String(
        localized: "Your Brain Power earned it.", table: "Session",
        comment: "What earned a new belt")
    case "buddyStage":
      milestone.key == "adult"
        ? String(
          localized: "\(buddy) is an Adult now, fully grown with your Brain Power.",
          table: "Session", comment: "The buddy's last stage")
        : String(
          localized: "\(buddy) is Young now, and keeps growing with your Brain Power.",
          table: "Session", comment: "The buddy's next stage")
    case "glasses":
      glassesDetail
    default:
      ""
    }
  }

  private var glassesTitle: String {
    switch milestone.key {
    case "star": String(localized: "Star glasses!", table: "Session", comment: "Glasses earned")
    case "aviator":
      String(localized: "Aviator glasses!", table: "Session", comment: "Glasses earned")
    case "catEye":
      String(localized: "Cat-eye glasses!", table: "Session", comment: "Glasses earned")
    case "retro": String(localized: "Retro glasses!", table: "Session", comment: "Glasses earned")
    case "monocle": String(localized: "A monocle!", table: "Session", comment: "Glasses earned")
    default: String(localized: "New glasses!", table: "Session", comment: "Glasses earned")
    }
  }

  private var glassesDetail: String {
    switch milestone.key {
    case "star":
      String(
        localized: "For winning your first phase challenge.", table: "Session",
        comment: "What earned the glasses")
    case "aviator":
      String(
        localized: "For finishing your first weekly challenge.", table: "Session",
        comment: "What earned the glasses")
    case "catEye":
      String(
        localized: "For finishing every mission on 7 different days.", table: "Session",
        comment: "What earned the glasses")
    case "retro":
      String(
        localized: "For finishing 50 reviews.", table: "Session",
        comment: "What earned the glasses")
    case "monocle":
      String(
        localized: "For winning the final challenge.", table: "Session",
        comment: "What earned the glasses")
    default:
      String(
        localized: "They come with your buddy.", table: "Session",
        comment: "What earned the glasses")
    }
  }
}

/// Sparks burst only for a belt or a stage, both grown from Brain Power; new glasses come from other
/// achievements, so the buddy shows them off without a burst.
struct MilestoneStage: View {
  @Environment(\.colorScheme) private var colorScheme
  @Environment(\.horizontalSizeClass) private var sizeClass

  let milestone: Milestone
  let buddy: BuddyLook
  var plays = true

  private static let sparks: [Burst.Spark] = [
    .init(size: 13, x: -128, y: -50), .init(size: 10, x: -68, y: -118),
    .init(size: 14, x: 18, y: -136), .init(size: 10, x: 98, y: -96),
    .init(size: 13, x: 136, y: -8), .init(size: 10, x: 104, y: 82),
    .init(size: 12, x: -12, y: 132), .init(size: 10, x: -108, y: 84),
  ]

  private var belt: ProgressBelt? {
    milestone.kind == "belt" ? ProgressBelt(rawValue: milestone.key) : nil
  }

  private var isGlasses: Bool { milestone.kind == "glasses" }

  private var look: BuddyLook {
    var look = buddy

    if let belt {
      look.belt = belt
    }
    if milestone.kind == "buddyStage", let stage = BuddyStage(key: milestone.key) {
      look = look.grown(to: stage)
    }
    if isGlasses, let glasses = BuddyGlasses(rawValue: milestone.key) {
      look.glasses = glasses
    }

    return look
  }

  private var disc: Color {
    guard let belt, belt != .white, belt != .black else { return Color.muted }
    return belt.color.opacity(colorScheme == .dark ? 0.25 : 0.2)
  }

  var body: some View {
    let side: CGFloat = sizeClass == .regular ? 256 : 224

    Circle()
      .fill(disc)
      .aspectRatio(1, contentMode: .fit)
      .overlay {
        if plays, !isGlasses {
          Burst(sparks: Self.sparks, delay: .beat)
        }
      }
      .overlay {
        BuddyCharacter(
          look: look, expression: .happy,
          reaction: plays ? ActReaction(act: isGlasses ? .proud : .cheer, delay: .beat) : nil
        )
        .padding(side * 0.14)
      }
      .frame(maxWidth: side, maxHeight: side)
      .accessibilityHidden(true)
  }
}

extension View {
  /// The certificates a result earned, then its milestone, rarest first: each opens once wherever
  /// it shows, full screen, and is marked shown. A certificate left through See Plus isn't, so it
  /// plays again after the next task.
  func completionMoments(certificates: [CertificateFacts] = [], milestone: Milestone? = nil)
    -> some View
  {
    modifier(
      CompletionMomentsPresenter(
        earned: CompletionMoments(certificates: certificates, milestone: milestone)))
  }

  func completionMoments(_ day: DayResult?) -> some View {
    completionMoments(certificates: day?.certificates ?? [], milestone: day?.ceremony)
  }

  /// A result as the generated client decodes it.
  func completionMoments(
    certificates: [Components.Schemas.OwnedCertificateFacts],
    ceremony: Components.Schemas.Milestone?
  ) -> some View {
    completionMoments(
      certificates: certificates.isEmpty ? [] : (try? StudyJSON.recode(certificates)) ?? [],
      milestone: ceremony.map(Milestone.init))
  }
}

private struct CompletionMoments: Hashable, Identifiable {
  var certificates: [CertificateFacts]
  var milestone: Milestone?

  var id: Self { self }
}

private struct CompletionMomentsPresenter: ViewModifier {
  @Environment(AppRouter.self) private var router
  @Environment(CertificatesStore.self) private var certificates
  @Environment(StudySessionStore.self) private var sessions

  let earned: CompletionMoments

  @State private var shown: CompletionMoments?
  /// A result plays once on its screen, even when the screen appears again.
  @State private var played: CompletionMoments?
  @State private var opensPlus = false

  func body(content: Content) -> some View {
    content
      .onChange(of: earned, initial: true) { _, earned in
        guard earned != played else {
          return
        }

        played = earned
        let new = CompletionMoments(
          certificates: certificates.claimMoments(earned.certificates),
          milestone: earned.milestone.flatMap { sessions.claimCeremony($0) ? $0 : nil })

        if !new.certificates.isEmpty || new.milestone != nil {
          shown = new
        }
      }
      // Plus opens once the moment is gone: a screen under a cover can't present.
      .fullScreenCover(item: $shown, onDismiss: openPlus) { moments in
        CompletionMomentsView(
          moments: moments,
          onSeePlus: {
            opensPlus = true
            shown = nil
          },
          onClose: { shown = nil }
        )
        .zoonkStyles()
      }
  }

  private func openPlus() {
    guard opensPlus else {
      return
    }

    opensPlus = false
    router.present(.subscription)
  }
}

private struct CompletionMomentsView: View {
  @State private var certificatesClosed = false

  let moments: CompletionMoments
  let onSeePlus: () -> Void
  let onClose: () -> Void

  var body: some View {
    if !moments.certificates.isEmpty, !certificatesClosed {
      CertificateCeremony(certificates: moments.certificates, onSeePlus: onSeePlus) {
        if moments.milestone == nil {
          onClose()
        } else {
          certificatesClosed = true
        }
      }
    } else if let milestone = moments.milestone {
      MilestoneCeremony(milestone: milestone, onClose: onClose)
    }
  }
}
