import SwiftUI

struct CatalogInformationView<Content: View>: View {
  @Environment(\.horizontalSizeClass) private var horizontalSizeClass

  let dismiss: () -> Void
  let title: LocalizedStringResource
  @ViewBuilder let content: Content

  init(
    dismiss: @escaping () -> Void,
    title: LocalizedStringResource,
    @ViewBuilder content: () -> Content
  ) {
    self.dismiss = dismiss
    self.title = title
    self.content = content()
  }

  @ViewBuilder
  var body: some View {
    if horizontalSizeClass == .regular {
      informationContent
        .frame(width: 360)
        .presentationSizing(.fitted)
    } else {
      informationContent
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
    }
  }

  private var informationContent: some View {
    NavigationStack {
      ScrollView {
        content
          .frame(maxWidth: .infinity, alignment: .leading)
          .padding(20)
      }
      .navigationTitle(Text(title))
      .navigationBarTitleDisplayMode(.inline)
      .toolbar {
        ToolbarItem(placement: .confirmationAction) {
          Button(action: dismiss) {
            Text(
              "Done",
              tableName: "Courses",
              comment: "Closes catalog information presented in a popover or sheet.")
          }
        }
      }
    }
  }
}
