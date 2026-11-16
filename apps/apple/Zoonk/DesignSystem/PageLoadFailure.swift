import SwiftUI

/// Main's `PageErrorMessage`: a page that didn't load says what didn't, and "Try again" is the
/// screen's main action, in the bottom bar.
struct PageLoadFailure<Label: View, Line: View>: View {
  @ViewBuilder let label: Label
  @ViewBuilder let line: Line
  let retry: () async -> Void

  init(
    @ViewBuilder label: () -> Label, @ViewBuilder description: () -> Line,
    retry: @escaping () async -> Void
  ) {
    self.label = label()
    self.line = description()
    self.retry = retry
  }

  var body: some View {
    StateMessage {
      label
    } description: {
      line
    }
    .lonePage()
    .bottomBar {
      Button {
        Task { await retry() }
      } label: {
        Text("Try again", tableName: "DesignSystem", comment: "Loads a page that didn't load again")
      }
      .buttonStyle(.mainAction)
    }
  }
}

extension PageLoadFailure where Line == EmptyView {
  init(@ViewBuilder label: () -> Label, retry: @escaping () async -> Void) {
    self.init(label: label, description: { EmptyView() }, retry: retry)
  }
}
