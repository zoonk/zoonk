import SwiftUI

extension View {
  /// A task's close in its toolbar, the item the bar keeps when it runs out of room (iPhone Duo's
  /// short vertical bar can), so leaving never hides in the overflow menu.
  func taskClose<Close: View>(@ViewBuilder _ close: () -> Close) -> some View {
    modifier(TaskCloseToolbar(close: close()))
  }

  /// A task's own options in the toolbar's "…" menu: the system's overflow menu on iOS 27, which
  /// also takes what a short bar can't fit, and a menu of its own before it.
  func taskOptions<Actions: View>(
    isShown: Bool = true, label: Text, @ViewBuilder _ actions: () -> Actions
  ) -> some View {
    modifier(TaskOptionsToolbar(isShown: isShown, label: label, actions: actions()))
  }

  /// A task's action that opens its side panel (the lesson's Ask), which the bar keeps beside the
  /// close when it runs out of room.
  func taskAction<Action: View>(isShown: Bool = true, @ViewBuilder _ action: () -> Action)
    -> some View
  {
    modifier(TaskActionToolbar(isShown: isShown, action: action()))
  }
}

// Each picks its toolbar by system version outside it: an `if #available` inside a toolbar's
// builder loses its item once iPhone Duo unfolds.

private struct TaskCloseToolbar<Close: View>: ViewModifier {
  let close: Close

  func body(content: Content) -> some View {
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
