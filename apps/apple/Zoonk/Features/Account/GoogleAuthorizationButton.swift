import SwiftUI
import UIKit

private let googleButtonLogoSize: CGFloat = 20

/// Uses Google's official multicolor mark and current button metrics while keeping the action text in Zoonk's native String Catalog so it follows the app language.
struct GoogleAuthorizationButton: View {
  @Environment(\.colorScheme) private var colorScheme
  @State private var presentationContext = GoogleAuthenticationPresentationContext()

  let isDisabled: Bool
  let action: (GoogleAuthenticationAnchor) -> Void

  var body: some View {
    Button {
      guard let viewController = presentationContext.viewController else {
        return
      }

      action(GoogleAuthenticationAnchor(viewController: viewController))
    } label: {
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
        .font(.body.weight(.medium))
        .fixedSize(horizontal: false, vertical: true)
      }
      .padding(.horizontal, 16)
      .authenticationButtonFrame()
      .foregroundStyle(foregroundColor)
      .background(backgroundColor)
      .overlay {
        RoundedRectangle(cornerRadius: authenticationButtonCornerRadius)
          .strokeBorder(borderColor, lineWidth: 1)
      }
      .clipShape(RoundedRectangle(cornerRadius: authenticationButtonCornerRadius))
      .contentShape(RoundedRectangle(cornerRadius: authenticationButtonCornerRadius))
    }
    .buttonStyle(AuthenticationButtonStyle())
    .accessibilityLabel(
      Text(
        "Sign in with Google",
        tableName: "Account",
        comment: "Accessibility label for the native Google sign-in button"
      )
    )
    .disabled(isDisabled)
    .background {
      GoogleAuthenticationPresentationReader(presentationContext: presentationContext)
        .frame(width: 0, height: 0)
        .accessibilityHidden(true)
    }
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

@MainActor
private final class GoogleAuthenticationPresentationContext {
  weak var viewController: UIViewController?
}

/// Captures a controller attached to this button's window so iPad multiwindow sign-in cannot open from another scene.
private struct GoogleAuthenticationPresentationReader: UIViewControllerRepresentable {
  let presentationContext: GoogleAuthenticationPresentationContext

  func makeUIViewController(context: Context) -> UIViewController {
    let viewController = UIViewController()
    viewController.view.backgroundColor = .clear
    viewController.view.isUserInteractionEnabled = false
    presentationContext.viewController = viewController
    return viewController
  }

  func updateUIViewController(_ viewController: UIViewController, context: Context) {
    presentationContext.viewController = viewController
  }
}

#Preview("Google sign-in") {
  GoogleAuthorizationButton(isDisabled: false, action: { _ in })
    .padding()
}
