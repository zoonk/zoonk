#if os(iOS) || os(macOS)
  import SwiftUI

  /// Uses Google's current gradient logo and branded colors while keeping the visible action localized by the app.
  struct GoogleAuthorizationButton: View {
    @Environment(\.colorScheme) private var colorScheme

    let isDisabled: Bool
    let action: () -> Void

    var body: some View {
      Button(action: action) {
        HStack(spacing: 12) {
          Image("GoogleSignInLogo")
            .resizable()
            .scaledToFit()
            .frame(width: 23, height: 23)
            .accessibilityHidden(true)

          Text(
            "Sign in with Google",
            tableName: "Account",
            comment: "Accessibility label for the native Google sign-in button"
          )
          .font(.system(size: 16, weight: .medium))
          .lineLimit(1)
          .minimumScaleFactor(0.75)
        }
        .foregroundStyle(foregroundColor)
        .frame(
          width: authenticationButtonSize.width,
          height: authenticationButtonSize.height
        )
        .background(
          backgroundColor,
          in: RoundedRectangle(cornerRadius: authenticationButtonCornerRadius)
        )
        .overlay {
          RoundedRectangle(cornerRadius: authenticationButtonCornerRadius)
            .strokeBorder(borderColor, lineWidth: 1)
        }
        .contentShape(
          RoundedRectangle(cornerRadius: authenticationButtonCornerRadius)
        )
      }
      .buttonStyle(GoogleAuthorizationButtonStyle())
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

    /// Adds press and disabled feedback without changing Google's approved colors or geometry.
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
#endif
