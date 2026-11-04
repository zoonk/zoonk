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
            SubscriptionMarketingContent(
              freePlan: settings.freePlan, viewer: isGuest ? .guest : .visitor
            )
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
          .navigationTitle(Text.zoonkPlus)
          .toolbarTitleDisplayMode(.inline)
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
  @State private var openedPlan: AccountSubscription?
  @State private var boughtHere = false

  let appAccountToken: UUID

  var body: some View {
    Group {
      switch page {
      case .offer:
        if let unpaid {
          UnpaidPlusView(web: unpaid)
        } else {
          offer
        }
      case .plan(let plan, let refusesPurchase):
        PlusStatusView(subscription: plan, refusesPurchase: refusesPurchase)
      }
    }
    // Plus bought elsewhere since the account was read must show as the plan, not as an offer to
    // pay twice.
    .loads(settings.webPlus, refreshable: false)
    .task {
      await session.reconcileSynchronizedCredential()
      openedPlan = session.account?.account.subscription
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

  /// Without Plus, a website renewal that couldn't be charged replaces the offer, as on main.
  private var unpaid: WebPlus? {
    guard session.account?.account.subscription == nil, let web = settings.webPlus.value,
      web.state == .unpaid
    else {
      return nil
    }

    return web
  }

  private var page: SubscriptionPage {
    SubscriptionPage(
      current: session.account?.account.subscription, openedPlan: openedPlan,
      boughtHere: boughtHere)
  }

  private var offer: some View {
    SubscriptionStoreView(productIDs: AppStoreSubscriptionProduct.productIDs) {
      SubscriptionMarketingContent(
        allowance: settings.allowance.value, freePlan: settings.freePlan,
        viewer: settings.allowance.value?.tier == .free ? .free : .subscribed)
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
    .onInAppPurchaseStart { product in
      boughtHere = true
      UsageAnalytics.track(.subscriptionCheckoutStarted(.init(productID: product.id)))
    }
    .onInAppPurchaseCompletion { _, result in
      boughtHere = await subscriptions.handlePurchase(
        StoreKitSubscriptionClient.purchaseOutcome(from: result),
        owner: { session.subscriptionOwner },
        synchronize: { signedTransaction, expectedAccountID in
          await session.synchronizeAppleSubscription(
            signedTransaction: signedTransaction,
            expectedAccountID: expectedAccountID)
        })
    }
    .loads(settings.allowance, settings.freePlan, refreshable: false)
    .navigationTitle(Text.zoonkPlus)
    .toolbarTitleDisplayMode(.inline)
    .toolbar {
      ToolbarItem(placement: .bottomBar) {
        restorePurchasesButton
      }
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
          owner: { session.subscriptionOwner },
          synchronize: { signedTransaction, expectedAccountID in
            await session.synchronizeAppleSubscription(
              signedTransaction: signedTransaction,
              expectedAccountID: expectedAccountID)
          })
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

/// A learner with Plus from any store or the web gets their plan instead of the App Store's offer,
/// so nobody pays twice.
enum SubscriptionPage: Equatable {
  case offer
  /// `refusesPurchase`: they came to buy Plus they already have.
  case plan(AccountSubscription, refusesPurchase: Bool)

  /// `openedPlan`, Plus as the account read when the screen opened, keeps its plan on screen when
  /// that Plus ends there, as a refund does, so the result shows. Plus that a purchase started here
  /// brings is no second purchase to refuse.
  init(current: AccountSubscription?, openedPlan: AccountSubscription?, boughtHere: Bool) {
    if let plan = current ?? openedPlan {
      self = .plan(plan, refusesPurchase: !boughtHere)
    } else {
      self = .offer
    }
  }
}

extension Text {
  fileprivate static var zoonkPlus: Text {
    Text(
      "Zoonk Plus",
      tableName: "Account",
      comment: "Title of the native Zoonk Plus subscription screen")
  }
}

/// Who decides on Plus, as main's `PlusViewerState`: a guest has a session but no account.
private enum PlusViewer {
  case visitor
  case guest
  case free
  case subscribed
}

private struct SubscriptionMarketingContent: View {
  var allowance: PlanAllowance?
  let freePlan: Resource<FreePlan>
  let viewer: PlusViewer

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
          "Every goal\u{00A0}· every lesson",
          tableName: "Account",
          comment: "What Zoonk Plus includes, in one line"
        )
        .font(.title3)
        .foregroundStyle(.mutedForeground)
      }

      PlusBenefits()

      switch freePlan.state {
      case .loaded(let limits):
        if viewer != .subscribed {
          FreePlanCard(limits: limits, viewer: viewer, allowance: allowance)
        }

        PlusQuestions(limits: limits, viewer: viewer)
      case .failed, .empty:
        VStack(alignment: .leading, spacing: 8) {
          Text(
            "We couldn't load what the free plan includes.", tableName: "Account",
            comment: "The free plan's limits failed to load on the Plus screen"
          )
          .foregroundStyle(.mutedForeground)

          Button {
            Task { await freePlan.refresh() }
          } label: {
            Text("Try again", tableName: "Account", comment: "Loads the free plan's limits again")
          }
          .buttonStyle(.outline)
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
        .foregroundStyle(.mutedForeground)
        .accessibilityHidden(true)
    }
  }
}

/// Main's current plan. A website plan shows its own state: under a store purchase it's a section
/// of its own, since the store's controls can't change it.
struct PlusStatusView: View {
  @Environment(SessionStore.self) private var session
  @Environment(SettingsStore.self) private var settings
  @Environment(AppStoreSubscriptionStore.self) private var subscriptions
  @State private var isAppStoreManagementPresented = false

  /// As it was when the screen opened, until the account says otherwise.
  let opened: AccountSubscription

  let refusesPurchase: Bool

  init(subscription: AccountSubscription, refusesPurchase: Bool = false) {
    opened = subscription
    self.refusesPurchase = refusesPurchase
  }

  private var subscription: AccountSubscription {
    session.account?.account.subscription ?? opened
  }

  private var isWebsite: Bool {
    subscription.provider == "stripe"
  }

  private var web: WebPlus? {
    settings.webPlus.value
  }

  var body: some View {
    List {
      Section {
        VStack(alignment: .leading, spacing: 6) {
          HStack(spacing: 8) {
            Text("Plus", tableName: "Account", comment: "Zoonk Plus, the plan's name")
              .font(.title.bold())

            Group {
              isEnding
                ? Text(
                  "Subscription ending", tableName: "Account",
                  comment: "A subscription set to end")
                : Text("Active", tableName: "Account", comment: "Status for an active subscription")
            }
            .chip()
          }

          if refusesPurchase {
            alreadyHasPlus
          }

          if let dateLine {
            dateLine
              .foregroundStyle(.mutedForeground)
          }
        }
        .listRowBackground(Color.clear)
      }

      Section {
        PlusBenefits()
      } header: {
        SectionTitle(
          Text(
            "Every goal\u{00A0}· every lesson", tableName: "Account",
            comment: "What Zoonk Plus includes, in one line"))
      }

      if isWebsite {
        if let web {
          WebPlusSection(web: web, beside: false)
        }
      } else {
        managedSection

        if let web {
          WebPlusSection(web: web, beside: true)
        }
      }
    }
    .zoonkList()
    .loads(settings.webPlus, refreshable: false)
    .refreshable {
      await reloadPlan()
    }
    .manageSubscriptionsSheet(isPresented: $isAppStoreManagementPresented)
    .onChange(of: isAppStoreManagementPresented) { _, isPresented in
      if !isPresented {
        Task { await reloadPlan() }
      }
    }
    .navigationTitle(
      Text("Subscription", tableName: "Account", comment: "Account option for subscription")
    )
    .toolbarTitleDisplayMode(.inline)
  }

  /// Apple's own settings change a renewal without a purchase, so its entitlement goes through the
  /// sync a purchase does, which reads the renewal from Apple.
  private func reloadPlan() async {
    async let web: Void = settings.webPlus.refresh()

    await subscriptions.reconcileCurrentEntitlements(
      synchronizationScope: session.account?.user.id
    ) { signedTransaction, expectedAccountID in
      await session.synchronizeAppleSubscription(
        signedTransaction: signedTransaction, expectedAccountID: expectedAccountID)
    }

    await session.reconcileSynchronizedCredential()
    await web
  }

  /// Main and Android say the same.
  private var alreadyHasPlus: Text {
    switch subscription.provider {
    case "apple":
      Text(
        "You already have Plus through the App Store.", tableName: "Account",
        comment:
          "Shown instead of buying Plus to someone who already bought it in the App Store, so they don't pay twice"
      )
    case "google":
      Text(
        "You already have Plus through Google Play.", tableName: "Account",
        comment:
          "Shown instead of buying Plus to someone who already bought it on Google Play, so they don't pay twice"
      )
    case "stripe":
      Text(
        "You already have Plus through the Zoonk website.", tableName: "Account",
        comment:
          "Shown instead of buying Plus to someone who already bought it on Zoonk's website, so they don't pay twice"
      )
    default:
      Text(
        "You already have Plus.", tableName: "Account",
        comment:
          "Shown instead of buying Plus to someone who already has it, so they don't pay twice")
    }
  }

  private var isEnding: Bool {
    isWebsite ? web?.state == .ending : subscription.endsAt != nil
  }

  private var dateLine: Text? {
    guard !isWebsite else {
      return web?.dateLine
    }

    if let endsAt = subscription.endsAt {
      return Text(
        "Your subscription will end on \(day(endsAt)).", tableName: "Account",
        comment: "When a subscription set to end ends")
    }

    return subscription.periodEnd.map {
      Text(
        "Current billing period ends on \(day($0)).", tableName: "Account",
        comment: "When the subscription's paid period ends")
    }
  }

  /// Main's `ManagedSubscription`: the stores' own controls change a store purchase.
  private var managedSection: some View {
    Section {
      if StoreSubscriptionProvider(rawValue: subscription.provider) == .apple {
        Button {
          isAppStoreManagementPresented = true
        } label: {
          Text(
            "Manage in App Store", tableName: "Account",
            comment:
              "Button that opens Apple's subscription settings for Plus bought in the App Store")
        }
      }

      Link(destination: AccountLinks.support) {
        Text("Contact support", tableName: "Account", comment: "Opens Zoonk's support")
      }
    } footer: {
      SectionFooter {
        switch StoreSubscriptionProvider(rawValue: subscription.provider) {
        case .apple:
          Text(
            "This subscription is managed through the App Store. To change or cancel it, use Apple's subscription settings.",
            tableName: "Account", comment: "Where Plus bought in the App Store is changed")
        case .google:
          Text(
            "Use Google Play on an Android device to change or cancel this subscription.",
            tableName: "Account",
            comment:
              "Explains how to manage a Google-owned subscription without linking to external purchasing"
          )
        case nil:
          Text(
            "This subscription is managed by Zoonk. Contact support if you need help changing or canceling it.",
            tableName: "Account", comment: "Where a subscription Zoonk manages is changed")
        }
      }
    }
  }
}

/// Main's page for a website renewal that couldn't be charged, in place of the offer.
private struct UnpaidPlusView: View {
  let web: WebPlus

  var body: some View {
    List {
      Section {
        VStack(alignment: .leading, spacing: 6) {
          Text("Plus", tableName: "Account", comment: "Zoonk Plus, the plan's name")
            .font(.title.bold())

          if let dateLine = web.dateLine {
            dateLine
              .foregroundStyle(.mutedForeground)
          }
        }
        .listRowBackground(Color.clear)
      }

      WebPlusSection(web: web, beside: false)
    }
    .zoonkList()
    .navigationTitle(Text.zoonkPlus)
    .toolbarTitleDisplayMode(.inline)
  }
}

/// Main's `CancelPlusButton` and `KeepPlusButton`. Beside a store purchase it's titled and says
/// its own date.
private struct WebPlusSection: View {
  @Environment(SettingsStore.self) private var settings
  @State private var isConfirmingCancel = false
  @State private var failed = false
  @State private var change: Task<Void, Never>?

  let web: WebPlus
  let beside: Bool

  var body: some View {
    Section {
      if beside, let dateLine = web.dateLine {
        dateLine
          .foregroundStyle(.mutedForeground)
      }

      if web.state == .ending {
        Button {
          run { await settings.keepWebPlus() }
        } label: {
          WorkingLabel(
            title: Text(
              "Keep Plus", tableName: "Account",
              comment:
                "Turns the stopped renewal of Plus bought on the web back on, so it renews as before"
            ),
            isWorking: change != nil)
        }
        .disabled(change != nil)
      } else {
        Button {
          failed = false
          isConfirmingCancel = true
        } label: {
          WorkingLabel(
            title: Text(
              "Cancel Plus", tableName: "Account",
              comment:
                "Cancels Plus bought on the web: the button, and the confirmation in its dialog"),
            isWorking: change != nil)
        }
        .disabled(change != nil)
        .confirmationDialog(
          Text(
            "Cancel Plus?", tableName: "Account", comment: "Title of the dialog that cancels Plus"),
          isPresented: $isConfirmingCancel,
          titleVisibility: .visible
        ) {
          Button(role: .destructive) {
            run { await settings.cancelWebPlus() }
          } label: {
            Text(
              "Cancel Plus", tableName: "Account",
              comment:
                "Cancels Plus bought on the web: the button, and the confirmation in its dialog")
          }

          Button(role: .cancel) {
          } label: {
            Text(
              "Go back", tableName: "Account",
              comment: "Closes the dialog that cancels Plus without canceling it")
          }
        } message: {
          if web.state == .unpaid {
            Text(
              "Plus ends right away, and we stop retrying your renewal payment.",
              tableName: "Account",
              comment:
                "In the dialog that cancels Plus bought on the web whose renewal payment failed")
          } else {
            Text(
              "You keep Plus until the end of the period you already paid for.",
              tableName: "Account", comment: "In the dialog that cancels Plus bought on the web")
          }
        }
      }
    } header: {
      if beside {
        SectionTitle(
          Text(
            "Website subscription", tableName: "Account",
            comment: "Plus bought on the website, shown beside a store purchase"))
      }
    } footer: {
      SectionFooter {
        footer
      }
    }
  }

  @ViewBuilder
  private var footer: some View {
    if web.state == .ending {
      VStack(alignment: .leading, spacing: 8) {
        Text(
          "Changed your mind? Keep Plus, and it renews as before.", tableName: "Account",
          comment:
            "Under the button that turns the stopped renewal of Plus bought on the web back on")

        if failed {
          Text(
            "We couldn't keep Plus. Try again or email hello@zoonk.com.",
            tableName: "Account",
            comment: "Turning the stopped renewal of Plus bought on the web back on failed"
          )
          .foregroundStyle(.destructiveText)
        }
      }
    } else if failed {
      Text(
        "We couldn't cancel Plus. Try again or email \(AttributedString.supportEmail).",
        tableName: "Account",
        comment:
          "Canceling Plus bought on the web failed; the argument is the email address to write to"
      )
      .foregroundStyle(.destructiveText)
    }
  }

  private func run(_ write: @escaping () async -> Bool) {
    failed = false
    change = Task {
      failed = !(await write())
      change = nil
    }
  }
}

extension WebPlus {
  /// Main's `getWebDateLine`.
  fileprivate var dateLine: Text? {
    if state == .unpaid {
      return Text(
        "Your last renewal payment failed.", tableName: "Account",
        comment: "Plus bought on the web whose renewal payment couldn't be charged")
    }

    return periodEnd.map {
      state == .ending
        ? Text(
          "Your subscription will end on \(day($0)).", tableName: "Account",
          comment: "When a subscription set to end ends")
        : Text(
          "Renews on \(day($0)).", tableName: "Account", comment: "When a web subscription renews")
    }
  }
}

private func day(_ date: Date) -> String {
  date.formatted(date: .abbreviated, time: .omitted)
}

private struct WorkingLabel: View {
  let title: Text
  let isWorking: Bool

  var body: some View {
    HStack {
      title

      Spacer()

      if isWorking {
        ProgressView()
      }
    }
  }
}

/// Main's Free card: what the free plan includes, against Plus above it.
private struct FreePlanCard: View {
  @Environment(AppRouter.self) private var router

  let limits: FreePlan
  let viewer: PlusViewer
  let allowance: PlanAllowance?

  var body: some View {
    GroupBox {
      VStack(alignment: .leading, spacing: 12) {
        switch viewer {
        case .guest:
          VStack(alignment: .leading, spacing: 8) {
            Button {
              router.present(.signIn)
            } label: {
              Text(
                "Create a free account", tableName: "Account",
                comment: "Opens sign-up from the free plan's card for a guest"
              )
              .frame(maxWidth: .infinity)
            }
            .buttonStyle(.outline)
            .controlSize(.large)

            note(
              Text(
                "No card needed.", tableName: "Account",
                comment: "Under the free plan's sign-up button; card means a payment card"
              ))
          }

          Divider()
        case .free:
          VStack(alignment: .leading, spacing: 4) {
            Text(
              "Your current plan", tableName: "Account",
              comment: "On the free plan's card for a learner already on it")

            if let allowance, let limit = allowance.buddyMessagesDailyLimit {
              note(
                Text(
                  "\(Text(allowance.buddyMessagesToday, format: .number).monospacedDigit())/\(Text(limit, format: .number).monospacedDigit()) buddy messages used today",
                  tableName: "Account",
                  comment:
                    "A free plan's buddy messages used today, as in “3/5 buddy messages used today”"
                ))
            }
          }

          Divider()
        case .visitor, .subscribed:
          EmptyView()
        }

        if let goals = limits.activeGoals, let lessons = limits.lessonsPerMonth {
          Text(
            verbatim: [
              String(
                localized: "\(goals) goals", table: "Account",
                comment: "How many goals the free plan has at a time"),
              String(
                localized: "\(lessons) lessons a month", table: "Account",
                comment: "Free plan: lessons a month"),
            ].joinedFacts()
          )
          .font(.subheadline)
          .foregroundStyle(.mutedForeground)
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

  private func note(_ text: Text) -> some View {
    text
      .font(.footnote)
      .foregroundStyle(.mutedForeground)
  }

  private func item(_ title: Text) -> some View {
    Label {
      title
    } icon: {
      Image(systemName: "checkmark")
        .foregroundStyle(.mutedForeground)
        .accessibilityHidden(true)
    }
  }
}

/// Main's pricing questions.
private struct PlusQuestions: View {
  let limits: FreePlan
  let viewer: PlusViewer

  var body: some View {
    VStack(alignment: .leading, spacing: 12) {
      VStack(alignment: .leading, spacing: 4) {
        Text("Common questions", tableName: "Account", comment: "Title of the pricing questions")
          .font(.title3.bold())

        Text(
          "Still unsure? \(AttributedString.supportEmail)", tableName: "Account",
          comment:
            "Under the pricing questions' title; the argument is the email address to write to"
        )
        .font(.subheadline)
        .foregroundStyle(.mutedForeground)
      }

      DisclosureGroup {
        freePlanAnswer
      } label: {
        question(
          Text("What's in the free plan?", tableName: "Account", comment: "A pricing question"))
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
        question(
          Text("Is Plus really unlimited?", tableName: "Account", comment: "A pricing question"))
      }

      DisclosureGroup {
        answer(
          Text(
            "You keep Plus until the end of the period you already paid for. Then you're back on the free plan, and your goals and progress stay with you.",
            tableName: "Account", comment: "Answers what canceling Plus does"))
      } label: {
        question(
          Text("What happens if I cancel?", tableName: "Account", comment: "A pricing question"))
      }

      DisclosureGroup {
        answer(
          Text(
            "Write to us at \(AttributedString.supportEmail) and we'll look into it. Purchases in the App Store or Google Play follow Apple's or Google's refund rules.",
            tableName: "Account",
            comment:
              "Answers whether Plus can be refunded; the argument is the email address to write to"
          ))
      } label: {
        question(Text("Can I get a refund?", tableName: "Account", comment: "A pricing question"))
      }
    }
  }

  @ViewBuilder
  private var freePlanAnswer: some View {
    if viewer == .visitor || viewer == .guest, let guestLessons = limits.guestLessons {
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

  /// A disclosure's label is a button, which centers a wrapped line.
  private func question(_ text: Text) -> some View {
    text.multilineTextAlignment(.leading)
  }

  private func answer(_ text: Text) -> some View {
    text
      .foregroundStyle(.mutedForeground)
      .frame(maxWidth: .infinity, alignment: .leading)
  }

  private func bullet(_ text: Text) -> some View {
    Label {
      text
    } icon: {
      Image(systemName: "circle.fill")
        .imageScale(.small)
        .font(.caption2)
        .accessibilityHidden(true)
    }
    .foregroundStyle(.mutedForeground)
  }
}

extension AttributedString {
  fileprivate static var supportEmail: AttributedString {
    let address = String(
      localized: "hello@zoonk.com", table: "Account",
      comment:
        "An email address, not a phrase: keep it unless the style guide gives the language its own inbox"
    )
    var link = AttributedString(address)
    link.link = URL(string: "mailto:\(address)")
    return link
  }
}

extension SessionStore {
  fileprivate var subscriptionOwner: AppStoreSubscriptionOwner? {
    guard let account, let authenticatedSession else {
      return nil
    }

    return AppStoreSubscriptionOwner(accountID: account.user.id, session: authenticatedSession)
  }
}
