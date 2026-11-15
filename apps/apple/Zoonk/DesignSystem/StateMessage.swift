import SwiftUI

/// A page's state with nothing to list (empty, failed, signed out, nothing to start with): the
/// system's `ContentUnavailableView` with its words in main's `Empty` roles, the title one step
/// above its line, each line no longer than a readable measure. The page keeps its own title over
/// it (`barTitleAfterHero(_:)`); a task's gate, which is the whole screen, is a `GateScreen`.
struct StateMessage<Label: View, Line: View, Actions: View>: View {
  @ViewBuilder let label: Label
  @ViewBuilder let line: Line
  @ViewBuilder let actions: Actions

  init(
    @ViewBuilder label: () -> Label, @ViewBuilder description: () -> Line,
    @ViewBuilder actions: () -> Actions
  ) {
    self.label = label()
    self.line = description()
    self.actions = actions()
  }

  var body: some View {
    ContentUnavailableView {
      label
        .labelStyle(StateLabelStyle())
    } description: {
      line
        .typeStyle(.body)
        .foregroundStyle(.mutedForeground)
        .frame(maxWidth: 384)
    } actions: {
      actions
    }
  }
}

extension StateMessage where Actions == EmptyView {
  init(@ViewBuilder label: () -> Label, @ViewBuilder description: () -> Line) {
    self.init(label: label, description: description, actions: { EmptyView() })
  }
}

extension StateMessage where Line == EmptyView, Actions == EmptyView {
  init(@ViewBuilder label: () -> Label) {
    self.init(label: label, description: { EmptyView() }, actions: { EmptyView() })
  }
}

extension StateMessage where Line == EmptyView {
  init(@ViewBuilder label: () -> Label, @ViewBuilder actions: () -> Actions) {
    self.init(label: label, description: { EmptyView() }, actions: actions)
  }
}

/// The state's one mark over its title, in place of the system's larger pair.
private struct StateLabelStyle: LabelStyle {
  func makeBody(configuration: Configuration) -> some View {
    VStack(spacing: 12) {
      configuration.icon
        .typeStyle(.section)
        .foregroundStyle(.mutedForeground)
        .accessibilityHidden(true)

      configuration.title
        .typeStyle(.screenTitle)
        .foregroundStyle(Color(.foreground))
        .frame(maxWidth: 384)
    }
  }
}
