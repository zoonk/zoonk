import SwiftUI

struct CatalogDetailSearchPresentation: ViewModifier {
  @Environment(\.horizontalSizeClass) private var horizontalSizeClass
  @Binding var text: String
  @Binding var isPresented: Bool
  let prompt: Text

  func body(content: Content) -> some View {
    Group {
      if horizontalSizeClass == .regular {
        // iPadOS keeps toolbar search as its own Search button that expands into the field, so the
        // search stays attached instead of appearing only after a separate button.
        content
          .searchable(
            text: $text,
            isPresented: $isPresented,
            placement: .toolbar,
            prompt: prompt
          )
          .searchPresentationToolbarBehavior(.avoidHidingContent)
          .toolbar {
            if isPresented {
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
      } else if isPresented {
        content
          .searchable(
            text: $text,
            isPresented: $isPresented,
            placement: .navigationBarDrawer(displayMode: .always),
            prompt: prompt
          )
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
