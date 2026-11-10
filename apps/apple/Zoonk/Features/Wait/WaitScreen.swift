import SwiftUI

/// What's ready, pinned in the bar in place of the quiz's buttons.
struct WaitReady {
  var note: LocalizedStringResource?
  /// The progress view's heading already says the note.
  var noteOnQuizOnly = false
  let label: Text
  var icon: ActionIcon?
  let action: () -> Void
}

/// A Library course that fits the goal: a quiet way out of the wait while nothing is ready.
struct WaitLibraryCourse {
  let courseID: String
  let title: String
}

/// A wait's quiz deck: the one to deal from once it's ready, or one still on its way.
struct WaitDeck: Equatable {
  var id: String?
  var isComing = false
}

/// The deck a wait deals from and the card on show, worked out once per render.
struct WaitDeal {
  let deck: Resource<WarmUpDeck>?
  let dealt: DealtCard?
  /// A card is there, or one is on its way or being read: each keeps the quiz's place, with the
  /// card's shapes until it comes. A deck that stops coming turns the page to the progress.
  let hasCard: Bool

  @MainActor
  init(deck: WaitDeck, visit: WaitVisit, warmUps: WarmUpStore) {
    self.deck = deck.id.map(warmUps.deck(id:))
    dealt = visit.dealtCard(
      deck: self.deck?.value, firstUnguessed: deck.id.map(warmUps.firstUnguessed(deckID:)) ?? 0)
    let isReading = self.deck.map { $0.state == .idle || $0.state == .loading } ?? false
    hasCard = dealt != nil || isReading || deck.isComing
  }

  @MainActor
  func page(_ visit: WaitVisit) -> WaitVisit.Page {
    hasCard ? visit.page ?? .quiz : .progress
  }
}

/// Main's `WaitScreen`, one screen for every wait: a status strip and a quiz on the page, the work's
/// progress pushed from the strip, so Back and the edge swipe return to the same card and guess. A
/// page that opened with no card on its way shows the progress and offers the quiz in its bar once
/// one comes.
/// In onboarding's wide layout the progress sits in the aside above the plan so far, with no strip.
struct WaitScreen<Status: View, Progress: View, Extra: View>: View {
  let deck: WaitDeck
  var goalID: String?
  /// Names the pushed progress for Back and VoiceOver.
  let progressTitle: Text
  var ready: WaitReady?
  var library: WaitLibraryCourse?
  @ViewBuilder let status: () -> Status
  /// The progress's sections: its heading, its steps.
  @ViewBuilder let progress: () -> Progress
  /// More of the screen's own actions, under the quiz's in the bar.
  @ViewBuilder var extra: () -> Extra

  @Environment(WaitVisit.self) private var visit
  @Environment(WarmUpStore.self) private var warmUps
  @Environment(\.onboardingAside) private var onboardingAside

  var body: some View {
    let deal = WaitDeal(deck: deck, visit: visit, warmUps: warmUps)
    let page = deal.page(visit)

    Group {
      if onboardingAside != nil {
        list(deal)
          .onboardingColumn {
            if page == .quiz {
              WaitAsideProgress(content: progress)
            }
          }
      } else {
        list(deal)
      }
    }
    .waitProgress(deal, title: progressTitle, progress: progress, bar: bar(.pushed, deal))
  }

  private func list(_ deal: WaitDeal) -> some View {
    ScrollViewReader { proxy in
      ZoonkList {
        WaitSections(deal: deal, goalID: goalID, status: status, progress: progress)
      }
      .onChange(of: visit.guesses) {
        withAnimation { proxy.scrollTo(WaitQuiz.revealRow) }
      }
    }
    .waitBar(bar(.page, deal))
  }

  private func bar(_ place: WaitBarPlace, _ deal: WaitDeal) -> WaitBar<Extra> {
    WaitBar(
      place: place, page: deal.page(visit), dealt: deal.dealt, ready: ready, library: library,
      extra: extra)
  }
}

enum WaitBarPlace {
  case page
  case pushed
}

/// A wait's part of a list: the strip and the quiz, or the progress.
struct WaitSections<Status: View, Progress: View>: View {
  let deal: WaitDeal
  let goalID: String?
  @ViewBuilder let status: () -> Status
  @ViewBuilder let progress: () -> Progress

  @Environment(WaitVisit.self) private var visit
  @Environment(\.isPaneSplit) private var isPaneSplit
  @Environment(\.onboardingAside) private var onboardingAside

  var body: some View {
    switch deal.page(visit) {
    case .quiz:
      // Beside onboarding's aside, the progress is drawn there instead.
      if !(isPaneSplit && onboardingAside != nil) {
        Section {
          status()
        }
        // The course's status and the game under it read as two things.
        .listSectionSeparator(.visible, edges: .bottom)
      }

      if let dealt = deal.dealt {
        WaitQuiz(dealt: dealt, goalID: goalID)
      } else {
        WaitQuizPlaceholder()
      }
    case .progress:
      progress()
    }
  }
}

extension View {
  /// The progress pushed from the strip, the deck's read, and the page decided as the wait opens.
  func waitProgress<Progress: View, Extra: View>(
    _ deal: WaitDeal, title: Text, @ViewBuilder progress: @escaping () -> Progress,
    bar: WaitBar<Extra>
  ) -> some View {
    modifier(WaitProgressPush(deal: deal, title: title, progress: progress, bar: bar))
  }
}

private struct WaitProgressPush<Progress: View, Extra: View>: ViewModifier {
  let deal: WaitDeal
  let title: Text
  @ViewBuilder let progress: () -> Progress
  let bar: WaitBar<Extra>

  @Environment(WaitVisit.self) private var visit

  func body(content: Content) -> some View {
    content
      // The learner's own switch, so the page cross-fades; nothing moves or resizes.
      .animation(.easeOut(duration: 0.15), value: deal.page(visit))
      .navigationDestination(isPresented: Bindable(visit).showsProgress) {
        ZoonkList {
          progress()
        }
        .barName(title)
        .waitBar(bar)
        // A pushed page takes the stack's environment, not the wait's.
        .environment(visit)
      }
      .loads(deal.deck.map { [$0] } ?? [], refreshable: false)
      // A deck that comes after this is offered in the bar, never swapped in under the learner.
      .onAppear { visit.open(hasCard: deal.hasCard) }
  }
}

/// The progress as the aside's first block, above the plan so far, while the quiz has the column.
private struct WaitAsideProgress<Content: View>: View {
  @ViewBuilder let content: () -> Content

  @Environment(\.isPaneSplit) private var isBeside

  var body: some View {
    if isBeside {
      content()
        .environment(\.isWaitAside, true)
    }
  }
}

extension EnvironmentValues {
  @Entry fileprivate var isWaitAside = false
}

/// Main's `WaitHeading`: the progress's title as the page's, or as a block's in the aside.
struct WaitHeading: View {
  let title: Text
  let description: Text

  @Environment(\.isWaitAside) private var isAside

  var body: some View {
    if isAside {
      Section {
        VStack(alignment: .leading, spacing: 4) {
          title
            .typeStyle(.sectionTitle)
            .accessibilityAddTraits(.isHeader)

          description
            .typeStyle(.note)
            .foregroundStyle(.mutedForeground)
        }
        .listRowBackground(Color.clear)
      }
    } else {
      StepHeader(title: title, description: description)
    }
  }
}

/// The card's shapes while the deck is written or read.
private struct WaitQuizPlaceholder: View {
  var body: some View {
    Section {
      VStack(alignment: .leading, spacing: 12) {
        Text(verbatim: "A question about the subject you're about to learn?")
          .typeStyle(.question)

        ForEach(0..<3, id: \.self) { _ in
          Text(verbatim: "An answer")
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(14)
            .panel()
        }
      }
      .redacted(reason: .placeholder)
      .accessibilityHidden(true)
      .listRowBackground(Color.clear)
    }
  }
}

/// The bar's one slot: what's ready when something is, otherwise the next card, the way back to
/// the quiz, or the quiz once a card arrived.
struct WaitBar<Extra: View>: View {
  let place: WaitBarPlace
  let page: WaitVisit.Page
  let dealt: DealtCard?
  let ready: WaitReady?
  let library: WaitLibraryCourse?
  @ViewBuilder let extra: () -> Extra

  @Environment(WaitVisit.self) private var visit
  @Environment(WarmUpStore.self) private var warmUps

  private enum Slot {
    case backToQuiz
    case playQuiz
    case nextGuess
    case allGuessed
  }

  private var slot: Slot? {
    switch (place, page) {
    case (.pushed, _):
      return .backToQuiz
    case (.page, .progress):
      return dealt == nil ? nil : .playQuiz
    case (.page, .quiz):
      guard let dealt, dealt.picked != nil else {
        return nil
      }

      return dealt.hasNext ? .nextGuess : .allGuessed
    }
  }

  var isEmpty: Bool {
    ready == nil && library == nil && slot == nil && Extra.self == EmptyView.self
  }

  var body: some View {
    VStack(spacing: 12) {
      if let ready {
        if let note = ready.note, !ready.noteOnQuizOnly || (place == .page && page == .quiz) {
          Text(note)
            .typeStyle(.note)
            .foregroundStyle(.mutedForeground)
            .multilineTextAlignment(.center)
        }

        BusyButton(isBusy: false, icon: ready.icon, action: ready.action) {
          ready.label
        }
        .buttonStyle(.mainAction)
        .buttonSizing(.flexible)
        .keyboardShortcut(.defaultAction)
      } else {
        if let library {
          LibraryCourseRow(course: library)
        }

        if let slot {
          slotView(slot)
        }

        extra()
      }
    }
    .controlSize(.large)
  }

  @ViewBuilder
  private func slotView(_ slot: Slot) -> some View {
    switch slot {
    case .backToQuiz:
      Button {
        visit.showsProgress = false
      } label: {
        Text(
          "Back to the quiz", tableName: "Onboarding",
          comment:
            "Leaves the build's progress for the quiz under it. The quiz is a short side game of questions shown while the learner waits for their course. Use the same word for it in every string about it."
        )
        .frame(maxWidth: .infinity)
      }
      .buttonStyle(.outline)
    case .playQuiz:
      Button {
        visit.playQuiz()
      } label: {
        Text(
          "Play a quiz while you wait", tableName: "Onboarding",
          comment:
            "Shows a quiz once one arrived while the learner watches the build's progress. The quiz is a short side game of questions shown while the learner waits for their course. Use the same word for it in every string about it."
        )
        .frame(maxWidth: .infinity)
      }
      .buttonStyle(.outline)
    case .nextGuess:
      if !visit.isHolding, let dealt {
        BusyButton(isBusy: false, icon: .forward) {
          visit.deal(warmUps.firstUnguessed(deckID: dealt.deck.id), deckID: dealt.deck.id)
        } label: {
          Text(
            "Next guess", tableName: "Onboarding",
            comment: "Shows the next quiz question while the plan or lesson is written")
        }
        .buttonStyle(.outline)
        .buttonSizing(.flexible)
        .keyboardShortcut(.defaultAction)
      }
    case .allGuessed:
      Text(
        "That's all for now.", tableName: "Onboarding",
        comment: "Under a quiz's last answer: there are no more guesses"
      )
      .typeStyle(.note)
      .foregroundStyle(.mutedForeground)
    }
  }
}

/// Main's `LibraryCourseOffer`: a quiet row, the course and why it's offered.
private struct LibraryCourseRow: View {
  let course: WaitLibraryCourse

  @Environment(AppRouter.self) private var router

  var body: some View {
    Button {
      router.open(.course(courseId: course.courseID, title: course.title))
    } label: {
      HStack(spacing: 12) {
        Image(systemName: "book")
          .foregroundStyle(.mutedForeground)
          .accessibilityHidden(true)

        VStack(alignment: .leading, spacing: 2) {
          Text(course.title)
            .typeStyle(.rowTitle)
            .foregroundStyle(Color(.foreground))
            .lineLimit(1)

          Text(
            "A Library course fits your goal. Start it now", tableName: "Onboarding",
            comment: "Under a Library course offered while the learner's plan is built"
          )
          .typeStyle(.meta)
          .foregroundStyle(.mutedForeground)
        }
        .frame(maxWidth: .infinity, alignment: .leading)

        DisclosureChevron()
      }
      .contentShape(.rect)
    }
    .buttonStyle(.plain)
    .accessibilityElement(children: .combine)
  }
}

extension View {
  func waitBar<Extra: View>(_ bar: WaitBar<Extra>) -> some View {
    safeAreaBar(edge: .bottom) {
      if !bar.isEmpty {
        bar
          .keepsOffFold()
          .scenePadding(.horizontal)
          .padding(.vertical, 10)
      }
    }
    // Its outlined buttons are see-through, so what scrolls under the bar stops at its edge.
    .scrollEdgeEffectStyle(.hard, for: .bottom)
  }
}

extension WaitScreen where Extra == EmptyView {
  init(
    deck: WaitDeck,
    goalID: String? = nil,
    progressTitle: Text,
    ready: WaitReady? = nil,
    library: WaitLibraryCourse? = nil,
    @ViewBuilder status: @escaping () -> Status,
    @ViewBuilder progress: @escaping () -> Progress
  ) {
    self.init(
      deck: deck, goalID: goalID, progressTitle: progressTitle, ready: ready,
      library: library, status: status, progress: progress, extra: { EmptyView() })
  }
}
