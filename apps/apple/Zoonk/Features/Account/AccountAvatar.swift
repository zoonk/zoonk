import SwiftUI

struct AccountToolbarButton: View {
  @Environment(SessionStore.self) private var session

  let action: () -> Void

  var body: some View {
    Button(action: action) {
      AccountAvatar(user: session.account?.user, size: 32)
        .frame(width: 44, height: 44)
        .contentShape(Circle())
    }
    .buttonStyle(.plain)
    .accessibilityLabel(
      Text("Account", tableName: "Account", comment: "Accessibility label for the account button"))
  }
}

struct AccountAvatar: View {
  let user: AccountUser?
  let size: CGFloat

  var body: some View {
    Group {
      if let imageURL {
        AsyncImage(url: imageURL) { phase in
          switch phase {
          case .success(let image):
            image.resizable().scaledToFill()
          case .empty, .failure:
            fallback
          @unknown default:
            fallback
          }
        }
      } else {
        fallback
      }
    }
    .frame(width: size, height: size)
    .background(.quaternary, in: Circle())
    .clipShape(Circle())
    .contentShape(Circle())
  }

  private var imageURL: URL? {
    user?.image.flatMap(URL.init(string:))
  }

  @ViewBuilder
  private var fallback: some View {
    if let user {
      Text(getInitial(user: user))
        .font(.system(size: size * 0.42, weight: .semibold, design: .rounded))
        .foregroundStyle(.secondary)
    } else {
      Image(systemName: "person.crop.circle.fill")
        .resizable()
        .symbolRenderingMode(.hierarchical)
        .foregroundStyle(.secondary)
    }
  }

  /// Uses the first visible character of the preferred display name while preserving email as a reliable fallback.
  private func getInitial(user: AccountUser) -> String {
    String(user.preferredName.prefix(1)).uppercased()
  }
}

#Preview {
  AccountAvatar(user: nil, size: 44)
}
