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

  /// A save that didn't work, over the screen that tried; the bookmark is already back as it was.
  func saveFailureAlert(_ message: Text?, dismiss: @escaping () -> Void) -> some View {
    alert(
      message ?? Text(verbatim: ""),
      isPresented: Binding(
        get: { message != nil },
        set: { isPresented in
          if !isPresented {
            dismiss()
          }
        })
    ) {}
  }
}
