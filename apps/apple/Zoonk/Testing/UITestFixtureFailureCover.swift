#if DEBUG
  import SwiftUI

  /// Covers the app with the reason a UI test's fixture couldn't be read, so that test fails once
  /// with it instead of the app crashing at every launch.
  struct UITestFixtureFailureCover: ViewModifier {
    let failure: String?

    func body(content: Content) -> some View {
      if let failure {
        content.fullScreenCover(isPresented: .constant(true)) {
          ScrollView {
            Text(verbatim: failure)
              .font(.footnote.monospaced())
              .padding()
              .accessibilityIdentifier("ui-test-fixture-failure")
          }
        }
      } else {
        content
      }
    }
  }
#endif
