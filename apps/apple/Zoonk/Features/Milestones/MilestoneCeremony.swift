import SwiftUI

/// The artwork a ceremony shows for its milestone. The characters' lane provides the buddy and
/// belt art; until then the ceremony draws the milestone's SF Symbol.
struct MilestoneArtwork: Sendable {
  let view: (@MainActor @Sendable (Milestone) -> AnyView)?

  static let symbol = MilestoneArtwork(view: nil)
}

extension EnvironmentValues {
  @Entry var milestoneArtwork = MilestoneArtwork.symbol
}

/// A milestone's full-screen moment, shown once over the result that earned it: its art, a title
/// and one line on what earned it, and one button. It marks itself as shown when it appears, so it
/// never repeats; its one motion is the art landing, and none with Reduce Motion.
struct MilestoneCeremony: View {
  @Environment(\.accessibilityReduceMotion) private var reduceMotion
  @Environment(\.milestoneArtwork) private var artwork
  @Environment(LearnerSummaryStore.self) private var learner
  @Environment(StudySessionStore.self) private var sessions

  let milestone: Milestone
  let onClose: () -> Void

  @State private var landed = false

  var body: some View {
    VStack(spacing: 24) {
      Spacer()

      Group {
        if let view = artwork.view {
          view(milestone)
        } else {
          Image(systemName: symbol)
            .font(.system(.largeTitle))
            .imageScale(.large)
            .foregroundStyle(.brain)
            .symbolEffect(.bounce, options: .nonRepeating, value: landed)
        }
      }
      .accessibilityHidden(true)

      VStack(spacing: 8) {
        Text(title)
          .font(.title.bold())
          .multilineTextAlignment(.center)
          .accessibilityAddTraits(.isHeader)

        Text(detail)
          .font(.body)
          .foregroundStyle(.secondary)
          .multilineTextAlignment(.center)
      }

      Spacer()

      Button(action: onClose) {
        Text("Continue", tableName: "Session", comment: "Closes a milestone's ceremony")
          .frame(maxWidth: .infinity)
      }
      .buttonStyle(.mainAction)
      .controlSize(.large)
    }
    .scenePadding()
    .task(id: milestone.id) {
      if !reduceMotion {
        landed = true
      }

      await sessions.markShown(milestone)
    }
  }

  private var buddy: String {
    learner.summary.value?.buddyName ?? "Zu"
  }

  private var symbol: String {
    switch milestone.kind {
    case "belt": "figure.martial.arts"
    case "glasses": "eyeglasses"
    case "buddyStage": "sparkles"
    default: "rosette"
    }
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

extension View {
  /// Opens a result's milestone ceremony full screen, once per milestone wherever it shows (a
  /// block's moment, the summary, a call's or a round's result), and marks it shown.
  func milestoneCeremony(_ milestone: Milestone?) -> some View {
    modifier(MilestoneCeremonyPresenter(milestone: milestone))
  }
}

private struct MilestoneCeremonyPresenter: ViewModifier {
  @Environment(StudySessionStore.self) private var sessions

  let milestone: Milestone?

  @State private var shown: Milestone?

  func body(content: Content) -> some View {
    content
      .onChange(of: milestone, initial: true) { _, milestone in
        if let milestone, sessions.claimCeremony(milestone) {
          shown = milestone
        }
      }
      .fullScreenCover(item: $shown) { milestone in
        MilestoneCeremony(milestone: milestone) {
          shown = nil
        }
      }
  }
}
