import SwiftUI

extension View {
  /// A task's title in its bar, centered between the close and the bar's buttons and on up to two
  /// lines there, so an ordinary chapter or lesson title shows whole and every title of a deck
  /// keeps one center. The system still has it as the screen's title
  /// (VoiceOver, the window, Back's menu), and a vertical bar (iPhone Duo) has no room for it.
  func taskTitle(_ title: Text) -> some View {
    modifier(TaskTitleToolbar(title: title))
  }

  /// A task's close in its toolbar, the item the bar keeps when it runs out of room (iPhone Duo's
  /// short vertical bar can), so leaving never hides in the overflow menu.
  func taskClose<Close: View>(@ViewBuilder _ close: () -> Close) -> some View {
    modifier(TaskCloseToolbar(close: close()))
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

  let title: Text

  func body(content: Content) -> some View {
    content
      .navigationTitle(title)
      .toolbarTitleDisplayMode(.inline)
      .toolbar {
        // Stands in for the bar's own title, which keeps to one line.
        ToolbarItem(placement: .title) {
          title
            // The bar's own title font, without the tracking main's body sets for app text, so a
            // title that fits one line looks as the system draws it.
            .font(.headline)
            .tracking(0)
            .lineLimit(2)
            .multilineTextAlignment(.center)
            .minimumScaleFactor(0.85)
            .fixedSize(horizontal: false, vertical: true)
            // The bar sizes a title to its ideal width when it first lays it out, and then puts a
            // short one on the screen's middle or after the close. Asking for every width gets it
            // the whole room between the buttons on every layout, so each title centers there.
            .frame(idealWidth: UIView.layoutFittingExpandedSize.width, maxWidth: .infinity)
            .accessibilityAddTraits(.isHeader)
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
