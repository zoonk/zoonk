import SwiftUI

extension View {
  /// Main's `BottomBar`: the one home of a screen's main action, pinned at the bottom in a
  /// `safeAreaBar`, so content scrolls under it with the system's edge effect. Its buttons are 44pt,
  /// 8pt apart in one row, the main action last and taking the room the others leave; at an
  /// accessibility text size they stack, each as wide as the bar. On a regular width the main action
  /// sits at the bar's end at its own width instead. Its one line (`note`) floats over the screen just
  /// above the bar, so the bar and its buttons never move when it shows.
  func bottomBar<Actions: View>(
    note: BarNote? = nil, @ViewBuilder _ actions: () -> Actions
  ) -> some View {
    safeAreaBar(edge: .bottom) {
      BottomBar(note: note, actions: actions())
    }
  }
}

private struct BottomBar<Actions: View>: View {
  let note: BarNote?
  let actions: Actions

  @Environment(\.stacksContent) private var isStacked
  @Environment(\.horizontalSizeClass) private var sizeClass

  var body: some View {
    // A bar whose buttons all hide draws nothing, so it takes no room under the content.
    Group(subviews: actions) { buttons in
      if !buttons.isEmpty || note != nil {
        bar(buttons)
      }
    }
  }

  private func bar(_ buttons: SubviewsCollection) -> some View {
    // Wide, a filling button would read as a banner across the page (main's E-102).
    let isWide = sizeClass == .regular && !isStacked

    return AccessibilityStack(spacing: 8) {
      buttons
    }
    .controlSize(.large)
    .buttonSizing(isStacked ? .flexible : .automatic)
    .environment(\.mainActionFillsRow, !isWide)
    .environment(\.mainActionMinWidth, isWide ? 160 : nil)
    .frame(maxWidth: .infinity, alignment: isWide ? .trailing : .center)
    .taskColumn()
    .keepsOffFold()
    .overlay(alignment: .top) {
      if let note {
        note
          .typeStyle(.body)
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
  /// In a bottom bar on a compact width, the main action takes the room its row's other buttons
  /// leave.
  @Entry var mainActionFillsRow = false
  /// In a bottom bar on a regular width, the main action's least width.
  @Entry var mainActionMinWidth: CGFloat?
}

/// A bottom bar's one line over its buttons: what a tap couldn't do, or a status the screen waits on
/// (muted), with at most one small action such as "Retry".
struct BarNote: View {
  enum Tone {
    case failure
    case status
  }

  struct Action {
    let label: Text
    let perform: () -> Void
  }

  private let message: AttributedString
  private let tone: Tone
  private let action: Action?

  init(_ message: LocalizedStringResource, tone: Tone = .failure, action: Action? = nil) {
    self.init(AttributedString(localized: message), tone: tone, action: action)
  }

  /// For words already localized, such as a server's message.
  init(_ message: String, tone: Tone = .failure, action: Action? = nil) {
    self.init(AttributedString(message), tone: tone, action: action)
  }

  private init(_ message: AttributedString, tone: Tone, action: Action?) {
    self.message = message
    self.tone = tone
    self.action = action
  }

  var body: some View {
    HStack(alignment: .firstTextBaseline, spacing: 12) {
      switch tone {
      case .failure:
        FailureLine(message: message)
      case .status:
        Text(message)
          .foregroundStyle(.mutedForeground)
          .announcesStatus(String(message.characters))
      }

      if let action {
        Button(action: action.perform) {
          action.label
        }
        .buttonStyle(.outline)
        .controlSize(.small)
      }
    }
    .multilineTextAlignment(action == nil ? .center : .leading)
  }
}

extension View {
  /// Main's task column: at most 680pt wide, centered on the screen, inside the scene's margins.
  func taskColumn(alignment: Alignment = .center) -> some View {
    frame(maxWidth: 680, alignment: alignment)
      .frame(maxWidth: .infinity)
      .scenePadding()
  }
}
