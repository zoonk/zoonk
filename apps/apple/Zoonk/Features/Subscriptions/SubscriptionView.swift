import StoreKit
import SwiftUI

struct SubscriptionView: View {
  @Environment(AppStoreSubscriptionStore.self) private var subscriptions
  @Environment(SessionStore.self) private var session

  let appAccountToken: UUID

  var body: some View {
    SubscriptionStoreView(productIDs: AppStoreSubscriptionProduct.productIDs) {
      SubscriptionMarketingContent()
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
  var body: some View {
    VStack(spacing: 20) {
      Image(systemName: "sparkles")
        .font(.largeTitle)
        .foregroundStyle(.tint)
        .accessibilityHidden(true)

      VStack(spacing: 8) {
        Text(
          "Learn anything. It’s all included.",
          tableName: "Account",
          comment: "Headline on the Zoonk Plus subscription screen"
        )
        .font(.largeTitle.bold())
        .multilineTextAlignment(.center)

        Text(
          "Plus gives you unlimited courses and lessons for whatever you want to learn.",
          tableName: "Account",
          comment: "Summary of the Zoonk Plus subscription"
        )
        .font(.body)
        .foregroundStyle(.secondary)
        .multilineTextAlignment(.center)
      }

      VStack(alignment: .leading, spacing: 12) {
        benefit(
          title: Text(
            "Unlimited courses and lessons",
            tableName: "Account",
            comment: "Zoonk Plus benefit describing unlimited learning content"),
          systemImage: "infinity")
        benefit(
          title: Text(
            "Learning built around your goals",
            tableName: "Account",
            comment: "Zoonk Plus benefit describing personalized learning"),
          systemImage: "scope")
      }
      .frame(maxWidth: 420, alignment: .leading)
    }
    .padding(.horizontal)
  }

  private func benefit(title: Text, systemImage: String) -> some View {
    Label {
      title
    } icon: {
      Image(systemName: systemImage)
        .foregroundStyle(.tint)
    }
  }
}
