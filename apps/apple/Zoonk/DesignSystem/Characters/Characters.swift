import SwiftUI

/// The learner's buddy (main's `Buddy` and `BuddyActor`): Zu, Noodle, Beep or Otto, grown by its
/// belt, in its glasses, its face from its Energy unless `expression` says otherwise. It holds
/// still wherever it only illustrates a screen; where the learner's work just did something, a
/// `reaction` makes it act once with its parts (a smile, a cheer, pride), and a `cue` makes it act
/// on each change (a glance at a message). `crop: .face` frames only the face, for icon sizes.
/// It's decorative: the words beside it say who it is and what happened.
///
/// ```swift
/// BuddyCharacter(look: look, expression: .happy, reaction: ActReaction(act: .cheer, delay: .beat))
/// ```
struct BuddyCharacter: View {
  let look: BuddyLook
  var expression: BuddyExpression?
  var crop = BuddyArt.Crop.whole
  var reaction: ActReaction<BuddyAct>?
  var cue: ActCue<BuddyAct>?

  var body: some View {
    CharacterActor(
      art: BuddyArt(look: look, crop: crop), expression: expression ?? look.everydayExpression,
      reaction: reaction, cue: cue)
  }
}

/// The Trickster as a challenge's art (main's `TricksterArt`), holding his "?" sign until he's
/// beaten. Where something just happened (`reacts`: the challenge opened, or its result came in)
/// he acts it out a beat in, once: smug while he holds his sign, his defeat once he's beaten. A
/// revisit passes no `reacts`, and he's still, sly or defeated. A `cue` makes him act at each
/// answer of a duel.
struct TricksterCharacter: View {
  var beaten = false
  var reacts = false
  var cue: ActCue<TricksterAct>?

  var body: some View {
    CharacterActor(
      art: TricksterArt(holdsSign: !beaten), expression: beaten && !reacts ? .defeated : .sly,
      reaction: reacts ? ActReaction(act: beaten ? .defeat : .smug, delay: .beat) : nil,
      cue: cue)
  }
}

/// The rarest moments' burst (main's `Burst`): a few sparks fly out of one point once and fade, in
/// the moment's color (Brain Power's for a belt or the buddy's next stage). Put it in an overlay
/// centered on that point; it draws past its frame. Decorative, and gone with Reduce Motion.
struct Burst: View {
  /// A spark's size and where it flies, in points from the burst's point.
  struct Spark: Sendable {
    let size: Double
    let x: Double
    let y: Double
  }

  /// Eight sparks around the point, near and far in turn, a little lopsided as a real burst is.
  static let near: [Spark] = [
    Spark(size: 9, x: -38, y: -14), Spark(size: 7, x: -18, y: -32), Spark(size: 10, x: 8, y: -36),
    Spark(size: 7, x: 32, y: -24), Spark(size: 9, x: 44, y: 2), Spark(size: 6, x: 30, y: 24),
    Spark(size: 8, x: -6, y: 30), Spark(size: 6, x: -34, y: 18),
  ]

  var sparks = Burst.near
  var color = Color.brain
  /// Seconds before the sparks fly: the moment's last beat.
  var delay: TimeInterval = 0

  @Environment(\.accessibilityReduceMotion) private var reduceMotion
  @State private var start: Date?
  @State private var done = false

  /// The sparks' time out and gone (main's `duration-burst`).
  private let duration: TimeInterval = 0.75

  var body: some View {
    let reach = sparks.map { max(abs($0.x), abs($0.y)) * 1.25 + $0.size }.max() ?? 0

    if !reduceMotion, !done {
      TimelineView(.animation(paused: start == nil)) { timeline in
        Canvas { context, size in
          guard let start else { return }
          draw(in: context, size: size, progress: timeline.date.timeIntervalSince(start) / duration)
        }
      }
      .frame(width: reach * 2, height: reach * 2)
      .allowsHitTesting(false)
      .accessibilityHidden(true)
      .task {
        start = .now.addingTimeInterval(delay)
        try? await Task.sleep(for: .seconds(delay + duration))
        done = true
      }
    }
  }

  /// Each spark flies out to its point in the first half, at full strength, and drifts a little
  /// further as it fades in the second, each half on the ease-out.
  private func draw(in context: GraphicsContext, size: CGSize, progress: Double) {
    guard progress >= 0, progress < 1 else { return }

    let firstHalf = progress < 0.5
    let eased = ActEase.out.value(at: firstHalf ? progress * 2 : progress * 2 - 1)
    let center = CGPoint(x: size.width / 2, y: size.height / 2)
    let shading = GraphicsContext.Shading.color(color)

    for spark in sparks {
      let travel = firstHalf ? eased : 1 + 0.25 * eased
      let scale = firstHalf ? 0.4 + 0.6 * eased : 1
      var context = context
      context.opacity = firstHalf ? 1 : 1 - eased
      context.translateBy(x: center.x + spark.x * travel, y: center.y + spark.y * travel)
      context.scaleBy(x: scale * spark.size / 10, y: scale * spark.size / 10)
      context.fill(
        svg("M5 0 6.2 3.8 10 5 6.2 6.2 5 10 3.8 6.2 0 5 3.8 3.8Z").offsetBy(dx: -5, dy: -5),
        with: shading)
    }
  }
}
