import SwiftUI

struct CatalogDetailSearchPresentation: ViewModifier {
  @Binding var text: String
  @Binding var isPresented: Bool
  let prompt: Text

  func body(content: Content) -> some View {
    Group {
      if #available(iOS 26.0, *) {
        content
          .searchable(
            text: $text,
            isPresented: $isPresented,
            placement: .toolbar,
            prompt: prompt
          )
          .toolbar {
            DefaultToolbarItem(kind: .search, placement: .topBarTrailing)
          }
          .searchToolbarBehavior(.minimize)
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
