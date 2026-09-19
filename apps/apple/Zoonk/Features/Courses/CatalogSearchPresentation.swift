import SwiftUI

struct CatalogDetailSearchPresentation: ViewModifier {
  @Environment(\.horizontalSizeClass) private var horizontalSizeClass
  @Binding var text: String
  @Binding var isPresented: Bool
  let prompt: Text

  func body(content: Content) -> some View {
    Group {
      if isPresented {
        content
          .searchable(
            text: $text,
            isPresented: $isPresented,
            placement: horizontalSizeClass == .regular
              ? .toolbar : .navigationBarDrawer(displayMode: .always),
            prompt: prompt
          )
          .searchPresentationToolbarBehavior(
            horizontalSizeClass == .regular ? .avoidHidingContent : .automatic
          )
          .toolbar {
            if horizontalSizeClass == .regular {
              ToolbarItem(placement: .cancellationAction) {
                Button(role: .cancel) {
                  isPresented = false
                } label: {
                  Text(
                    "Cancel",
                    tableName: "Navigation",
                    comment: "Cancels catalog search and returns to browsing.")
                }
              }
            }
          }
      } else {
        content
          .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
              Button {
                isPresented = true
              } label: {
                Image(systemName: "magnifyingglass")
              }
              .accessibilityLabel(
                Text(
                  "Search",
                  tableName: "Navigation",
                  comment: "Opens search on a catalog detail screen."))
            }
          }
      }
    }
    .onChange(of: isPresented) { _, isPresented in
      if !isPresented {
        text = ""
      }
    }
  }
}

extension View {
  func catalogDetailSearchPresentation(
    text: Binding<String>,
    isPresented: Binding<Bool>,
    prompt: Text
  ) -> some View {
    modifier(
      CatalogDetailSearchPresentation(
        text: text,
        isPresented: isPresented,
        prompt: prompt))
  }
}
