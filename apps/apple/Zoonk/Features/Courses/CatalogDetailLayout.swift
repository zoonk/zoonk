import SwiftUI

enum CatalogDetailLayout {
  static func horizontalInset(for horizontalSizeClass: UserInterfaceSizeClass?) -> CGFloat {
    horizontalSizeClass == .regular ? 24 : 16
  }

  static func heroArtworkSize(for horizontalSizeClass: UserInterfaceSizeClass?) -> CGFloat {
    horizontalSizeClass == .regular ? 112 : 80
  }

  static func heroSpacing(for horizontalSizeClass: UserInterfaceSizeClass?) -> CGFloat {
    horizontalSizeClass == .regular ? 20 : 12
  }

  static func actionLeadingInset(
    for horizontalSizeClass: UserInterfaceSizeClass?,
    dynamicTypeSize: DynamicTypeSize
  ) -> CGFloat {
    guard horizontalSizeClass == .regular, !dynamicTypeSize.isAccessibilitySize else {
      return 0
    }

    return heroArtworkSize(for: horizontalSizeClass) + heroSpacing(for: horizontalSizeClass)
  }

  static func curriculumHeaderVerticalInset(
    for horizontalSizeClass: UserInterfaceSizeClass?
  ) -> CGFloat {
    horizontalSizeClass == .regular ? 12 : 8
  }

  static func curriculumRowVerticalInset(
    for horizontalSizeClass: UserInterfaceSizeClass?
  ) -> CGFloat {
    horizontalSizeClass == .regular ? 14 : 10
  }

  static func curriculumContentSpacing(
    for horizontalSizeClass: UserInterfaceSizeClass?
  ) -> CGFloat {
    horizontalSizeClass == .regular ? 6 : 4
  }
}
