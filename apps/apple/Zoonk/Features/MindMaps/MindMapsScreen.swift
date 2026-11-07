import SwiftUI

/// Main's Mind maps page: a row for every chapter of the plan that can have a map, grouped by
/// subject in plan order. Opened from a subject, it starts at that subject's maps.
struct MindMapsScreen: View {
  @Environment(LearnerSummaryStore.self) private var learner
  @Environment(MindMapsStore.self) private var store

  var subjectKey: String?

  var body: some View {
    if let goal = learner.summary.value?.shownGoal {
      let list = store.list(goalId: goal.id)

      content(list: list, goal: goal)
        .navigationTitle(title)
        .barTitleAfterHero(
          String(localized: "Mind maps", table: "MindMaps", comment: "Title of the mind maps page")
        )
        .loads(list)
    }
  }

  private var title: Text {
    Text("Mind maps", tableName: "MindMaps", comment: "Title of the mind maps page")
  }

  @ViewBuilder
  private func content(list: Resource<GoalMindMaps>, goal: LearnerGoal) -> some View {
    switch list.state {
    case .loaded(let maps):
      ScrollViewReader { proxy in
        ZoonkList {
          header(maps, goal: goal)

          // Locked rows don't each offer Plus: this says it once.
          if maps.chapters.contains(where: { $0.status == .plusRequired }) {
            Section {
              FreeWeekOverNotice()
            }
          }

          ForEach(groups(maps.chapters), id: \.key) { group in
            Section {
              ForEach(group.maps) { map in
                MindMapRow(goalId: goal.id, map: map, place: .library)
              }
            } header: {
              if let subject = group.subject {
                SectionTitle(Text(subject.name)) {
                  Text(
                    "\(group.maps.count) chapters", tableName: "MindMaps",
                    comment: "How many chapters of a subject can have mind maps")
                }
              }
            }
            .id(group.key)
          }
        }
        .onAppear {
          if let subjectKey {
            proxy.scrollTo(subjectKey, anchor: .top)
          }
        }
      }
      .lonePage()
    case .empty:
      ContentUnavailableView {
        Label {
          Text(
            "No mind maps yet", tableName: "MindMaps", comment: "Title when no chapter has a map")
        } icon: {
          KindMark(kind: .mindMap)
        }
      } description: {
        Text(
          "Your plan's chapters show here once they're ready, each with its mind map.",
          tableName: "MindMaps", comment: "Why the mind maps page has no chapters yet")
      }
      .lonePage()
    case .failed:
      ContentUnavailableView {
        Label {
          Text(
            "We couldn't reach the server.", tableName: "MindMaps",
            comment: "Shown when mind maps failed to load")
        } icon: {
          Image(systemName: "wifi.exclamationmark")
        }
      } actions: {
        Button {
          Task { await list.refresh() }
        } label: {
          Text("Try again", tableName: "MindMaps", comment: "Retries")
        }
        .buttonStyle(.outline)
      }
      .lonePage()
    case .idle, .loading:
      ProgressView()
    }
  }

  private func header(_ maps: GoalMindMaps, goal: LearnerGoal) -> some View {
    let ready = maps.chapters.count { $0.status == .ready }

    return Section {
      VStack(alignment: .leading, spacing: 6) {
        Text(goal.title)
          .typeStyle(.eyebrow)
          .foregroundStyle(.faint)

        title
          .typeStyle(.pageTitle)
          .accessibilityAddTraits(.isHeader)
          .heroTitle()

        Group {
          if ready == 0 {
            Text("0 maps", tableName: "MindMaps", comment: "No chapter's mind map is ready yet")
          } else {
            Text(
              "\(ready) maps", tableName: "MindMaps",
              comment: "How many chapters' mind maps are ready")
          }
        }
        .typeStyle(.data)
        .foregroundStyle(.mutedForeground)

        Text(verbatim: intro(maps))
          .typeStyle(.body)
          .foregroundStyle(.mutedForeground)
          .padding(.top, 6)
      }
      .padding(.bottom, 8)
      .listRowSeparator(.hidden)
    }
  }

  /// Rows don't repeat what making a map of a chapter whose lessons aren't written means: the intro
  /// says it once, when a row can.
  private func intro(_ maps: GoalMindMaps) -> String {
    let intro = String(
      localized:
        "A chapter's main ideas in one picture. Every chapter you finish gets one; you can make one for any other chapter in your plan.",
      table: "MindMaps", comment: "What the mind maps page is, under its title")

    let writesLessons = maps.chapters.contains {
      ($0.status == .available || $0.status == .failed) && $0.lessonsToWrite > 0
    }

    guard writesLessons else {
      return intro
    }

    let lessons =
      learner.summary.value?.tier == .plus
      ? String(
        localized:
          "Making a map for one of these writes its lessons first, so it takes a few minutes.",
        table: "MindMaps",
        comment:
          "Under the mind maps page's title, for a Plus learner with chapters whose lessons aren't written yet"
      )
      : String(
        localized:
          "Making a map for one of these writes its lessons first, which counts toward your free lessons.",
        table: "MindMaps",
        comment:
          "Under the mind maps page's title, for a free learner with chapters whose lessons aren't written yet"
      )

    return [intro, lessons].joinedSentences()
  }

  /// In order of each subject's first chapter; a goal without subjects is one group.
  private func groups(_ chapters: [ChapterMindMap]) -> [MindMapGroup] {
    var groups: [MindMapGroup] = []

    for map in chapters {
      let key = map.subject?.key ?? ""

      if let index = groups.firstIndex(where: { $0.key == key }) {
        groups[index].maps.append(map)
      } else {
        groups.append(MindMapGroup(key: key, subject: map.subject, maps: [map]))
      }
    }

    return groups
  }
}

private struct MindMapGroup {
  let key: String
  let subject: ChapterMindMap.Subject?
  var maps: [ChapterMindMap]
}
