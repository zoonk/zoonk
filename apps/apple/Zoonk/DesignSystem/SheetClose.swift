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

  /// Every sheet's root; a popover keeps `zoonkStyles()` and the system's glass. A sheet is the
  /// page's background at every height and width: at a partial height the system's glass shows
  /// the page behind through a form, and on an iPad it grays the sheet between a list's rows.
  func zoonkSheet() -> some View {
    zoonkStyles()
      .sheetColumn()
      .presentationBackground(.background)
  }
}
