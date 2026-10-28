import SwiftUI

/// A milestone's full-screen moment, shown once over the result that earned it: the buddy on its
/// stage, a title and one line on what earned it, and one button; new glasses can go on the buddy
/// right away, or not now. It marks itself as shown when it appears, so it never repeats; the buddy
/// acts it out once, and only changes its face with Reduce Motion. On a spread the buddy has the
/// leading page and the words and buttons the trailing one.
struct MilestoneCeremony: View {
  @Environment(BuddyStore.self) private var buddyStore
  @Environment(LearnerSummaryStore.self) private var learner
  @Environment(StudySessionStore.self) private var sessions

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
    .task(id: milestone.id) {
      await sessions.markShown(milestone)
    }
  }

  private var stage: some View {
    MilestoneStage(milestone: milestone, buddy: learner.summary.value?.buddy ?? BuddyLook())
  }

  private var words: some View {
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
  }

  private var buttons: some View {
    VStack(spacing: 24) {
      if let glasses = newGlasses, let summary = learner.summary.value {
        Button {
          // The buddy wears them at once; the save finishes after the ceremony closes.
          Task {
            await buddyStore.save(
              BuddyChoice(kind: summary.buddy.kind, name: summary.buddyName, glasses: glasses))
          }
          onClose()
        } label: {
          Text(
            "Wear them", tableName: "Session", comment: "Puts the glasses just earned on the buddy"
          )
          .frame(maxWidth: .infinity)
        }
        .buttonStyle(.mainAction)
        .controlSize(.large)

        Button(action: onClose) {
          Text(
            "Not now", tableName: "Session",
            comment: "Closes a glasses ceremony without wearing them"
          )
          .frame(maxWidth: .infinity)
        }
        .buttonStyle(.bordered)
        .controlSize(.large)
      } else {
        Button(action: onClose) {
          Text("Continue", tableName: "Session", comment: "Closes a milestone's ceremony")
            .frame(maxWidth: .infinity)
        }
        .buttonStyle(.mainAction)
        .controlSize(.large)
      }
    }
  }

  private var buddy: String {
    learner.buddyDisplayName
  }

  /// The glasses a glasses milestone earned, which the learner can put on the buddy right away.
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

/// The ceremony's picture (main's `CeremonyArt`): the buddy large on its stage, a disc in the new
/// belt's color (soft, and the quiet fill for a stage, glasses, or a white or black belt that would
/// vanish), wearing what changed. For a belt or a stage, both grown from Brain Power, violet sparks
/// burst from behind it and it cheers with its whole body a beat in; new glasses come from other
/// achievements, so it shows them off, proud, without a burst. Decorative: the title says it.
struct MilestoneStage: View {
  @Environment(\.colorScheme) private var colorScheme
  @Environment(\.horizontalSizeClass) private var sizeClass

  let milestone: Milestone
  let buddy: BuddyLook

  /// Sparks fly from behind the buddy past the disc's edge, so they show around it.
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

  /// The buddy wearing what changed: the new belt, the stage it grew to, or the new glasses.
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
    guard let belt, belt != .white, belt != .black else { return Color(.tertiarySystemFill) }
    return belt.color.opacity(colorScheme == .dark ? 0.25 : 0.2)
  }

  var body: some View {
    let side: CGFloat = sizeClass == .regular ? 256 : 224

    Circle()
      .fill(disc)
      .aspectRatio(1, contentMode: .fit)
      .overlay {
        if !isGlasses {
          Burst(sparks: Self.sparks, delay: .beat)
        }
      }
      .overlay {
        BuddyCharacter(
          look: look, expression: .happy,
          reaction: ActReaction(act: isGlasses ? .proud : .cheer, delay: .beat)
        )
        .padding(side * 0.14)
      }
      .frame(maxWidth: side, maxHeight: side)
      .accessibilityHidden(true)
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
