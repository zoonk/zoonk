import SwiftUI

/// A language goal's country, which its buddy and practice calls speak; lessons and their audio keep
/// the taught one's.
struct LanguageVariety: Equatable, Sendable {
  let language: String
  /// Only when the learner asked for one.
  var region: String?
  /// Sorted by name, in the learner's language.
  let choices: [Components.Schemas.RegionChoice]

  /// Nil for a language without countries to choose from.
  init?(language: String?, region: String?, choices: [Components.Schemas.RegionChoice]) {
    guard let language, !choices.isEmpty else {
      return nil
    }

    self.language = language
    self.region = region
    self.choices = choices
  }

  var name: String {
    Locale.current.varietyName(language: language, region: region)
  }

  var note: String? {
    varietyNote(language: language, region: region, taughtRegion: taughtRegion)
  }

  /// What the pick changes: the note once it differs from the lessons.
  var pickerLine: String {
    note
      ?? String(
        localized:
          "Your buddy and practice calls use the country you choose. Lessons and their audio use \(Locale.current.varietyNameInSentence(language: language, region: taughtRegion)).",
        table: "Plan",
        comment:
          "Under the countries a language goal can choose from; the argument is the language as lessons teach it, like 'Spanish (Mexico)'"
      )
  }

  private var taughtRegion: String? {
    choices.first(where: \.taught)?.code
  }
}

/// Nil without a country, or with the one lessons teach.
func varietyNote(language: String, region: String?, taughtRegion: String?) -> String? {
  guard let region, let taughtRegion, region != taughtRegion else {
    return nil
  }

  let chosen = Locale.current.varietyNameInSentence(language: language, region: region)
  let taught = Locale.current.varietyNameInSentence(language: language, region: taughtRegion)

  return String(
    localized:
      "Your buddy and practice calls use \(chosen). Lessons and their audio use \(taught).",
    table: "Plan",
    comment:
      "Under a language goal's country; the arguments are a language with its country, like 'Spanish (Argentina)', then the one lessons teach, like 'Spanish (Mexico)'"
  )
}

/// Saves a pick at once, as the plan's other settings do, and stays open so the learner sees what it
/// changed.
struct LanguageVarietySheet: View {
  let variety: LanguageVariety
  /// False when it didn't save.
  let save: (String?) async -> Bool

  /// The pick being saved; nil while nothing is.
  @State private var saving: String??
  @State private var failed = false

  var body: some View {
    let selected = saving ?? variety.region
    let shown = LanguageVariety(
      language: variety.language, region: selected, choices: variety.choices)

    NavigationStack {
      ZoonkList {
        Section {
          option(
            region: nil, selected: selected,
            name: Text(
              "No preference", tableName: "Plan",
              comment: "The language goal's choice of no country, as lessons teach it"))

          ForEach(variety.choices, id: \.code) { choice in
            option(region: choice.code, selected: selected, name: Text(choice.name))
          }
        } header: {
          // Above the list, which can run past the screen, so a pick's note shows where it's made.
          Text((shown ?? variety).pickerLine)
            .typeStyle(.note)
            .foregroundStyle(.mutedForeground)
            .textCase(nil)
        }
      }
      .disabled(saving != nil)
      .navigationTitle(
        Text("Language", tableName: "Plan", comment: "Title of a language goal's country picker")
      )
      .toolbarTitleDisplayMode(.inline)
      .toolbar {
        ToolbarItem(placement: .confirmationAction) {
          PlanSheetDoneButton()
        }

        if saving != nil {
          ToolbarItem(placement: .status) {
            ProgressView()
          }
        }
      }
      .alert(
        Text("Couldn't save", tableName: "Plan", comment: "Title of an error saving the goal"),
        isPresented: $failed
      ) {
      } message: {
        Text(
          "Check your connection and try again.", tableName: "Plan",
          comment: "Explains a failed save")
      }
    }
    .presentationDetents([.medium, .large])
  }

  private func option(region: String?, selected: String?, name: Text) -> some View {
    let isSelected = region == selected

    return Button {
      pick(region)
    } label: {
      name
        .typeStyle(.rowTitle)
        .foregroundStyle(Color(.foreground))
        .frame(maxWidth: .infinity, alignment: .leading)
        .contentShape(.rect)
    }
    .pickedRow(isSelected)
    .accessibilityAddTraits(isSelected ? .isSelected : [])
  }

  private func pick(_ region: String?) {
    guard region != variety.region, saving == nil else {
      return
    }

    saving = .some(region)

    Task {
      failed = !(await save(region))
      saving = nil
    }
  }
}
