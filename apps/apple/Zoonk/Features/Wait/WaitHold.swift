import SwiftUI

@MainActor
@Observable
final class WaitVisit {
  /// Stays on this screen until "Next guess", whatever another window guesses meanwhile.
  struct Dealt: Equatable {
    let deckID: String
    let card: Int
    var picked: String?
  }

  /// What the screen's own page shows: the quiz, or the progress when no card was there as it opened.
  enum Page {
    case quiz
    case progress
  }

  let surface: AnalyticsEvent.WarmUpSurface
  private(set) var guesses = 0
  private(set) var dealt: Dealt?
  /// Ready while the learner plays: they finish the card on show, and no new one is dealt.
  fileprivate(set) var isHolding = false
  /// The learner guessed, opened the progress or chose the quiz here, so once what they wait for is
  /// ready, they stay until they press the bar.
  private(set) var isEngaged = false
  /// Decided once, as the screen first shows, so the page never changes under the learner.
  private(set) var page: Page?
  /// The progress pushed over the quiz; every Back pops it.
  var showsProgress = false
  /// A card was on this wait's screen, so once it's ready the learner gets a quiet second to finish.
  @ObservationIgnored private(set) var showedCard = false
  @ObservationIgnored fileprivate var isTouched = false
  /// A touch ending, or the moment the wait ended: the screen moves on one quiet second later.
  @ObservationIgnored fileprivate var stirredAt = ContinuousClock.now

  init(surface: AnalyticsEvent.WarmUpSurface) {
    self.surface = surface
  }

  func open(hasCard: Bool) {
    if page == nil {
      page = hasCard ? .quiz : .progress
    }
  }

  func openProgress() {
    showsProgress = true
    isEngaged = true
  }

  func playQuiz() {
    page = .quiz
    isEngaged = true
  }

  func show(_ deck: WarmUpDeck, card: Int) {
    if dealt?.deckID != deck.id {
      deal(card, deckID: deck.id)
    }

    showedCard = true
  }

  /// Only the first pick counts: the answer shows at once.
  func guess(_ dealt: Dealt, cardID: String, correct: Bool) -> Bool {
    guard self.dealt?.deckID != dealt.deckID || self.dealt?.picked == nil else {
      return false
    }

    self.dealt = dealt
    guesses += 1
    isEngaged = true
    UsageAnalytics.track(
      .warmUpAnswered(
        surface: surface, cardID: cardID, position: dealt.card + 1, correct: correct))
    return true
  }

  func deal(_ card: Int, deckID: String) {
    dealt = Dealt(deckID: deckID, card: card)
  }
}

struct WaitHolding {
  let moveOn: () -> Void
}

enum WaitStage {
  /// The wait, with its cards; `holding` once ready while a learner who played or watched stays.
  case waiting(holding: WaitHolding?)
  /// What the wait was for.
  case ready
}

/// Main's `getReadyHold`, the rule every wait follows: once what it waits for is ready, a learner who
/// guessed, opened the progress or chose the quiz on it stays until they press the bar, so nobody is
/// pulled away mid-card. Anyone else moves on after one second without a touch (playing in that
/// second counts).
struct WaitHold<Content: View>: View {
  let isReady: Bool
  /// Said when the wait starts holding: its title changes, and focus stays where it is. Nil for a
  /// screen that says it's ready itself.
  let announcement: LocalizedStringResource?
  let onMoveOn: () -> Void
  /// One view for every stage keeps a screen that stays (the session) from being rebuilt.
  @ViewBuilder let content: (WaitStage) -> Content

  @State private var visit: WaitVisit
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
    @ViewBuilder content: @escaping (WaitStage) -> Content,
    onMoveOn: @escaping () -> Void = {}
  ) {
    self.isReady = isReady
    self.announcement = announcement
    self.onMoveOn = onMoveOn
    self.content = content
    _visit = State(initialValue: WaitVisit(surface: surface))
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
      .onChange(of: visit.isEngaged) { _, engaged in
        if engaged, stage == .settling {
          hold()
        }
      }
      .task(id: stage) {
        if stage == .settling {
          await settle()
        }
      }
  }

  private var shown: WaitStage {
    switch stage {
    // Ready shows only once it is: a wait that comes back shows at once.
    case .done where isReady: .ready
    case .holding: .waiting(holding: WaitHolding(moveOn: moveOn))
    case .waiting, .settling, .done: .waiting(holding: nil)
    }
  }

  private func end() {
    guard stage == .waiting else {
      return
    }

    if visit.isEngaged {
      hold()
    } else if !visit.showedCard {
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

    if visit.isEngaged {
      hold()
    } else {
      moveOn()
    }
  }

  private func hold() {
    stage = .holding
    visit.isHolding = true

    if let announcement {
      announcePolitely(String(localized: announcement))
    }
  }

  private func moveOn() {
    // The ready action can be pressed on the pushed progress, which goes with the wait.
    visit.showsProgress = false
    // A wait that comes back on this screen is a new one.
    visit = WaitVisit(surface: visit.surface)
    stage = .done
    onMoveOn()
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
