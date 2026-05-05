import SwiftUI

struct EmptyStateView: View {
    let title: LocalizedStringKey
    let description: LocalizedStringKey
    let symbolName: String

    var body: some View {
        ContentUnavailableView {
            Label(title, systemImage: symbolName)
        } description: {
            Text(description)
        }
    }
}
