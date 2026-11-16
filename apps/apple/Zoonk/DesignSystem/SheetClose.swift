import SwiftUI

extension View {
  /// A sheet's way out: the system's close button at the top's trailing end, the same on every
  /// sheet. Only a form the learner types into has "Cancel" instead, as its cancellation action,
  /// since closing it loses what they typed.
  func sheetClose(isDisabled: Bool = false, _ close: @escaping () -> Void) -> some View {
    toolbar {
      ToolbarItem(placement: .topBarTrailing) {
        Button(role: .close, action: close)
          .disabled(isDisabled)
      }
    }
  }

  /// Every sheet's root; a popover keeps `zoonkStyles()` alone. The sheet's background stays the
  /// system's: a sheet is chrome, and its Liquid Glass is the platform's, never repainted.
  func zoonkSheet() -> some View {
    zoonkStyles()
      .sheetColumn()
  }
}
