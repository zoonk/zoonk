import SwiftUI

/// Where the offer after a finished lesson stands. It's kept above the panes, so folding or
/// resizing never loses the time the learner picked or what they answered.
struct ReminderOfferState: Equatable {
  enum Step: Equatable {
    case asking
    /// The system blocks Zoonk's notifications.
    case denied
    case pushOn
    case emailOn
    case dismissed
  }

  /// The learner answers only once the server has marked the offer shown.
  enum Claim: Equatable {
    case unseen
    case claiming
    case claimed
  }

  var time: String
  let timeZone: String
  var step = Step.asking
  var claim = Claim.unseen
  var isSaving = false
  var failed = false
}

/// Main's offer below a finished lesson: once, quietly, never in place of Continue.
struct ReminderOfferCard: View {
  @Binding var offer: ReminderOfferState

  @Environment(\.scenePhase) private var scenePhase
  @Environment(LearnerSummaryStore.self) private var learner
  @Environment(PushNotifications.self) private var notifications
  @Environment(StudyRemindersStore.self) private var reminders

  var body: some View {
    if offer.step != .dismissed {
      VStack(alignment: .leading, spacing: 12) {
        content

        if offer.failed {
          FailureLine(
            message: LocalizedStringResource(
              "That didn't save. Try again.", table: "Reminders",
              comment: "Turning reminders on failed"))
        }
      }
      .frame(maxWidth: .infinity, alignment: .leading)
      .padding(.horizontal, 14)
      .padding(.vertical, 12)
      .panel()
      .onScrollVisibilityChange(threshold: 0.5) { isVisible in
        if isVisible {
          claim()
        }
      }
      .onChange(of: scenePhase) { _, phase in
        recheckPermission(phase)
      }
    }
  }

  @ViewBuilder
  private var content: some View {
    let time = ReminderTime.formatted(offer.time)

    switch offer.step {
    case .asking:
      words(
        title: Text(
          "Want a study reminder?", tableName: "Reminders",
          comment: "Title of the offer below a finished lesson"),
        line: promise(time), symbol: "bell")

      if offer.claim == .claimed {
        answers
      }
    case .denied:
      NotificationsOffNotice {
        if learner.summary.value?.identity.isAnonymous == false {
          BusyButton(isBusy: offer.isSaving, icon: .send) {
            save(on: .emailOn) { await reminders.turnOnEmail(at: offer.time) ? .on : .failed }
          } label: {
            Text(
              "Email me instead", tableName: "Reminders",
              comment: "Turns on email reminders when the system blocks notifications")
          }
          .buttonStyle(.ghost)
        }
      }
    case .pushOn:
      words(
        title: Text(
          "Reminders are on.", tableName: "Reminders",
          comment: "Push study reminders were just turned on"),
        line: promise(time), symbol: "bell.badge")
    case .emailOn:
      words(
        title: Text(
          "Email reminders are on.", tableName: "Reminders",
          comment: "Email study reminders were just turned on"),
        line: promise(time), symbol: "envelope")
    case .dismissed:
      EmptyView()
    }
  }

  @ViewBuilder
  private var answers: some View {
    DatePicker(selection: timeBinding, displayedComponents: .hourAndMinute) {
      ListRow(
        Text("Time", tableName: "Reminders", comment: "Row for the time reminders go out"),
        description: Text(ReminderTime.zoneName(offer.timeZone)))
    }
    .environment(\.timeZone, .gmt)
    .disabled(offer.isSaving)

    ViewThatFits(in: .horizontal) {
      HStack(spacing: 8) {
        answerButtons
      }

      VStack(alignment: .leading, spacing: 8) {
        answerButtons
      }
    }
  }

  @ViewBuilder
  private var answerButtons: some View {
    BusyButton(isBusy: offer.isSaving, icon: .notify) {
      turnOnPush()
    } label: {
      Text("Remind me", tableName: "Reminders", comment: "Turns study reminders on")
    }
    .buttonStyle(.outline)

    Button {
      offer.step = .dismissed
    } label: {
      Text("No thanks", tableName: "Reminders", comment: "Declines the reminder offer")
    }
    .buttonStyle(.ghost)
    .disabled(offer.isSaving)
  }

  /// The offer's own promise, kept once it's on: a reminder only comes when learning is left.
  private func promise(_ time: String) -> Text {
    Text(
      "At \(time) on your study days, when you still have learning left.",
      tableName: "Reminders", comment: "What the reminder offer below a lesson promises")
  }

  private func words(title: Text, line: Text, symbol: String) -> some View {
    Label {
      VStack(alignment: .leading, spacing: 2) {
        title
          .typeStyle(.rowTitle)
          .foregroundStyle(Color(.foreground))

        line
          .typeStyle(.meta)
          .foregroundStyle(.mutedForeground)
      }
    } icon: {
      Image(systemName: symbol)
        .foregroundStyle(.mutedForeground)
    }
    .accessibilityElement(children: .combine)
  }

  private var timeBinding: Binding<Date> {
    Binding(
      get: { ReminderTime.date(offer.time) },
      set: { offer.time = ReminderTime.string($0) })
  }

  private func turnOnPush() {
    save(on: .pushOn) { await reminders.turnOnPush(at: offer.time) }
  }

  private func save(on success: ReminderOfferState.Step, _ setUp: @escaping () async -> PushSetup) {
    offer.isSaving = true
    offer.failed = false

    Task {
      let result = await setUp()
      offer.isSaving = false

      switch result {
      case .on:
        offer.step = success
      case .denied:
        offer.step = .denied
      case .failed:
        offer.failed = true
      }
    }
  }

  /// Once half of it has been on screen: a learner who never scrolled to it is asked after the
  /// next lesson. Unclaimed, it goes away, so an answer is never lost and the offer never repeats.
  private func claim() {
    guard offer.claim == .unseen else {
      return
    }

    offer.claim = .claiming

    Task {
      if await reminders.claimOffer() {
        offer.claim = .claimed
      } else {
        offer.step = .dismissed
      }
    }
  }

  /// Back from Settings with notifications allowed, the yes the learner already gave goes through.
  private func recheckPermission(_ phase: ScenePhase) {
    guard phase == .active, offer.step == .denied, !offer.isSaving else {
      return
    }

    Task {
      if await notifications.isAuthorized() {
        turnOnPush()
      }
    }
  }
}
