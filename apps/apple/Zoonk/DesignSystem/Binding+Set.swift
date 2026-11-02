import SwiftUI

extension Binding<Set<String>> {
  func contains(_ member: String) -> Binding<Bool> {
    Binding<Bool> {
      wrappedValue.contains(member)
    } set: { isMember in
      if isMember {
        wrappedValue.insert(member)
      } else {
        wrappedValue.remove(member)
      }
    }
  }
}
