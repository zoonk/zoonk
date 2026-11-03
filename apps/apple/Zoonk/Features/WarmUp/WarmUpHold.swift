import SwiftUI

@MainActor
@Observable
final class WarmUpVisit {
  /// Stays on this screen until "Next guess", whatever another window guesses meanwhile.
  struct Dealt: Equatable {
    let deckID: String
    let card: Int
    var picked: String?
  }

  let surface: AnalyticsEvent.WarmUpSurface
  private(set) var guesses = 0
  private(set) var dealt: Dealt?
  /// Ready while the learner plays: they finish the card on show, and no new one is dealt.
  fileprivate(set) var isHolding = false
  @ObservationIgnored private(set) var shownDeck: String?
  @ObservationIgnored fileprivate var isTouched = false
  /// A touch ending, or the moment the wait ended: the screen moves on one quiet second later.
  @ObservationIgnored fileprivate var stirredAt = ContinuousClock.now

  init(surface: AnalyticsEvent.WarmUpSurface) {
    self.surface = surface
  }

  var guessed: Bool { guesses > 0 }

  func show(_ deck: WarmUpDeck, card: Int) {
    if dealt?.deckID != deck.id {
      deal(card, deckID: deck.id)
    }

    guard shownDeck == nil else {
      return
    }

    shownDeck = deck.id
    UsageAnalytics.track(.warmUpShown(surface: surface, cardCount: deck.cards.count))
  }

  /// Only the first pick counts: the answer shows at once.
  func guess(_ dealt: Dealt, cardID: String, correct: Bool) -> Bool {
    guard self.dealt?.deckID != dealt.deckID || self.dealt?.picked == nil else {
      return false
    }

    self.dealt = dealt
    guesses += 1
    UsageAnalytics.track(
      .warmUpAnswered(
        surface: surface, cardID: cardID, position: dealt.card + 1, correct: correct))
    return true
  }

  func deal(_ card: Int, deckID: String) {
    dealt = Dealt(deckID: deckID, card: card)
  }
}

struct WarmUpHolding {
  let moveOn: () -> Void
}

enum WarmUpStage {
  /// The wait, with its cards; `holding` once ready while the learner who guessed on it stays.
  case waiting(holding: WarmUpHolding?)
  /// What the wait was for.
  case ready
}

/// The owner's rule for every wait that deals warm-up cards: once what it waits for is ready, a
/// learner who hasn't guessed on it moves on after one second without a touch (a guess in that
/// second counts), and one who has stays with a main button, so nobody is pulled away mid-card.
struct WarmUpHold<Content: View>: View {
  let isReady: Bool
  /// Said when the wait starts holding: its title changes, and focus stays where it is. Nil for a
  /// screen that says it's ready itself.
  let announcement: LocalizedStringResource?
  let onMoveOn: () -> Void
  /// One view for every stage keeps a screen that stays (the session) from being rebuilt.
  @ViewBuilder let content: (WarmUpStage) -> Content

  @State private var visit: WarmUpVisit
  @State private var stage: Stage

  private enum Stage {
    case waiting
    /// Ready, in the quiet second.
    case settling
    case holding
    case done
  }

  init(
    surface: AnalyticsEvent.WarmUpSurface,
    isReady: Bool,
    announcement: LocalizedStringResource?,
    @ViewBuilder content: @escaping (WarmUpStage) -> Content,
    onMoveOn: @escaping () -> Void = {}
  ) {
    self.isReady = isReady
    self.announcement = announcement
    self.onMoveOn = onMoveOn
    self.content = content
    _visit = State(initialValue: WarmUpVisit(surface: surface))
    _stage = State(initialValue: isReady ? .done : .waiting)
  }

  var body: some View {
    content(shown)
      .environment(visit)
      .gesture(
        TouchReader { isTouched in
          visit.isTouched = isTouched
          visit.stirredAt = .now
        }
      )
      .onChange(of: isReady) { _, isReady in
        if isReady {
          end()
        } else {
          stage = .waiting
          visit.isHolding = false
        }
      }
      .onChange(of: visit.guessed) { _, guessed in
        if guessed, stage == .settling {
          hold()
        }
      }
      .task(id: stage) {
        if stage == .settling {
          await settle()
        }
      }
  }

  private var shown: WarmUpStage {
    switch stage {
    // Ready shows only once it is: a wait that comes back shows at once.
    case .done where isReady: .ready
    case .holding: .waiting(holding: WarmUpHolding(moveOn: moveOn))
    case .waiting, .settling, .done: .waiting(holding: nil)
    }
  }

  private func end() {
    guard stage == .waiting else {
      return
    }

    if visit.guessed {
      hold()
    } else if visit.shownDeck == nil {
      moveOn()
    } else {
      visit.stirredAt = .now
      stage = .settling
    }
  }

  private func settle() async {
    while visit.isTouched || ContinuousClock.now < visit.stirredAt + .seconds(1) {
      let wake = visit.isTouched ? .now + .milliseconds(100) : visit.stirredAt + .seconds(1)

      do {
        try await Task.sleep(until: wake, clock: .continuous)
      } catch {
        return
      }
    }

    if visit.guessed {
      hold()
    } else {
      moveOn()
    }
  }

  private func hold() {
    stage = .holding
    visit.isHolding = true

    if let announcement {
      AccessibilityNotification.Announcement(String(localized: announcement)).post()
    }
  }

  private func moveOn() {
    // A wait that comes back on this screen is a new one.
    visit = WarmUpVisit(surface: visit.surface)
    stage = .done
    onMoveOn()
  }
}

extension View {
  func warmUpHoldBar(_ holding: WarmUpHolding?, label: Text) -> some View {
    safeAreaBar(edge: .bottom) {
      if let holding {
        Button(action: holding.moveOn) {
          label.frame(maxWidth: .infinity)
        }
        .buttonStyle(.mainAction)
        .controlSize(.large)
        .keyboardShortcut(.defaultAction)
        .keepsOffFold()
        .scenePadding(.horizontal)
        .padding(.vertical, 10)
      }
    }
  }
}

/// Reports whether a finger is on the screen, from the moment it lands until it lifts. It never
/// recognizes, so it takes nothing from a control or a scroll.
private struct TouchReader: UIGestureRecognizerRepresentable {
  let touched: (_ isTouched: Bool) -> Void

  func makeUIGestureRecognizer(context: Context) -> TouchReaderRecognizer {
    TouchReaderRecognizer()
  }

  func updateUIGestureRecognizer(_ recognizer: TouchReaderRecognizer, context: Context) {
    recognizer.touched = touched
  }
}

private final class TouchReaderRecognizer: UIGestureRecognizer {
  var touched: (Bool) -> Void = { _ in }

  init() {
    super.init(target: nil, action: nil)
    cancelsTouchesInView = false
    delaysTouchesEnded = false
  }

  override func touchesBegan(_ touches: Set<UITouch>, with event: UIEvent) {
    touched(true)
  }

  override func touchesEnded(_ touches: Set<UITouch>, with event: UIEvent) {
    state = .failed
  }

  override func touchesCancelled(_ touches: Set<UITouch>, with event: UIEvent) {
    state = .failed
  }

  /// After the last finger lifts.
  override func reset() {
    super.reset()
    touched(false)
  }

  /// A button's or a scroll's gesture would otherwise fail it before the finger lifts.
  override func canBePrevented(by preventingGestureRecognizer: UIGestureRecognizer) -> Bool {
    false
  }
}
