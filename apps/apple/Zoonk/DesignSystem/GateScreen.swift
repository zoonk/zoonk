import SwiftUI

/// A screen with nothing to show but why, such as a lesson that can't open or a call that can't
/// go on: the system's `ContentUnavailableView` with its words in main's gate roles, and its way on
/// in the screen's bottom bar or in `actions`. While `held`, its words keep the tallest room they
/// have had, so a gate that lifts by itself moves nothing.
struct GateScreen<Line: View, Actions: View>: View {
  let title: Text?
  let symbol: String
  var held = false
  @ViewBuilder let line: Line
  @ViewBuilder let actions: Actions

  var body: some View {
    ContentUnavailableView {
      Label {
        HeldSlot(gated: held, alignment: .center) {
          title?
            .typeStyle(.pageTitle)
            .foregroundStyle(Color(.foreground))
        }
      } icon: {
        Image(systemName: symbol)
          .foregroundStyle(.mutedForeground)
          .accessibilityHidden(true)
      }
    } description: {
      HeldSlot(gated: held, alignment: .center) {
        line
          .typeStyle(.reading)
          .foregroundStyle(.mutedForeground)
      }
    } actions: {
      actions
    }
  }
}

extension GateScreen where Actions == EmptyView {
  init(title: Text?, symbol: String, held: Bool = false, @ViewBuilder line: () -> Line) {
    self.init(title: title, symbol: symbol, held: held, line: line) { EmptyView() }
  }
}

extension GateScreen where Line == EmptyView, Actions == EmptyView {
  init(title: Text?, symbol: String) {
    self.init(title: title, symbol: symbol) { EmptyView() }
  }
}
