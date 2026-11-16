import SwiftUI

/// Main's `PageErrorMessage`: a page that didn't load says what didn't, and "Try again" is the
/// screen's main action, in the bottom bar. Inside a screen whose own main action stays (`inBar:
/// false`), Try again is outlined under the words instead.
struct PageLoadFailure<Label: View, Line: View>: View {
  @ViewBuilder let label: Label
  @ViewBuilder let line: Line
  var inBar = true
  let retry: () async -> Void

  init(
    inBar: Bool = true, @ViewBuilder label: () -> Label, @ViewBuilder description: () -> Line,
    retry: @escaping () async -> Void
  ) {
    self.label = label()
    self.line = description()
    self.inBar = inBar
    self.retry = retry
  }

  var body: some View {
    let message = StateMessage {
      label
    } description: {
      line
    } actions: {
      if !inBar {
        retryButton
          .buttonStyle(.outline)
      }
    }
    .lonePage()

    if inBar {
      message.bottomBar {
        retryButton
          .buttonStyle(.mainAction)
      }
    } else {
      message
    }
  }

  private var retryButton: some View {
    Button {
      Task { await retry() }
    } label: {
      Text("Try again", tableName: "DesignSystem", comment: "Loads a page that didn't load again")
    }
  }
}

extension PageLoadFailure where Line == EmptyView {
  init(
    inBar: Bool = true, @ViewBuilder label: () -> Label, retry: @escaping () async -> Void
  ) {
    self.init(inBar: inBar, label: label, description: { EmptyView() }, retry: retry)
  }
}
