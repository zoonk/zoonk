import SwiftUI

private let googleButtonLogoSize: CGFloat = 20

/// Uses Google's official multicolor mark and current button metrics while keeping the action text in Zoonk's native String Catalog so it follows the app language.
struct GoogleAuthorizationButton: View {
  @Environment(\.colorScheme) private var colorScheme

  let isDisabled: Bool
  let action: () -> Void

  var body: some View {
    Button(action: action) {
      HStack(spacing: 12) {
        Image("GoogleSignInLogo")
          .resizable()
          .interpolation(.high)
          .scaledToFit()
          .frame(width: googleButtonLogoSize, height: googleButtonLogoSize)
          .accessibilityHidden(true)

        Text(
          "Sign in with Google",
          tableName: "Account",
          comment: "Visible label on the Google sign-in button"
        )
        .font(.system(size: 14, weight: .medium))
        .lineLimit(1)
      }
      .padding(.horizontal, 16)
      .frame(
        width: authenticationButtonSize.width,
        height: authenticationButtonSize.height,
        alignment: .leading
      )
      .foregroundStyle(foregroundColor)
      .background(backgroundColor)
      .overlay {
        RoundedRectangle(cornerRadius: authenticationButtonCornerRadius)
          .strokeBorder(borderColor, lineWidth: 1)
      }
      .clipShape(RoundedRectangle(cornerRadius: authenticationButtonCornerRadius))
      .contentShape(RoundedRectangle(cornerRadius: authenticationButtonCornerRadius))
    }
    .buttonStyle(GoogleAuthorizationButtonStyle())
    .accessibilityLabel(
      Text(
        "Sign in with Google",
        tableName: "Account",
        comment: "Accessibility label for the native Google sign-in button"
      )
    )
    .disabled(isDisabled)
  }

  private var backgroundColor: Color {
    colorScheme == .dark
      ? Color(red: 19 / 255, green: 19 / 255, blue: 20 / 255)
      : .white
  }

  private var borderColor: Color {
    colorScheme == .dark
      ? Color(red: 142 / 255, green: 145 / 255, blue: 143 / 255)
      : Color(red: 116 / 255, green: 119 / 255, blue: 117 / 255)
  }

  private var foregroundColor: Color {
    colorScheme == .dark
      ? Color(red: 227 / 255, green: 227 / 255, blue: 227 / 255)
      : Color(red: 31 / 255, green: 31 / 255, blue: 31 / 255)
  }
}

private struct GoogleAuthorizationButtonStyle: ButtonStyle {
  @Environment(\.isEnabled) private var isEnabled

  /// Adds the press and disabled feedback required for a custom button without changing Google's approved colors or geometry.
  func makeBody(configuration: Configuration) -> some View {
    configuration.label
      .opacity(opacity(isPressed: configuration.isPressed))
  }

  /// Keeps disabled and pressed states visually distinct while preserving the button's branded appearance.
  private func opacity(isPressed: Bool) -> Double {
    if !isEnabled {
      return 0.45
    }

    return isPressed ? 0.72 : 1
  }
}

#Preview("Google sign-in") {
  GoogleAuthorizationButton(isDisabled: false, action: {})
    .padding()
}
