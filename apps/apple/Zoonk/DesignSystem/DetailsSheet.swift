import SwiftUI

/// Main's `DetailsDrawer`: what's behind a number or a grade, under its title, in a sheet as tall
/// as what it holds. Taller than the screen, it stops at the top and its list scrolls.
struct DetailsSheet<Content: View>: View {
  let title: Text
  @ViewBuilder let content: Content

  @Environment(\.dismiss) private var dismiss
  @State private var height: CGFloat?

  var body: some View {
    NavigationStack {
      ZoonkList {
        content
      }
      // The bar over the list is its top inset; the home indicator's room the sheet adds itself.
      .onScrollGeometryChange(for: CGFloat.self) { geometry in
        geometry.contentSize.height + geometry.contentInsets.top
      } action: { _, height in
        self.height = height
      }
      .navigationTitle(title)
      .toolbarTitleDisplayMode(.inline)
      .sheetClose { dismiss() }
    }
    .presentationDetents([height.map { .height($0) } ?? .large])
    .zoonkSheet()
  }
}
