import SwiftUI

extension View {
  /// Main's `BottomBar`: the one home of a screen's main action, pinned at the bottom in a
  /// `safeAreaBar`, so content scrolls under it with the system's edge effect. Its buttons are 44pt,
  /// 8pt apart in one row, the main action last and taking the room the others leave; at an
  /// accessibility text size they stack, each as wide as the bar. A failure line (`note`) floats over
  /// the screen just above the bar, so the bar and its buttons never move when it shows.
  func bottomBar<Actions: View>(
    note: FailureLine? = nil, @ViewBuilder _ actions: () -> Actions
  ) -> some View {
    safeAreaBar(edge: .bottom) {
      BottomBar(note: note, actions: actions())
    }
  }
}

private struct BottomBar<Actions: View>: View {
  let note: FailureLine?
  let actions: Actions

  @Environment(\.stacksContent) private var isStacked

  var body: some View {
    // A bar whose buttons all hide draws nothing, so it takes no room under the content.
    Group(subviews: actions) { buttons in
      if !buttons.isEmpty || note != nil {
        bar(buttons)
      }
    }
  }

  private func bar(_ buttons: SubviewsCollection) -> some View {
    AccessibilityStack(spacing: 8) {
      buttons
    }
    .controlSize(.large)
    .buttonSizing(isStacked ? .flexible : .automatic)
    .environment(\.mainActionFillsRow, true)
    .taskColumn()
    .keepsOffFold()
    .overlay(alignment: .top) {
      if let note {
        note
          .typeStyle(.body)
          .multilineTextAlignment(.center)
          .frame(maxWidth: .infinity)
          .padding(.horizontal, 16)
          .padding(.vertical, 8)
          .background(.background)
          .alignmentGuide(.top) { $0[.bottom] }
      }
    }
  }
}

extension EnvironmentValues {
  /// In a bottom bar, the main action takes the room its row's other buttons leave.
  @Entry var mainActionFillsRow = false
}

extension View {
  /// Main's task column: at most 680pt wide, centered on the screen, inside the scene's margins.
  func taskColumn(alignment: Alignment = .center) -> some View {
    frame(maxWidth: 680, alignment: alignment)
      .frame(maxWidth: .infinity)
      .scenePadding()
  }
}
