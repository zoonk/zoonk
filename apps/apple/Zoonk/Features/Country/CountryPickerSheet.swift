import SwiftUI

/// Main's `CountryPicker`: core's suggestions, then every country A to Z, searchable. A pick saves
/// and closes; one that rebuilds a plan asks first, and one that fails keeps the sheet open.
struct CountryPickerSheet: View {
  let title: Text
  /// The language the list is named in.
  let language: String
  let suggested: [CountryChoice]
  /// The current value's code; nil when nothing is set.
  let selected: String?
  /// Picking another country rebuilds the plan, so the learner confirms it first.
  var confirmsRebuild = false
  /// False when it didn't save.
  let save: (CountryChoice) async -> Bool

  @Environment(CountryCatalogStore.self) private var catalogs
  @Environment(\.dismiss) private var dismiss
  @State private var query = ""
  /// The pick being saved; nil while nothing is.
  @State private var saving: CountryChoice?
  @State private var confirming: CountryChoice?
  @State private var failed = false

  var body: some View {
    let catalog = catalogs.countries(language: language)

    NavigationStack {
      ZoonkList {
        if query.trimmingCharacters(in: .whitespaces).isEmpty {
          browsing(catalog)
        } else {
          results(catalog)
        }
      }
      .disabled(saving != nil)
      .searchable(
        text: $query, placement: .navigationBarDrawer(displayMode: .always),
        prompt: Text(
          "Search countries", tableName: "Plan", comment: "Placeholder of the country search field"
        )
      )
      .navigationTitle(title)
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
      .announcesStatus(resultCount(catalog))
      .alert(
        Text(
          "Switch to \(confirming?.name ?? "")?", tableName: "Plan",
          comment:
            "Title of the question before a goal's plan is made again for another country; the argument is a country's name, such as Portugal"
        ),
        isPresented: Binding(get: { confirming != nil }, set: { if !$0 { confirming = nil } }),
        presenting: confirming
      ) { choice in
        Button(role: .cancel) {
        } label: {
          Text("Cancel", tableName: "Plan", comment: "Keeps the goal's country as it is")
        }

        Button {
          commit(choice)
        } label: {
          Text(
            "Switch", tableName: "Plan",
            comment: "Confirms a new country, which makes the goal a new plan")
        }
      } message: { choice in
        Text(
          "We'll make a new plan for \(choice.name). Finished lessons stay done.",
          tableName: "Plan",
          comment:
            "Body of the question before a goal's plan is rebuilt for another country; the argument is a country's name, such as Portugal"
        )
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
      .loads(catalog)
    }
    .presentationDetents([.large])
  }

  @ViewBuilder
  private func browsing(_ catalog: Resource<[CountryChoice]>) -> some View {
    if !suggested.isEmpty {
      Section {
        ForEach(suggested) { choice in
          row(choice)
        }
      } header: {
        SectionTitle(
          Text(
            "Suggested", tableName: "Plan",
            comment: "Section of the countries a picker suggests first"))
      }
    }

    Section {
      switch catalog.state {
      case .loaded(let countries):
        ForEach(countries) { choice in
          row(home(choice))
        }
      case .idle, .loading:
        ForEach(0..<6, id: \.self) { _ in
          Text(verbatim: "Country name")
            .typeStyle(.rowTitle)
            .redacted(reason: .placeholder)
            .accessibilityHidden(true)
        }
      case .failed:
        loadFailure(catalog)
      case .empty:
        EmptyView()
      }
    } header: {
      SectionTitle(
        Text("All countries", tableName: "Plan", comment: "Section of every country, A to Z"))
    }
  }

  @ViewBuilder
  private func results(_ catalog: Resource<[CountryChoice]>) -> some View {
    let found = matches(catalog)

    Section {
      if found.isEmpty, catalog.value != nil {
        noMatch
      }

      ForEach(found) { choice in
        row(choice)
      }

      if case .failed = catalog.state {
        loadFailure(catalog)
      }
    }
  }

  private var noMatch: some View {
    Text("No country found", tableName: "Plan", comment: "A country search that found nothing")
      .typeStyle(.note)
      .foregroundStyle(.mutedForeground)
  }

  private func loadFailure(_ catalog: Resource<[CountryChoice]>) -> some View {
    HStack {
      Text(
        "Couldn't load the list.", tableName: "Plan",
        comment: "The list of every country didn't load; the suggested ones still work"
      )
      .typeStyle(.note)
      .foregroundStyle(.mutedForeground)
      .frame(maxWidth: .infinity, alignment: .leading)

      Button {
        Task { await catalog.refresh() }
      } label: {
        Text("Try again", tableName: "Plan", comment: "Loads the list of countries again")
      }
      .buttonStyle(.outline)
      .controlSize(.small)
    }
  }

  /// The suggestions first, each country once.
  private func matches(_ catalog: Resource<[CountryChoice]>) -> [CountryChoice] {
    let suggestedCodes = Set(suggested.map(\.code))
    let all = suggested + (catalog.value ?? []).filter { !suggestedCodes.contains($0.code) }

    return all.filter { countryMatches($0.name, query: query) }
  }

  /// The full list carries no tag, so the country the learner lives in keeps it there too.
  private func home(_ choice: CountryChoice) -> CountryChoice {
    var choice = choice
    choice.isHome = suggested.contains { $0.code == choice.code && $0.isHome }
    return choice
  }

  private func resultCount(_ catalog: Resource<[CountryChoice]>) -> String? {
    guard !query.trimmingCharacters(in: .whitespaces).isEmpty, catalog.value != nil else {
      return nil
    }

    let count = matches(catalog).count

    return count == 0
      ? String(
        localized: "No country found", table: "Plan", comment: "A country search that found nothing"
      )
      : String(
        localized: "\(count) countries", table: "Plan",
        comment: "VoiceOver, as a country search changes: how many countries it found")
  }

  private func row(_ choice: CountryChoice) -> some View {
    let isSelected = (saving?.code ?? selected) == choice.code

    return Button {
      pick(choice)
    } label: {
      HStack(alignment: .firstTextBaseline) {
        Text(choice.name)
          .typeStyle(.rowTitle)
          .foregroundStyle(Color(.foreground))
          .frame(maxWidth: .infinity, alignment: .leading)

        if choice.isHome {
          homeTag
            .typeStyle(.meta)
            .foregroundStyle(.mutedForeground)
        }
      }
      .contentShape(.rect)
    }
    .pickedRow(isSelected)
    .accessibilityLabel(label(choice))
    .accessibilityAddTraits(isSelected ? .isSelected : [])
  }

  private var homeTag: Text {
    Text(
      "Where you live", tableName: "Plan",
      comment: "Tag beside the country the learner said they live in, in a list of countries")
  }

  private func label(_ choice: CountryChoice) -> Text {
    choice.isHome
      ? Text(
        "\(choice.name), where you live", tableName: "Plan",
        comment:
          "VoiceOver, for the country the learner lives in in a list of countries; the argument is its name"
      )
      : Text(choice.name)
  }

  private func pick(_ choice: CountryChoice) {
    guard saving == nil else {
      return
    }

    if choice.code == selected {
      dismiss()
    } else if confirmsRebuild {
      confirming = choice
    } else {
      commit(choice)
    }
  }

  private func commit(_ choice: CountryChoice) {
    saving = choice

    Task {
      if await save(choice) {
        dismiss()
      } else {
        failed = true
      }

      saving = nil
    }
  }
}
