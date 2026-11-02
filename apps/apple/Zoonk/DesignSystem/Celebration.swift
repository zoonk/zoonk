import SwiftUI

extension EnvironmentValues {
  /// Main's `useCelebration`: false where the moment was already seen (folding or unfolding draws
  /// it again, a result shown a second time), so it draws its end state, still.
  @Entry var celebrates = true
}

/// The moments that already played, so folding or unfolding, which draws a pane again, shows
/// their end state.
@MainActor private var celebratedMoments = Set<AnyHashable>()

/// Plays `id`'s moment the first time its view appears and draws its end state after that.
private struct CelebratesOnce: ViewModifier {
  let id: AnyHashable

  @Environment(\.celebrates) private var celebrates
  @State private var isFirst: Bool

  init(id: AnyHashable) {
    self.id = id
    _isFirst = State(initialValue: !celebratedMoments.contains(id))
  }

  func body(content: Content) -> some View {
    content
      .environment(\.celebrates, celebrates && isFirst)
      .onAppear {
        if celebrates, isFirst {
          celebratedMoments.insert(id)
        }
      }
  }
}

extension View {
  func celebratesOnce(id: some Hashable) -> some View {
    modifier(CelebratesOnce(id: AnyHashable(id)))
  }
}

extension TimeInterval {
  /// Main's `STAGGER_MS`: things of one kind in a moment land this far apart.
  static let stagger = 0.1
  static let fill = 0.7
  static let settle = 0.65
}

/// Main's `CountUp`: the final value is there from the first frame for VoiceOver and layout, and
/// the counting digits draw over it, blank until they start so they never say "+0".
struct EarnedNumber: View {
  let value: Int
  var delay: TimeInterval = 0

  @Environment(\.celebrates) private var celebrates
  @Environment(\.accessibilityReduceMotion) private var reduceMotion
  @State private var count: Double?

  var body: some View {
    Text(value, format: .number.sign(strategy: .always()))
      .monospacedDigit()
      .opacity(count == nil ? 1 : 0)
      .overlay(alignment: .leading) {
        if let count {
          CountingNumber(count: count)
            .accessibilityHidden(true)
        }
      }
      .task {
        guard celebrates, !reduceMotion, value > 0 else { return }

        // Drawn blank at 0 first, so the count has a start to animate from.
        count = 0
        try? await Task.sleep(for: .seconds(max(delay, 0.05)))
        guard !Task.isCancelled else { return }

        withAnimation(.easeOut(duration: .fill)) {
          count = Double(value)
        } completion: {
          count = nil
        }
      }
  }
}

private struct CountingNumber: View, Animatable {
  var count: Double

  var animatableData: Double {
    get { count }
    set { count = newValue }
  }

  var body: some View {
    if count > 0 {
      Text(Int(count.rounded(.up)), format: .number.sign(strategy: .always()))
        .monospacedDigit()
    }
  }
}

/// Main's `animate-settle`: something earned lands with the spring, once.
struct Settles: ViewModifier {
  var delay: TimeInterval = 0
  var from = 0.5

  @Environment(\.celebrates) private var celebrates
  @Environment(\.accessibilityReduceMotion) private var reduceMotion
  @State private var landed = false

  func body(content: Content) -> some View {
    let waiting = celebrates && !reduceMotion && !landed

    content
      .scaleEffect(waiting ? from : 1)
      .opacity(waiting ? 0 : 1)
      .task {
        guard waiting else { return }

        withAnimation(.spring(duration: .settle, bounce: 0.3).delay(delay)) {
          landed = true
        }
      }
  }
}

extension View {
  func settles(delay: TimeInterval = 0, from: Double = 0.5) -> some View {
    modifier(Settles(delay: delay, from: from))
  }
}

/// One part of a meter. `from` is where the moment knows it started: it fills from there, once.
struct MeterSegment: View {
  let share: Double
  var from: Double?
  var color: Color
  var track: Color = Color(.systemFill)
  var delay: TimeInterval = 0

  @Environment(\.celebrates) private var celebrates
  @Environment(\.accessibilityReduceMotion) private var reduceMotion
  @State private var filled = false

  private var fills: Bool {
    guard let from else { return false }
    return celebrates && !reduceMotion && share > from
  }

  var body: some View {
    let start = fills && !filled ? (from ?? 0) / share : 1

    Capsule()
      .fill(track)
      .overlay(alignment: .leading) {
        GeometryReader { proxy in
          Rectangle()
            .fill(color)
            .frame(width: proxy.size.width * min(max(share, 0), 1))
            .scaleEffect(x: start, anchor: .leading)
        }
      }
      .clipShape(.capsule)
      .task {
        guard fills, !filled else { return }

        withAnimation(.easeOut(duration: .fill).delay(delay)) {
          filled = true
        }
      }
  }
}
