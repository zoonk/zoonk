import SwiftUI

/// A character's drawing: its parts in its own units, drawn in the pose an act gives them.
protocol CharacterArt {
  associatedtype Expression: Hashable & Sendable
  associatedtype ActName: Hashable & Sendable

  /// The drawing's box in its own units, which the view fits to its frame.
  var viewBox: CGRect { get }
  /// How far past its box the drawing may reach (an antenna's glow, arms thrown up), as a share
  /// of the box on each side; 0 crops it to the box.
  var overflow: CGFloat { get }

  static func act(_ name: ActName) -> CharacterAct<Expression>
  /// Each expression's part poses beyond its face (the Trickster's slump), and parts drawn only by
  /// an act (a blink's lid line).
  static func poses(of expression: Expression) -> [CharacterPart: PartPose]
  static var blink: ActName { get }
  /// The faces whose eyes are open, the only ones a blink can close.
  static var openEyes: Set<Expression> { get }

  func draw(_ painter: ArtPainter, face: Expression)
}

/// Makes a character act (main's `useActor`): it draws `expression` still until an act plays, then
/// moves its parts through the act and lands in the act's expression. Everyday screens pass
/// neither `reaction` nor `cue`, so it holds still and its timeline stays paused.
///
/// A `reaction` plays once, when the view first appears (a moment that's already been seen passes
/// none, and the landing `expression` instead), then one blink about 2 s later if its eyes are open.
/// A `cue` plays its act each time its `id` changes. A new act, or the view going away, lands the
/// one under way at once, and with Reduce Motion an act only changes the face. It's decorative:
/// the words beside it say what happened.
struct CharacterActor<Art: CharacterArt>: View {
  let art: Art
  let expression: Art.Expression
  var reaction: ActReaction<Art.ActName>?
  var cue: ActCue<Art.ActName>?

  @Environment(\.accessibilityReduceMotion) private var reduceMotion

  @State private var landed: Art.Expression?
  @State private var playing: Playing?
  @State private var runs = 0
  @State private var reacted = false
  @State private var cueTask: Task<Void, Never>?

  private struct Playing {
    let act: CharacterAct<Art.Expression>
    let from: Art.Expression
    let start: Date
    let run: Int
  }

  /// How long a character holds the pose a reaction landed in before it blinks once (48 frames).
  private let blinkAfter: TimeInterval = 2

  private var shown: Art.Expression { landed ?? expression }

  var body: some View {
    let box = art.viewBox
    let reach = 1 + 2 * art.overflow
    // Read here, not only in the canvas's renderer, so drawing a new pose redraws the canvas.
    let shown = shown
    let playing = playing

    Color.clear
      .aspectRatio(box.width / box.height, contentMode: .fit)
      .overlay {
        GeometryReader { proxy in
          TimelineView(.animation(paused: playing == nil)) { timeline in
            Canvas { context, size in
              draw(in: context, size: size, shown: shown, playing: playing, at: timeline.date)
            }
          }
          .frame(width: proxy.size.width * reach, height: proxy.size.height * reach)
          .frame(width: proxy.size.width, height: proxy.size.height)
        }
      }
      .accessibilityHidden(true)
      .allowsHitTesting(false)
      .task { await react() }
      .onChange(of: cue) { _, cue in
        guard let cue else { return }
        cueTask?.cancel()
        cueTask = Task { await play(cue.act) }
      }
      .onDisappear { cueTask?.cancel() }
  }

  private func draw(
    in context: GraphicsContext, size: CGSize, shown: Art.Expression, playing: Playing?,
    at date: Date
  ) {
    let box = art.viewBox
    let reach = 1 + 2 * art.overflow
    let scale = min(size.width / (box.width * reach), size.height / (box.height * reach))
    var context = context

    context.translateBy(x: size.width / 2, y: size.height / 2)
    context.scaleBy(x: scale, y: scale)
    context.translateBy(x: -box.midX, y: -box.midY)

    if let playing {
      let frame =
        date.timeIntervalSince(playing.start) * CharacterAct<Art.Expression>.framesPerSecond
      let clamped = min(max(frame, 0), playing.act.frames)
      let poses = playing.act.poses(
        at: clamped, from: Art.poses(of: playing.from),
        to: Art.poses(of: playing.act.to ?? playing.from))

      art.draw(
        ArtPainter(context: context, poses: poses),
        face: playing.act.face(at: frame, from: playing.from))
    } else {
      art.draw(ArtPainter(context: context, poses: Art.poses(of: shown)), face: shown)
    }
  }

  private func react() async {
    guard let reaction, !reacted else { return }
    reacted = true

    if await play(reaction.act, delay: reaction.delay), Art.openEyes.contains(shown) {
      await play(Art.blink, delay: blinkAfter)
    }
  }

  /// Plays an act from the expression drawn now; true once it landed on its own, false when
  /// something stopped it (another act, the view going away), which lands it at once.
  @discardableResult
  private func play(_ name: Art.ActName, delay: TimeInterval = 0) async -> Bool {
    land()
    let act = Art.act(name)

    guard !reduceMotion else {
      landed = act.to ?? shown
      return false
    }

    runs += 1
    let run = runs
    playing = Playing(act: act, from: shown, start: .now.addingTimeInterval(delay), run: run)

    let finished = (try? await Task.sleep(for: .seconds(delay + act.duration))) != nil

    guard playing?.run == run else { return false }
    land()
    return finished
  }

  /// Draws the act under way's landing still, at once.
  private func land() {
    guard let playing else { return }
    landed = playing.act.to ?? playing.from
    self.playing = nil
  }
}

/// Draws a character's parts into a `GraphicsContext`, each part posed around its own pivot, the
/// way main's SVG parts take CSS `translate`, `rotate` and `scale`.
struct ArtPainter {
  var context: GraphicsContext
  let poses: [CharacterPart: PartPose]

  /// One named part, posed around `pivot` and drawn by `content`; a hidden part draws nothing.
  func part(_ part: CharacterPart, pivot: CGPoint, _ content: (ArtPainter) -> Void) {
    let pose = poses[part] ?? .still

    guard pose.opacity > 0 else { return }

    var context = context
    context.opacity *= pose.opacity
    context.translateBy(x: pivot.x + pose.translate.x, y: pivot.y + pose.translate.y)
    context.rotate(by: .degrees(pose.rotate))
    context.scaleBy(x: pose.scale.x, y: pose.scale.y)
    context.translateBy(x: -pivot.x, y: -pivot.y)
    content(ArtPainter(context: context, poses: poses))
  }

  /// Drawing moved, turned or faded as a group, like an SVG `<g>` with a `transform`.
  func group(
    _ transform: CGAffineTransform = .identity, opacity: Double = 1,
    _ content: (ArtPainter) -> Void
  ) {
    var context = context
    context.opacity *= opacity
    context.concatenate(transform)
    content(ArtPainter(context: context, poses: poses))
  }

  /// Drawing clipped to `path`.
  func clipped(to path: Path, _ content: (ArtPainter) -> Void) {
    var context = context
    context.clip(to: path)
    content(ArtPainter(context: context, poses: poses))
  }

  func fill(_ path: Path, _ paint: ArtPaint, opacity: Double = 1) {
    var context = context
    context.opacity *= opacity

    if case .radial(let gradient, let center, let radius) = paint {
      // An SVG gradient in its shape's box units stretches with the box, so it's drawn in a unit
      // square mapped onto the box.
      let box = path.boundingRect
      context.clip(to: path)
      context.concatenate(
        CGAffineTransform(
          a: box.width, b: 0, c: 0, d: box.height, tx: box.minX, ty: box.minY))
      context.fill(
        Path(CGRect(x: -2, y: -2, width: 5, height: 5)),
        with: .radialGradient(gradient, center: center, startRadius: 0, endRadius: radius))
    } else {
      context.fill(path, with: paint.shading(in: path.boundingRect))
    }
  }

  func stroke(
    _ path: Path, _ paint: ArtPaint, width: CGFloat, opacity: Double = 1,
    cap: CGLineCap = .butt, join: CGLineJoin = .miter, dash: [CGFloat] = []
  ) {
    var context = context
    context.opacity *= opacity
    context.stroke(
      path, with: paint.shading(in: path.boundingRect),
      style: StrokeStyle(lineWidth: width, lineCap: cap, lineJoin: join, dash: dash))
  }
}

/// What a shape is painted with: a color, or one of main's SVG gradients.
enum ArtPaint {
  case color(Color)
  /// A gradient across the shape's own box, from `start` to `end` in that box's units (SVG's
  /// default `objectBoundingBox`).
  case linear(Gradient, start: UnitPoint, end: UnitPoint)
  /// A gradient in the drawing's units (SVG's `userSpaceOnUse`).
  case linearInDrawing(Gradient, start: CGPoint, end: CGPoint)
  /// A radial gradient around `center`, `radius` of the shape's box (`objectBoundingBox`).
  case radial(Gradient, center: CGPoint, radius: CGFloat)

  fileprivate func shading(in box: CGRect) -> GraphicsContext.Shading {
    switch self {
    case .color(let color):
      .color(color)
    case .linear(let gradient, let start, let end):
      .linearGradient(
        gradient, startPoint: box.point(at: start), endPoint: box.point(at: end))
    case .linearInDrawing(let gradient, let start, let end):
      .linearGradient(gradient, startPoint: start, endPoint: end)
    case .radial(let gradient, let center, let radius):
      .radialGradient(
        gradient, center: box.point(at: UnitPoint(x: center.x, y: center.y)), startRadius: 0,
        endRadius: radius * max(box.width, box.height))
    }
  }
}

extension CGRect {
  fileprivate func point(at unit: UnitPoint) -> CGPoint {
    CGPoint(x: minX + width * unit.x, y: minY + height * unit.y)
  }
}

/// The shapes main's drawings are made of, in the drawing's units.
enum ArtShape {
  static func circle(_ x: Double, _ y: Double, _ radius: Double) -> Path {
    Path(ellipseIn: CGRect(x: x - radius, y: y - radius, width: radius * 2, height: radius * 2))
  }

  static func ellipse(_ x: Double, _ y: Double, _ radiusX: Double, _ radiusY: Double) -> Path {
    Path(
      ellipseIn: CGRect(x: x - radiusX, y: y - radiusY, width: radiusX * 2, height: radiusY * 2))
  }

  static func rect(
    _ x: Double, _ y: Double, _ width: Double, _ height: Double, radius: Double = 0
  ) -> Path {
    Path(
      roundedRect: CGRect(x: x, y: y, width: width, height: height), cornerRadius: radius,
      style: .circular)
  }

  /// SVG's `rotate(angle x y)`: a turn in degrees around a point.
  static func rotation(_ degrees: Double, _ x: Double, _ y: Double) -> CGAffineTransform {
    CGAffineTransform(translationX: x, y: y)
      .rotated(by: degrees * .pi / 180)
      .translatedBy(x: -x, y: -y)
  }
}

extension Path {
  /// The path turned `degrees` around a point, as SVG's `rotate(angle x y)` on one shape.
  func rotated(_ degrees: Double, around x: Double, _ y: Double) -> Path {
    applying(ArtShape.rotation(degrees, x, y))
  }
}

extension Color {
  /// One of the characters' own colors, drawn the same in light and dark as main draws them: it's
  /// artwork (a skin, a lens, an ink line on a face), which no system color can stand in for.
  init(art hex: UInt32) {
    self.init(
      .sRGB, red: Double((hex >> 16) & 0xff) / 255, green: Double((hex >> 8) & 0xff) / 255,
      blue: Double(hex & 0xff) / 255)
  }
}

extension Gradient {
  /// A gradient through the characters' own colors at SVG stop offsets.
  init(art stops: (UInt32, Double, Double)...) {
    self.init(
      stops: stops.map { hex, location, opacity in
        Gradient.Stop(color: Color(art: hex).opacity(opacity), location: location)
      })
  }
}
