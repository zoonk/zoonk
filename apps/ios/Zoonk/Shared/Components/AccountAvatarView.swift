import SwiftUI

struct AccountAvatarView: View {
    var body: some View {
        Image(systemName: "person.crop.circle.fill")
            .resizable()
            .symbolRenderingMode(.hierarchical)
            .foregroundStyle(.secondary)
            .frame(width: 34, height: 34)
            .accessibilityLabel("Account")
    }
}
