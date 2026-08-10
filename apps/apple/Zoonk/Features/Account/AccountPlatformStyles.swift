import SwiftUI

extension View {
  /// Gives every account form the same readable Mac margins while leaving each touch, remote, and spatial platform's native Form layout intact.
  @ViewBuilder
  func accountFormLayout() -> some View {
    #if os(macOS)
      padding(.horizontal, 20)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
    #else
      self
    #endif
  }

  /// Prevents macOS from mixing push-button backgrounds and link tinting inside one settings list so every neutral account row has a consistent native appearance.
  @ViewBuilder
  func accountMenuStyle() -> some View {
    #if os(macOS)
      buttonStyle(.plain)
        .foregroundStyle(.primary)
        .listStyle(.inset)
    #else
      self
    #endif
  }

  /// Lets tvOS replace an external link's text color when its white focus surface appears, while preserving each other platform's standard link tint.
  @ViewBuilder
  func accountLinkStyle() -> some View {
    #if os(tvOS)
      foregroundStyle(.primary)
    #else
      self
    #endif
  }

  /// Gives editable account fields the visible bezel people expect on macOS while leaving each touch, remote, and spatial platform's native field treatment unchanged.
  @ViewBuilder
  func accountTextFieldStyle() -> some View {
    #if os(macOS)
      textFieldStyle(.roundedBorder)
    #else
      self
    #endif
  }
}
