import SwiftUI

/// Its words aren't localized on purpose: no placeholder ships, and none should reach the catalogs.
struct RoutePlaceholder: View {
  @Environment(\.dismiss) private var dismiss

  let name: String
  let systemImage: String
  let isTask: Bool

  var body: some View {
    if isTask {
      NavigationStack {
        placeholder
          .toolbar {
            ToolbarItem(placement: .topBarLeading) {
              Button(role: .close) {
                dismiss()
              }
            }
          }
      }
    } else {
      placeholder
    }
  }

  private var placeholder: some View {
    ContentUnavailableView(name, systemImage: systemImage)
      .navigationTitle(Text(verbatim: name))
  }
}
