import SwiftUI

/// Main's save button: a bookmark, filled once saved, whose words say the state, "Save" until it's
/// "Saved", so it reads the same to everyone. Where there's no room for the words, they're its name
/// (`.labelStyle(.iconOnly)`).
struct SaveToggle: View {
  let isSaved: Bool
  let save: Text
  let saved: Text
  let toggle: () -> Void

  var body: some View {
    Button(action: toggle) {
      Label {
        isSaved ? saved : save
      } icon: {
        Image(systemName: isSaved ? "bookmark.fill" : "bookmark")
      }
    }
    .accessibilityAddTraits(isSaved ? .isSelected : [])
    .sensoryFeedback(.selection, trigger: isSaved)
  }
}

/// A row's bookmark at its end, as main's ghost icon button: it saves without opening the row.
struct RowSaveToggle: View {
  /// Between the row and its bookmark, as between a row and its chevron: the button is only as
  /// wide as its glyph here, so a smaller gap would crowd the row's date.
  static let gap: CGFloat = 12

  let isSaved: Bool
  let save: Text
  let saved: Text
  let toggle: () -> Void

  var body: some View {
    SaveToggle(isSaved: isSaved, save: save, saved: saved, toggle: toggle)
      .labelStyle(.iconOnly)
      .buttonStyle(.ghost.icon.endsRow)
      .controlSize(.large)
  }
}

/// A row bookmark's room, empty, on a row that can't be saved, so its value ends where its
/// neighbors' do.
struct RowSaveSpace: View {
  var body: some View {
    RowSaveToggle(isSaved: false, save: Text(verbatim: ""), saved: Text(verbatim: "")) {}
      .hidden()
      .accessibilityHidden(true)
  }
}

/// A save that can no longer open here: the title it had, and Remove, which takes it away at once,
/// since it can't be saved again.
struct UnavailableSaveRow<Detail: View>: View {
  let title: String
  let remove: Text
  /// What VoiceOver says for Remove, naming the save, as each bookmark does.
  let spoken: Text
  let action: () -> Void
  @ViewBuilder let detail: Detail

  var body: some View {
    LabeledContent {
      Button(action: action) {
        remove
      }
      .buttonStyle(.outline)
      .controlSize(.small)
      .accessibilityLabel(spoken)
      .accessibilityInputLabels([remove])
    } label: {
      VStack(alignment: .leading, spacing: 2) {
        Text(title)
          .typeStyle(.rowTitle)
          .foregroundStyle(Color(.foreground))

        detail
          .typeStyle(.meta)
          .foregroundStyle(.mutedForeground)
      }
    }
  }
}

extension View {
  /// A row's swipe and context-menu Save, where the row opens what it saves.
  func savesFromRow(isSaved: Bool, save: Text, remove: Text, toggle: @escaping () -> Void)
    -> some View
  {
    let button = Button(action: toggle) {
      Label {
        isSaved ? remove : save
      } icon: {
        Image(systemName: isSaved ? "bookmark.slash" : "bookmark")
      }
    }

    return
      self
      .swipeActions(edge: .trailing, allowsFullSwipe: true) { button }
      .contextMenu { button }
  }

  /// This screen's visit for saves of one kind, which its save controls read from the environment:
  /// a save of this visit that didn't work says `message` over it, the bookmark already back as it
  /// was. The visit ends as the screen goes away or a task covers it.
  func saveVisit<Target: Saveable>(
    of _: Target.Type, message: @escaping (Saves<Target>.Failure) -> Text
  ) -> some View {
    modifier(SaveVisitOwner<Target>(message: message))
  }
}

private struct SaveVisitOwner<Target: Saveable>: ViewModifier {
  @Environment(\.isCoveredByTask) private var isCovered
  @State private var visit = SaveVisit<Target>()

  let message: (Saves<Target>.Failure) -> Text

  func body(content: Content) -> some View {
    let message = visit.failure.map(message)

    content
      .environment(visit)
      .alert(
        message ?? Text(verbatim: ""),
        isPresented: Binding(
          get: { message != nil },
          set: { isPresented in
            if !isPresented {
              visit.failure = nil
            }
          })
      ) {}
      .onChange(of: isCovered) {
        if isCovered {
          visit.leave()
        }
      }
      .onDisappear {
        visit.leave()
      }
  }
}
