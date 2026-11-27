import SwiftUI

/// Main's `SteadyLabel`: a button's label that changes with the screen's state and never changes
/// the button's width. Every label it can show takes the same cell, so the button is as wide as the
/// widest in any language and what sits beside it never moves.
struct SteadyLabel: View {
  let shown: LocalizedStringResource
  let among: [LocalizedStringResource]

  init(_ shown: LocalizedStringResource, among: [LocalizedStringResource]) {
    self.shown = shown
    self.among = among
  }

  var body: some View {
    ZStack {
      ForEach(Array(among.enumerated()), id: \.offset) { _, label in
        if label != shown {
          Text(label)
            .hidden()
            .accessibilityHidden(true)
        }
      }

      Text(shown)
    }
  }
}
