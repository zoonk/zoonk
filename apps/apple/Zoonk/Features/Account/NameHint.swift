import SwiftUI

/// Main's `NameHint`: under every field that changes the learner's name.
struct NameHint: View {
  var body: some View {
    Text(
      "Your buddy and all your certificates use this name.", tableName: "Account")
  }
}
