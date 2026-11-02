import SwiftUI

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

/// `reacts` where something just happened (the challenge opened, or its result came in); a revisit
/// passes none, and he's still.
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

/// Put it in an overlay centered on the burst's point; it draws past its frame.
struct Burst: View {
  struct Spark: Sendable {
    let size: Double
    let x: Double
    let y: Double
  }

  /// A little lopsided, as a real burst is.
  static let near: [Spark] = [
    Spark(size: 9, x: -38, y: -14), Spark(size: 7, x: -18, y: -32), Spark(size: 10, x: 8, y: -36),
    Spark(size: 7, x: 32, y: -24), Spark(size: 9, x: 44, y: 2), Spark(size: 6, x: 30, y: 24),
    Spark(size: 8, x: -6, y: 30), Spark(size: 6, x: -34, y: 18),
  ]

  var sparks = Burst.near
  var color = Color.brain
  var delay: TimeInterval = 0

  @Environment(\.accessibilityReduceMotion) private var reduceMotion
  @State private var start: Date?
  @State private var done = false

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
