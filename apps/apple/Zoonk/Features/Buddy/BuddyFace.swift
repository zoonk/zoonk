import SwiftUI

typealias BuddyKind = Components.Schemas.Buddy.KindPayload
typealias BuddyGlasses = Components.Schemas.Buddy.GlassesPayload

/// The buddy's face wherever the app shows it (the Buddy tab's header, Ask buttons, pickers).
/// Until the characters lane ports main's part rig (`packages/ui/src/components/_buddy`, faces
/// that swap and parts that act, grown by the belt and lit by Energy), it is the closest system
/// presentation: one SF Symbol at the size of the text beside it. That lane replaces this view's
/// body and keeps its initializer.
struct BuddyFace: View {
  let kind: BuddyKind
  var glasses: BuddyGlasses = .round

  var body: some View {
    Image(systemName: "face.smiling")
      .symbolRenderingMode(.hierarchical)
      .accessibilityHidden(true)
  }
}
