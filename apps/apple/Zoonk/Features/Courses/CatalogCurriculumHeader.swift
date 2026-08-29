import SwiftUI

struct CatalogCurriculumHeader: View {
  @Environment(\.horizontalSizeClass) private var horizontalSizeClass

  let title: Text

  var body: some View {
    title
      .font(.headline)
      .foregroundStyle(.primary)
      .frame(maxWidth: .infinity, alignment: .leading)
      .padding(.horizontal, CatalogDetailLayout.horizontalInset(for: horizontalSizeClass))
      .padding(
        .vertical,
        CatalogDetailLayout.curriculumHeaderVerticalInset(for: horizontalSizeClass)
      )
      .background(Color(uiColor: .systemBackground))
      .accessibilityAddTraits(.isHeader)
  }
}
