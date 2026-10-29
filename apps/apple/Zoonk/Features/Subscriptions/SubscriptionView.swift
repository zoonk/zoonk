import StoreKit
import SwiftUI

struct SubscriptionScreen: View {
  @Environment(\.dismiss) private var dismiss
  @Environment(AppRouter.self) private var router
  @Environment(LearnerSummaryStore.self) private var learner
  @Environment(SessionStore.self) private var session

  var body: some View {
    NavigationStack {
      Group {
        if !isGuest, let account = session.account,
          let appAccountToken = UUID(uuidString: account.user.id)
        {
          SubscriptionView(appAccountToken: appAccountToken)
        } else {
          ScrollView {
            SubscriptionMarketingContent()
              .scenePadding()
          }
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
      SubscriptionMarketingContent(allowance: settings.allowance.value)
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
      let isSubscribed = await subscriptions.handlePurchase(
        StoreKitSubscriptionClient.purchaseOutcome(from: result),
        synchronizationScope: session.account?.user.id
      ) { signedTransaction, expectedAccountID in
        await session.synchronizeAppleSubscription(
          signedTransaction: signedTransaction,
          expectedAccountID: expectedAccountID)
      }

      if isSubscribed {
        settings.subscriptionChanged()
      }
    }
    .loads(settings.allowance, refreshable: false)
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
          Text("Your plan", tableName: "Account", comment: "Section with the learner's own plan")
        }
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
