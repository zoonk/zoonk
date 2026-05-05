import SwiftUI

struct ScreenLayout<Content: View>: View {
    let title: LocalizedStringKey
    private let content: Content

    init(title: LocalizedStringKey, @ViewBuilder content: () -> Content) {
        self.title = title
        self.content = content()
    }

    var body: some View {
#if os(tvOS)
        content
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .overlay(alignment: .topTrailing) {
                AccountAvatarView()
                    .padding()
            }
#else
        VStack(spacing: 24) {
            ScreenHeader(title: title)

            content
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
        .padding(.horizontal)
        .padding(.top)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
#endif
    }
}

#if !os(tvOS)
private struct ScreenHeader: View {
    let title: LocalizedStringKey

    var body: some View {
        HStack(alignment: .center, spacing: 16) {
            Text(title)
                .font(.largeTitle.bold())
                .lineLimit(1)
                .minimumScaleFactor(0.75)
                .accessibilityAddTraits(.isHeader)

            Spacer(minLength: 16)

            AccountAvatarView()
        }
    }
}
#endif
