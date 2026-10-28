#if DEBUG
  import SwiftUI

  /// Shows why a fixture couldn't be read, so its test fails once with the reason instead of the app
  /// crashing at every launch.
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
