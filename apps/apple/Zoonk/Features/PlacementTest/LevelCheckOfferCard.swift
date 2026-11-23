import SwiftUI

/// Main's `LevelCheckOfferCard`: after a run of easy lessons, a lesson's end offers a check that can
/// skip what the learner already knows. "Not now" is saved, so the same offer waits until something
/// new happens.
struct LevelCheckOfferCard: View {
  let offer: LevelCheckOffer
  let isDismissing: Bool
  let dismissFailed: Bool
  let onCheck: () -> Void
  let onDismiss: () -> Void

  var body: some View {
    VStack(alignment: .leading, spacing: 16) {
      VStack(alignment: .leading, spacing: 4) {
        Text(
          "This looks easy for you", tableName: "Onboarding",
          comment: "Title of a lesson end's offer to check the level, after a run of easy lessons"
        )
        .typeStyle(.rowTitle)
        .accessibilityAddTraits(.isHeader)

        Group {
          if let level = offer.level {
            Text(
              "A short test can skip \(level) if you already know it.", tableName: "Onboarding",
              comment: "A lesson end's offer to test out of a language level, such as B2")
          } else {
            Text(
              "A quick test can skip lessons you already know.", tableName: "Onboarding",
              comment: "A lesson end's offer to take the quick test of what the learner knows")
          }
        }
        .typeStyle(.meta)
        .foregroundStyle(.mutedForeground)
      }

      HStack(spacing: 8) {
        Button(action: onCheck) {
          if let level = offer.level {
            Text(verbatim: PlacementTestCopy.testOut(level))
          } else {
            Text("Take the test", tableName: "Today")
          }
        }
        .buttonStyle(.outline)

        BusyButton(isBusy: isDismissing, action: onDismiss) {
          Text(PlacementTestCopy.notNow)
        }
        .buttonStyle(.borderless)
      }

      if dismissFailed, !isDismissing {
        FailureLine(
          message: LocalizedStringResource(
            "That didn't save. Try again.", table: "Onboarding",
            comment: "A change couldn't be saved"))
      }
    }
    .padding(16)
    .frame(maxWidth: .infinity, alignment: .leading)
    .panel()
  }
}
