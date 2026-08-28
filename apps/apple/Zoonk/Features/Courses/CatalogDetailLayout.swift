import SwiftUI

enum CatalogDetailLayout {
  static func horizontalInset(for horizontalSizeClass: UserInterfaceSizeClass?) -> CGFloat {
    horizontalSizeClass == .regular ? 24 : 16
  }
}
