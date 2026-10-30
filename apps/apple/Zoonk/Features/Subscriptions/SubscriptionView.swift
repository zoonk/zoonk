import StoreKit
import SwiftUI

struct SubscriptionScreen: View {
  @Environment(\.dismiss) private var dismiss
  @Environment(AppRouter.self) private var router
  @Environment(LearnerSummaryStore.self) private var learner
  @Environment(SessionStore.self) private var session
  @Environment(SettingsStore.self) private var settings

  var body: some View {
    NavigationStack {
      Group {
        if !isGuest, let account = session.account,
          let appAccountToken = UUID(uuidString: account.user.id)
        {
          SubscriptionView(appAccountToken: appAccountToken)
        } else {
          ScrollView {
            SubscriptionMarketingContent(freePlan: settings.freePlan, hasAccount: false)
              .scenePadding()
          }
          .loads(settings.freePlan, refreshable: false)
          .safeAreaBar(edge: .bottom) {
            Button {
              router.present(.signIn)
            } label: {
              if isGuest {
                Text(
                  "Create an account", tableName: "Account",
                  comment: "Asks a guest to create an account before subscribing")
              } else {
                Text(
                  "Log in", tableName: "Account",
                  comment: "Asks a visitor to log in before subscribing")
              }
            }
            .buttonStyle(.mainAction)
            .controlSize(.large)
            .scenePadding()
            .keepsOffFold()
          }
        }
      }
      .toolbar {
        ToolbarItem(placement: .cancellationAction) {
          Button(role: .close) {
            dismiss()
          }
        }
      }
    }
  }

  private var isGuest: Bool {
    learner.summary.value?.identity.isAnonymous == true
  }
}

struct SubscriptionView: View {
  @Environment(AppStoreSubscriptionStore.self) private var subscriptions
  @Environment(SessionStore.self) private var session
  @Environment(SettingsStore.self) private var settings

  let appAccountToken: UUID

  var body: some View {
    SubscriptionStoreView(productIDs: AppStoreSubscriptionProduct.productIDs) {
      SubscriptionMarketingContent(
        allowance: settings.allowance.value, freePlan: settings.freePlan, hasAccount: true)
    }
    .subscriptionStoreControlStyle(.prominentPicker)
    .subscriptionStoreButtonLabel(.multiline)
    .storeButton(.hidden, for: .cancellation)
    .storeButton(.hidden, for: .restorePurchases)
    .storeButton(.visible, for: .policies)
    .subscriptionStorePolicyDestination(url: AccountLinks.terms, for: .termsOfService)
    .subscriptionStorePolicyDestination(url: AccountLinks.privacy, for: .privacyPolicy)
    .inAppPurchaseOptions { _ in
      [.appAccountToken(appAccountToken)]
    }
    .onInAppPurchaseCompletion { _, result in
      _ = await subscriptions.handlePurchase(
        StoreKitSubscriptionClient.purchaseOutcome(from: result),
        synchronizationScope: session.account?.user.id
      ) { signedTransaction, expectedAccountID in
        await session.synchronizeAppleSubscription(
          signedTransaction: signedTransaction,
          expectedAccountID: expectedAccountID)
      }
    }
    .loads(settings.allowance, settings.freePlan, refreshable: false)
    .navigationTitle(
      Text(
        "Zoonk Plus",
        tableName: "Account",
        comment: "Title of the native Zoonk Plus subscription screen")
    )
    .toolbarTitleDisplayMode(.inline)
    .toolbar {
      ToolbarItem(placement: .bottomBar) {
        restorePurchasesButton
      }
    }
    .alert(isPresented: alertIsPresented) {
      Alert(
        title: alertTitle,
        message: alertMessage,
        dismissButton: .default(
          Text(
            "OK",
            tableName: "Account",
            comment: "Dismisses a subscription status message")
        ) {
          subscriptions.clearAlert()
        })
    }
  }

  private var alertIsPresented: Binding<Bool> {
    Binding(
      get: { subscriptions.alert != nil },
      set: { isPresented in
        if !isPresented {
          subscriptions.clearAlert()
        }
      })
  }

  private var restorePurchasesButton: some View {
    Button {
      Task {
        await subscriptions.restorePurchases(
          synchronizationScope: session.account?.user.id
        ) { signedTransaction, expectedAccountID in
          await session.synchronizeAppleSubscription(
            signedTransaction: signedTransaction,
            expectedAccountID: expectedAccountID)
        }
      }
    } label: {
      HStack(spacing: 8) {
        if subscriptions.isRestoring {
          ProgressView()
            .controlSize(.small)
        } else {
          Image(systemName: "arrow.clockwise")
        }

        Text(
          "Restore Purchases",
          tableName: "Account",
          comment: "Restores App Store purchases and synchronizes them with the Zoonk account")
      }
    }
    .disabled(subscriptions.isRestoring)
  }

  private var alertTitle: Text {
    switch subscriptions.alert {
    case .accountMismatch:
      Text(
        "Purchase linked to another account",
        tableName: "Account",
        comment: "Title shown when an App Store purchase belongs to another Zoonk account")
    case .authenticationRequired:
      Text(
        "Sign in again",
        tableName: "Account",
        comment: "Title shown when subscription synchronization requires authentication")
    case .invalidPurchase:
      Text(
        "Purchase couldn't be linked",
        tableName: "Account",
        comment: "Title shown when Zoonk cannot accept a verified App Store purchase")
    case .noActiveSubscriptionFound:
      Text(
        "No active subscription found",
        tableName: "Account",
        comment: "Title shown when restored App Store purchases do not currently provide Plus")
    case .noPurchasesFound:
      Text(
        "No purchases found",
        tableName: "Account",
        comment: "Title shown when restore finds no eligible App Store purchases")
    case .purchaseFailed:
      Text(
        "Purchase not completed",
        tableName: "Account",
        comment: "Title shown when an App Store purchase fails")
    case .purchasesRestored:
      Text(
        "Purchases restored",
        tableName: "Account",
        comment: "Title shown when App Store purchases were restored")
    case .restoreFailed:
      Text(
        "Couldn't restore purchases",
        tableName: "Account",
        comment: "Title shown when restoring App Store purchases fails")
    case .synchronizationFailed:
      Text(
        "Couldn't update your account",
        tableName: "Account",
        comment: "Title shown when a verified App Store transaction could not reach Zoonk")
    case .verificationFailed:
      Text(
        "Purchase couldn't be verified",
        tableName: "Account",
        comment: "Title shown when StoreKit cannot verify a purchase")
    case nil:
      Text(verbatim: "")
    }
  }

  private var alertMessage: Text? {
    switch subscriptions.alert {
    case .accountMismatch:
      Text(
        "Sign in to the Zoonk account that owns this App Store purchase, or contact support for help.",
        tableName: "Account",
        comment: "Recovery guidance when an App Store purchase belongs to another Zoonk account")
    case .authenticationRequired:
      Text(
        "Your purchase is safe. Sign in, then restore purchases to add Plus to your Zoonk account.",
        tableName: "Account",
        comment: "Explains how to recover a purchase after the Zoonk session expires")
    case .invalidPurchase:
      Text(
        "Check your App Store purchase history, then contact support for help.",
        tableName: "Account",
        comment: "Recovery guidance when Zoonk cannot accept a verified App Store purchase")
    case .noActiveSubscriptionFound:
      Text(
        "Zoonk checked your App Store purchases, but none currently provide Plus.",
        tableName: "Account",
        comment: "Explains that restored App Store purchases do not grant an active subscription")
    case .noPurchasesFound:
      Text(
        "Make sure you're signed in with the Apple Account used for the purchase, then try again.",
        tableName: "Account",
        comment: "Recovery guidance when restore finds no eligible App Store purchases")
    case .purchaseFailed:
      Text(
        "The App Store couldn't complete this purchase. Check your connection and try again.",
        tableName: "Account",
        comment: "Recovery guidance after an App Store purchase fails")
    case .purchasesRestored:
      Text(
        "Your App Store purchases are now available on this Zoonk account.",
        tableName: "Account",
        comment: "Confirms restored purchases were synchronized with Zoonk")
    case .restoreFailed:
      Text(
        "Check your connection and try restoring again.",
        tableName: "Account",
        comment: "Recovery guidance after restoring App Store purchases fails")
    case .synchronizationFailed:
      Text(
        "Your purchase is safe and hasn't been finished yet. Restore purchases when you're back online.",
        tableName: "Account",
        comment: "Explains that a transaction remains available after server synchronization fails")
    case .verificationFailed:
      Text(
        "Check your App Store purchase history, then contact support if you need help.",
        tableName: "Account",
        comment: "Recovery guidance after StoreKit transaction verification fails")
    case nil:
      nil
    }
  }
}

private struct SubscriptionMarketingContent: View {
  var allowance: PlanAllowance?
  let freePlan: Resource<FreePlan>
  /// A visitor or guest starts free without one.
  let hasAccount: Bool

  var body: some View {
    VStack(alignment: .leading, spacing: 24) {
      VStack(alignment: .leading, spacing: 8) {
        Text(
          "Subscribe to Zoonk Plus",
          tableName: "Account",
          comment: "Headline on the Zoonk Plus subscription screen"
        )
        .font(.largeTitle.bold())

        Text(
          "Every goal · every lesson",
          tableName: "Account",
          comment: "What Zoonk Plus includes, in one line"
        )
        .font(.title3)
        .foregroundStyle(.secondary)
      }

      PlusBenefits()

      if let allowance, allowance.tier == .free {
        GroupBox {
          VStack(alignment: .leading, spacing: 2) {
            Text("Free", tableName: "Account", comment: "The free plan's name")

            if let limit = allowance.buddyMessagesDailyLimit {
              Text(
                "\(Text(allowance.buddyMessagesToday, format: .number).monospacedDigit())/\(Text(limit, format: .number).monospacedDigit()) buddy messages used today",
                tableName: "Account",
                comment:
                  "A free plan's buddy messages used today, as in “3/5 buddy messages used today”"
              )
              .font(.subheadline)
              .foregroundStyle(.secondary)
            }
          }
          .frame(maxWidth: .infinity, alignment: .leading)
        } label: {
          Text(
            "Your plan", tableName: "Account",
            comment: "Section with the learner's subscription plan, Free or Plus")
        }
      }

      switch freePlan.state {
      case .loaded(let limits):
        FreePlanIncludes(limits: limits)
        PlusQuestions(limits: limits, hasAccount: hasAccount)
      case .failed, .empty:
        VStack(alignment: .leading, spacing: 8) {
          Text(
            "We couldn't load what the free plan includes.", tableName: "Account",
            comment: "The free plan's limits failed to load on the Plus screen"
          )
          .foregroundStyle(.secondary)

          Button {
            Task { await freePlan.refresh() }
          } label: {
            Text("Try again", tableName: "Account", comment: "Loads the free plan's limits again")
          }
          .buttonStyle(.bordered)
        }
      case .idle, .loading:
        EmptyView()
      }
    }
    .frame(maxWidth: 560, alignment: .leading)
    .frame(maxWidth: .infinity)
    .padding(.horizontal)
  }

}

/// What Zoonk Plus includes, as main's `PlusBenefits` lists it.
struct PlusBenefits: View {
  var body: some View {
    VStack(alignment: .leading, spacing: 12) {
      benefit(
        Text(
          "Your whole exam plan, every day to the exam", tableName: "Account",
          comment: "Zoonk Plus benefit: the full exam plan"))
      benefit(
        Text(
          "Mock exams, timed like the real one", tableName: "Account",
          comment: "Zoonk Plus benefit: timed mock exams"))
      benefit(
        Text(
          "An AI study buddy whenever you're stuck", tableName: "Account",
          comment: "Zoonk Plus benefit: the study buddy"))
      benefit(
        Text(
          "Higher limits for speaking calls", tableName: "Account",
          comment: "Zoonk Plus benefit: more speaking call time, never a number"))
    }
  }

  private func benefit(_ title: Text) -> some View {
    Label {
      title
    } icon: {
      Image(systemName: "checkmark")
        .foregroundStyle(.secondary)
    }
  }
}

/// Main's current plan for a subscription Zoonk manages: the stores' own are managed in the
/// stores.
struct PlusStatusView: View {
  let subscription: AccountSubscription

  var body: some View {
    List {
      Section {
        VStack(alignment: .leading, spacing: 6) {
          HStack(spacing: 8) {
            Text("Plus", tableName: "Account", comment: "Zoonk Plus, the plan's name")
              .font(.title.bold())

            Group {
              subscription.cancelAt == nil
                ? Text("Active", tableName: "Account", comment: "Status for an active subscription")
                : Text(
                  "Subscription ending", tableName: "Account",
                  comment: "A subscription set to end")
            }
            .chip()
          }

          if let dateLine {
            dateLine
              .foregroundStyle(.secondary)
          }
        }
        .listRowBackground(Color.clear)
      }

      Section {
        PlusBenefits()
      } header: {
        Text(
          "Every goal · every lesson", tableName: "Account",
          comment: "What Zoonk Plus includes, in one line")
      }

      Section {
        Link(destination: AccountLinks.support) {
          Text("Contact support", tableName: "Account", comment: "Opens Zoonk's support")
        }
      } footer: {
        Text(
          "This subscription is managed by Zoonk. Contact support if you need help changing or canceling it.",
          tableName: "Account", comment: "Where a subscription Zoonk manages is changed")
      }
    }
    .navigationTitle(
      Text("Subscription", tableName: "Account", comment: "Account option for subscription")
    )
    .toolbarTitleDisplayMode(.inline)
  }

  private var dateLine: Text? {
    let date: (Date) -> String = { $0.formatted(date: .abbreviated, time: .omitted) }

    if let cancelAt = subscription.cancelAt {
      return Text(
        "Your subscription will end on \(date(cancelAt)).", tableName: "Account",
        comment: "When a subscription set to end ends")
    }

    guard let periodEnd = subscription.periodEnd else {
      return nil
    }

    return subscription.provider == "stripe"
      ? Text(
        "Renews on \(date(periodEnd)).", tableName: "Account",
        comment: "When a web subscription renews")
      : Text(
        "Current billing period ends on \(date(periodEnd)).", tableName: "Account",
        comment: "When the subscription's paid period ends")
  }
}

/// Main's Free card: what the free plan includes, against Plus above it.
private struct FreePlanIncludes: View {
  let limits: FreePlan

  var body: some View {
    GroupBox {
      VStack(alignment: .leading, spacing: 12) {
        if let goals = limits.activeGoals, let lessons = limits.lessonsPerMonth {
          Text(
            verbatim: [
              String(
                localized: "\(goals) goals", table: "Account",
                comment: "How many goals the free plan has at a time"),
              String(
                localized: "\(lessons) lessons a month", table: "Account",
                comment: "Free plan: lessons a month"),
            ].joined(separator: " · ")
          )
          .font(.subheadline)
          .foregroundStyle(.secondary)
        }

        item(
          Text(
            "A plan for your goal and your date", tableName: "Account",
            comment: "Free plan: a plan for the learner's goal"))

        if let days = limits.examPrepDays {
          item(
            days == 7
              ? Text(
                "For an exam: the diagnostic, your plan and its first week", tableName: "Account",
                comment: "Free plan: how much of an exam plan it includes")
              : Text(
                "For an exam: the diagnostic, your plan and its first \(days) days",
                tableName: "Account", comment: "Free plan: how much of an exam plan it includes"))
        }

        if let messages = limits.tutorMessagesPerDay {
          item(
            Text(
              "An AI study buddy: \(messages) messages a day", tableName: "Account",
              comment: "Free plan: the study buddy's daily messages"))
        }

        item(
          Text(
            "Speaking practice calls, with lower limits than Plus", tableName: "Account",
            comment: "Free plan: practice calls, never a number"))
      }
      .frame(maxWidth: .infinity, alignment: .leading)
    } label: {
      Text("Free", tableName: "Account", comment: "The free plan's name")
    }
  }

  private func item(_ title: Text) -> some View {
    Label {
      title
    } icon: {
      Image(systemName: "checkmark")
        .foregroundStyle(.secondary)
    }
  }
}

/// Main's pricing questions.
private struct PlusQuestions: View {
  let limits: FreePlan
  let hasAccount: Bool

  var body: some View {
    VStack(alignment: .leading, spacing: 12) {
      Text("Common questions", tableName: "Account", comment: "Title of the pricing questions")
        .font(.title3.bold())

      DisclosureGroup {
        freePlanAnswer
      } label: {
        Text("What's in the free plan?", tableName: "Account", comment: "A pricing question")
      }

      DisclosureGroup {
        answer(
          Text(
            "Almost. Lessons, goals and your buddy have limits only to stop bots and automated tools, not people learning. Speaking calls have daily and monthly limits, higher than on the free plan.",
            tableName: "Account", comment: "Answers whether Plus is unlimited, never in minutes"))

        Link(destination: AccountLinks.fairUse) {
          Text(
            "Read our fair use policy", tableName: "Account", comment: "Opens the fair use policy")
        }
      } label: {
        Text("Is Plus really unlimited?", tableName: "Account", comment: "A pricing question")
      }

      DisclosureGroup {
        answer(
          Text(
            "You keep Plus until the end of the period you already paid for. Then you're back on the free plan, and your goals and progress stay with you.",
            tableName: "Account", comment: "Answers what canceling Plus does"))
      } label: {
        Text("What happens if I cancel?", tableName: "Account", comment: "A pricing question")
      }

      DisclosureGroup {
        answer(
          Text(
            "Just contact us and tell us what happened. We'll do our best to get you a refund.",
            tableName: "Account", comment: "Answers whether Plus can be refunded"))

        Link(destination: AccountLinks.support) {
          Text("Contact support", tableName: "Account", comment: "Opens Zoonk's support")
        }
      } label: {
        Text("Can I get a refund?", tableName: "Account", comment: "A pricing question")
      }
    }
  }

  @ViewBuilder
  private var freePlanAnswer: some View {
    if !hasAccount, let guestLessons = limits.guestLessons {
      answer(
        Text(
          "Start free with \(guestLessons) lessons, no account needed. With a free account, you get:",
          tableName: "Account", comment: "Leads the free plan's list for someone without an account"
        ))
    } else {
      answer(
        Text(
          "With the free plan, you get:", tableName: "Account",
          comment: "Leads the free plan's list"))
    }

    VStack(alignment: .leading, spacing: 6) {
      if let goals = limits.activeGoals {
        bullet(
          Text(
            "\(goals) goals at a time", tableName: "Account",
            comment: "Free plan: goals at a time"))
      }

      if let month = limits.lessonsPerMonth {
        bullet(
          Text(
            "\(month) lessons a month", tableName: "Account",
            comment: "Free plan: lessons a month"))
      }

      if let day = limits.lessonsPerDay {
        bullet(
          Text(
            "Up to \(day) lessons a day", tableName: "Account", comment: "Free plan: lessons a day")
        )
      }

      if let days = limits.examPrepDays {
        bullet(
          days == 7
            ? Text(
              "The first week of exam prep", tableName: "Account",
              comment: "Free plan: how much of an exam plan it includes")
            : Text(
              "The first \(days) days of exam prep", tableName: "Account",
              comment: "Free plan: how much of an exam plan it includes"))
      }

      if let messages = limits.tutorMessagesPerDay {
        bullet(
          Text(
            "\(messages) messages to your buddy a day", tableName: "Account",
            comment: "Free plan: the study buddy's daily messages"))
      }

      if let uploads = limits.uploadsPerDay {
        bullet(
          Text(
            "\(uploads) uploads a day", tableName: "Account", comment: "Free plan: daily uploads"))
      }

      bullet(
        Text(
          "Practice calls, with lower limits than Plus (exam speaking tasks come with Plus)",
          tableName: "Account", comment: "Free plan: practice calls, never a number"))
    }
  }

  private func answer(_ text: Text) -> some View {
    text
      .foregroundStyle(.secondary)
      .frame(maxWidth: .infinity, alignment: .leading)
  }

  private func bullet(_ text: Text) -> some View {
    Label {
      text
    } icon: {
      Image(systemName: "circle.fill")
        .imageScale(.small)
        .font(.caption2)
    }
    .foregroundStyle(.secondary)
  }
}
