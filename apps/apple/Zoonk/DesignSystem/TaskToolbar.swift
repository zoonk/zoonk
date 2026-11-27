import SwiftUI

extension View {
  /// A task's title in its bar, on the screen's middle whatever the bar holds beside it, as the
  /// system's own title is, and on up to two lines there, so an ordinary chapter or lesson title
  /// shows whole. Like the system's, a title that doesn't fit on one line on the middle moves off
  /// it, up to the whole room between the bar's buttons, so it wraps or shortens only when that
  /// room is too narrow too. The system still has it as the screen's title (VoiceOver, the window,
  /// Back's menu), and a vertical bar (iPhone Duo) has no room for it. A screen that shows the same
  /// title large in its body keeps it out of the bar (`isShown` false) and only names the screen.
  @ViewBuilder
  func taskTitle(_ title: Text, isShown: Bool = true) -> some View {
    if isShown {
      modifier(TaskTitleToolbar(title: title, name: title))
    } else {
      barName(title)
    }
  }

  /// A task whose title shows on some of its screens only, such as a test's questions: nil leaves
  /// the bar's middle empty, and `name` names the screen for the system meanwhile.
  func taskTitle(_ title: Text?, name: Text) -> some View {
    modifier(TaskTitleToolbar(title: title, name: name))
  }

  /// A task's close in its toolbar, the item the bar keeps when it runs out of room (iPhone Duo's
  /// short vertical bar can), so leaving never hides in the overflow menu.
  func taskClose<Close: View>(@ViewBuilder _ close: () -> Close) -> some View {
    modifier(TaskCloseToolbar(close: close()))
  }

  /// Esc lets go of something the screen holds (a picked match card) while `isHeld`, instead of
  /// leaving: main's board takes Esc ahead of the ✕. The task's close gives up its Esc meanwhile.
  func holdsEscape(_ isHeld: Bool, cancel: @escaping () -> Void) -> some View {
    // iOS gives a button in a `background` no keyboard shortcut, so this one sits beside the content.
    ZStack {
      self

      if isHeld {
        Button(action: cancel) { EmptyView() }
          .keyboardShortcut(.cancelAction)
          .frame(width: 0, height: 0)
          .opacity(0)
          .accessibilityHidden(true)
      }
    }
    .preference(key: EscapeHoldKey.self, value: isHeld)
  }

  /// A task close's Esc, which it gives up while the screen holds Esc (`holdsEscape`).
  func leavesOnEscape() -> some View {
    modifier(LeavesOnEscape())
  }

  /// A screen's own options in the toolbar's "…" menu: the system's overflow menu on iOS 27, which
  /// also takes what a short bar can't fit, and a menu of its own before it.
  func taskOptions<Actions: View>(
    isShown: Bool = true, label: Text, @ViewBuilder _ actions: () -> Actions
  ) -> some View {
    modifier(TaskOptionsToolbar(isShown: isShown, label: label, actions: actions()))
  }

  /// A screen's own main action (the lesson's Ask, the Plan's Adjust plan), which the bar keeps
  /// when it runs out of room instead of moving it into the overflow menu.
  func taskAction<Action: View>(isShown: Bool = true, @ViewBuilder _ action: () -> Action)
    -> some View
  {
    modifier(TaskActionToolbar(isShown: isShown, action: action()))
  }
}

private struct TaskTitleToolbar: ViewModifier {
  @Environment(\.isToolbarVertical) private var isToolbarVertical
  /// The screen's edges and the room the bar gives the title, both across the window.
  @State private var screen: ClosedRange<CGFloat>?
  @State private var room: ClosedRange<CGFloat>?
  @State private var lineWidth: CGFloat?

  let title: Text?
  /// What the system calls the screen (VoiceOver, the window, Back's menu): the title when it shows.
  let name: Text

  /// Takes from the side nearer the screen's edge what the other side lacks, so the title's room is
  /// as wide on each side of the screen's middle, but no more than the room the title can spare on
  /// one line.
  private var inset: (leading: CGFloat, trailing: CGFloat) {
    guard let screen, let room, let lineWidth else {
      return (0, 0)
    }

    let leading = room.lowerBound - screen.lowerBound
    let trailing = screen.upperBound - room.upperBound
    let spare = max(0, room.upperBound - room.lowerBound - lineWidth)
    return (min(max(0, trailing - leading), spare), min(max(0, leading - trailing), spare))
  }

  private func styled(_ title: Text) -> some View {
    title
      // The bar's own title font, without the tracking main's body sets for app text, so a title
      // that fits one line looks as the system draws it.
      .font(.headline)
      .tracking(0)
  }

  func body(content: Content) -> some View {
    content
      .onGeometryChange(for: ClosedRange<CGFloat>.self) { proxy in
        let frame = proxy.frame(in: .global)
        return frame.minX...frame.maxX
      } action: {
        screen = $0
      }
      .navigationTitle(title ?? name)
      .toolbarTitleDisplayMode(.inline)
      .toolbar {
        // Stands in for the bar's own title, which keeps to one line.
        if let title {
          ToolbarItem(placement: .title) {
            styled(title)
              .lineLimit(2)
              .multilineTextAlignment(.center)
              .minimumScaleFactor(0.85)
              .fixedSize(horizontal: false, vertical: true)
              .background {
                styled(title)
                  .lineLimit(1)
                  .fixedSize()
                  .hidden()
                  .onGeometryChange(for: CGFloat.self) { proxy in
                    proxy.size.width.rounded(.up)
                  } action: {
                    lineWidth = $0
                  }
              }
              .padding(.leading, inset.leading)
              .padding(.trailing, inset.trailing)
              // The bar sizes a title to its ideal width when it first lays it out, and then puts a
              // short one on the screen's middle or after the close. Asking for every width gets it
              // the whole room between the buttons on every layout, which the inset then evens out.
              .frame(idealWidth: UIView.layoutFittingExpandedSize.width, maxWidth: .infinity)
              .onGeometryChange(for: ClosedRange<CGFloat>.self) { proxy in
                let frame = proxy.frame(in: .global)
                return frame.minX...frame.maxX
              } action: {
                room = $0
              }
              .accessibilityAddTraits(.isHeader)
          }
        }
      }
      // Takes the title item with it.
      .toolbar(removing: isToolbarVertical ? .title : nil)
  }
}

// Each picks its toolbar by system version outside it: an `if #available` inside a toolbar's
// builder loses its item once iPhone Duo unfolds.

private struct TaskCloseToolbar<Close: View>: ViewModifier {
  let close: Close
  @State private var isEscapeHeld = false

  func body(content: Content) -> some View {
    let content = content.onPreferenceChange(EscapeHoldKey.self) { isEscapeHeld = $0 }
    let close = close.environment(\.isEscapeHeld, isEscapeHeld)

    if #available(iOS 27, *) {
      content.toolbar {
        ToolbarItem(placement: .cancellationAction) { close }
          .visibilityPriority(.high)
      }
    } else {
      content.toolbar {
        ToolbarItem(placement: .cancellationAction) { close }
      }
    }
  }
}

private struct EscapeHoldKey: PreferenceKey {
  static let defaultValue = false

  static func reduce(value: inout Bool, nextValue: () -> Bool) {
    value = value || nextValue()
  }
}

extension EnvironmentValues {
  @Entry var isEscapeHeld = false
}

private struct LeavesOnEscape: ViewModifier {
  @Environment(\.isEscapeHeld) private var isEscapeHeld

  func body(content: Content) -> some View {
    content.keyboardShortcut(isEscapeHeld ? nil : .cancelAction)
  }
}

private struct TaskOptionsToolbar<Actions: View>: ViewModifier {
  let isShown: Bool
  let label: Text
  let actions: Actions

  func body(content: Content) -> some View {
    if #available(iOS 27, *) {
      content.toolbar {
        if isShown {
          ToolbarOverflowMenu { actions }
        }
      }
    } else {
      content.toolbar {
        if isShown {
          ToolbarItem(placement: .primaryAction) {
            Menu {
              actions
            } label: {
              Label {
                label
              } icon: {
                Image(systemName: "ellipsis")
              }
            }
          }
        }
      }
    }
  }
}

private struct TaskActionToolbar<Action: View>: ViewModifier {
  let isShown: Bool
  let action: Action

  func body(content: Content) -> some View {
    if #available(iOS 27, *) {
      content.toolbar {
        if isShown {
          ToolbarItem(placement: .primaryAction) { action }
            .visibilityPriority(.high)
        }
      }
    } else {
      content.toolbar {
        if isShown {
          ToolbarItem(placement: .primaryAction) { action }
        }
      }
    }
  }
}

extension EnvironmentValues {
  /// A task covers the app (main's task screens): what lines up with it keeps the task's column.
  @Entry var isTaskScreen = false
}
