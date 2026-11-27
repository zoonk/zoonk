import SwiftUI

struct BuddyScreen: View {
  @Environment(BuddyStore.self) private var store
  @Environment(LearnerSummaryStore.self) private var summary

  var body: some View {
    Group {
      switch store.status.state {
      case .idle, .loading:
        loading
      case .failed:
        failure { await store.status.refresh() }
      case .loaded where summary.summary.value == nil:
        // Which goal the buddy tutors comes with the summary: wait for it rather than flash the
        // goal start.
        if case .failed = summary.summary.state {
          failure { await summary.summary.refresh() }
        } else {
          loading
        }
      case .loaded(let status):
        BuddyContent(status: status, goalId: tutoredGoalId)
      case .empty:
        EmptyView()
      }
    }
    .loads(store.status, refreshable: false)
  }

  private var loading: some View {
    ProgressView()
      .frame(maxWidth: .infinity, maxHeight: .infinity)
      .lonePage()
      .barTitleAfterHero(summary.buddyDisplayName)
  }

  private func failure(retry: @escaping () async -> Void) -> some View {
    PageLoadFailure {
      Label {
        Text("Your buddy", tableName: "Buddy", comment: "Title of the Buddy tab")
      } icon: {
        Image(systemName: "face.smiling")
      }
    } description: {
      Text(
        "Something went wrong. Try again.", tableName: "Buddy",
        comment: "The buddy's day couldn't be read")
    } retry: {
      await retry()
    }
    .barTitleAfterHero(summary.buddyDisplayName)
  }

  private var tutoredGoalId: String? {
    guard let learner = summary.summary.value, let id = learner.activeGoalID,
      let goal = learner.goals.first(where: { $0.id == id }),
      goal.status != .archived, goal.kind != .explain
    else {
      return nil
    }

    return goal.id
  }
}

private struct BuddyContent: View {
  @Environment(BuddyStore.self) private var store
  @Environment(PracticeStore.self) private var practice
  @Environment(TutorStore.self) private var tutor
  @Environment(AppRouter.self) private var router
  @Environment(SessionStore.self) private var session
  @Environment(LearnerSummaryStore.self) private var summary
  @Environment(\.tutorPlaces) private var places
  @Environment(\.isCoveredByTask) private var isCovered

  let status: BuddyStatus
  let goalId: String?

  @State private var isDayShown = false
  @State private var isListShown = false
  @State private var isEditing = false
  @State private var isWearing = false
  @State private var goalDraft = ""
  @State private var faceCue: ActCue<BuddyAct>?
  @State private var missionTap = BuddyMissionTap()
  /// Says the editor's save failed, while the learner is on the page.
  @State private var saving = VisitRequest<Bool>()

  private var name: String {
    buddyName(kind: status.buddy.kind, name: status.buddy.name)
  }

  private var look: BuddyLook {
    BuddyLook(
      kind: status.buddy.kind, glasses: status.buddy.glasses,
      belt: ProgressBelt(rawValue: status.belt.color) ?? .white, energy: status.energy.current,
      studiedToday: status.energy.studiedToday)
  }

  /// A guest can't ask, so there's nothing to list.
  private var canTalk: Bool {
    session.authenticatedSession != nil && summary.summary.value?.identity.isAnonymous != true
  }

  /// The goal's conversations, for a learner who can ask.
  private var list: Resource<BuddyConversations>? {
    guard canTalk, let goalId else {
      return nil
    }

    return store.conversations(goalId: goalId)
  }

  /// The window's open conversation when it's this goal's.
  private var scope: TutorScope? {
    guard let goalId, let open = router.buddyConversation, open.goalId == goalId else {
      return nil
    }

    return .plan(goalId: goalId, conversationId: open.id)
  }

  private var conversation: TutorConversation? {
    scope.map { tutor.conversation($0) }
  }

  /// Only while it's awake: asleep it naps on, and glowing it's already beaming with its eyes shut,
  /// so a smile would swap its face away.
  private func react(_ act: BuddyAct) {
    guard look.energyState == .awake else { return }
    faceCue = ActCue(id: (faceCue?.id ?? 0) + 1, act: act)
  }

  var body: some View {
    // A pane rather than an inspector: a hidden tab's inspector turns into a sheet over the shown
    // tab when the width turns compact. The conversation keeps its identity as the pane comes and
    // goes, so what it's asking or opening goes on.
    PaneBeside(isAvailable: list != nil, paneEdge: .trailing, primaryShare: 0.66) {
      if let goalId {
        conversationList(goalId: goalId, inSheet: false)
          // A list opened in a sheet before iPhone Duo unfolded gives way to the pane.
          .onAppear { isListShown = false }
      }
    } content: { isBeside in
      thread
        .taskAction(isShown: !isBeside && list?.value != nil) {
          Button {
            isListShown = true
          } label: {
            Label {
              Text(
                "Conversations", tableName: "Buddy",
                comment: "Title of the list of buddy conversations")
            } icon: {
              Image(systemName: "bubble.left.and.bubble.right")
            }
          }
        }
    }
    .barTitleAfterHero(name)
    .taskOptions(
      label: Text(
        "More about \(name)", tableName: "Buddy",
        comment: "The buddy's menu; the argument is its name")
    ) {
      menuItems
    }
    .modifier(LoadsList(list: list))
    .sheet(isPresented: $isDayShown) {
      let day = BuddyDayView(status: status, name: name, tap: missionTap)

      NavigationStack {
        day
          .navigationTitle(day.title)
          .navigationSubtitle(day.subtitle)
          .navigationBarTitleDisplayMode(.inline)
          .sheetClose { isDayShown = false }
      }
      .presentationDetents([.medium, .large])
      .closesOnNavigation()
      .zoonkSheet()
    }
    .sheet(isPresented: $isListShown) {
      if let goalId {
        let list = conversationList(goalId: goalId, inSheet: true)

        NavigationStack {
          list
            .navigationTitle(list.title)
            .navigationBarTitleDisplayMode(.inline)
            .sheetClose { isListShown = false }
        }
        .presentationDetents([.medium, .large])
        .zoonkSheet()
      }
    }
    .sheet(isPresented: $isEditing) {
      BuddyEditor(
        choice: status.choice,
        availableGlasses: status.glasses.filter(\.earned).compactMap {
          BuddyGlasses(rawValue: $0.glasses.rawValue)
        },
        save: { choice in saving.run { [store] in await store.save(choice) } }
      )
      .zoonkSheet()
    }
    .sheet(isPresented: $isWearing) {
      BuddyGlassesPicker(status: status)
        .zoonkSheet()
    }
    .onChange(
      of: BuddyDayOpening(
        goalID: status.today?.goalId, localDate: status.today?.localDate, inSheet: isDayShown)
    ) { previous, opening in
      if previous.goalID != opening.goalID || previous.localDate != opening.localDate
        || previous.inSheet && !opening.inSheet
      {
        missionTap.cancel()
      }
    }
    .onChange(of: conversation?.isAsking ?? false) { _, isAsking in
      if isAsking {
        react(.glance)
      }
    }
    .onChange(of: conversation?.answeringID) { answered, answering in
      let turn = conversation?.turns.last
      if let answered, answering == nil, turn?.id == answered, turn?.status == .completed {
        react(.smile)
      }
    }
    .onChange(of: isCovered) {
      if isCovered {
        missionTap.cancel()
      }
    }
    .onDisappear {
      missionTap.cancel()
      saving.leave()
    }
    .onChange(
      of: BuddyOpening(
        goalId: goalId, request: router.buddyRequest, isOpen: scope != nil,
        list: list.map { BuddyOpening.ListRead($0.state) }),
      initial: true
    ) {
      openConversation()
    }
    // A link to a conversation that isn't this goal's opens the tab as a visit does.
    .onChange(of: conversation?.thread.state == .failed(.notFound)) { _, isMissing in
      if isMissing {
        router.buddyConversation = nil
      }
    }
  }

  private func openConversation() {
    let request = router.buddyRequest
    router.buddyRequest = nil

    guard let goalId else {
      if case .new(let ask?) = request {
        goalDraft = ask
      }

      return
    }

    switch BuddyOpening.next(
      request: request, isOpen: scope != nil, list: list.map { .init($0.state) })
    {
    case .conversation(let id):
      router.buddyConversation = BuddyOpenConversation(goalId: goalId, id: id)
    case .new(let ask):
      startNew(goalId: goalId, ask: ask)
    case nil:
      break
    }
  }

  /// The open one when nothing was asked in it yet; the app names it, and asking makes it.
  private func startNew(goalId: String, ask: String? = nil) {
    let open = conversation.flatMap { $0.isNew ? scope : nil }
    let scope =
      open ?? .plan(goalId: goalId, conversationId: UUID().uuidString.lowercased())
    let conversation = tutor.conversation(scope, isNew: true)

    if case .plan(_, let id) = scope {
      router.buddyConversation = BuddyOpenConversation(goalId: goalId, id: id)
    }

    if let ask {
      conversation.draft = ask
    }
  }

  private func conversationList(goalId: String, inSheet: Bool) -> BuddyConversationList {
    BuddyConversationList(
      goalId: goalId, open: openRow, showsTitle: !inSheet,
      startNew: {
        startNew(goalId: goalId)
        isListShown = false
      },
      select: { id in
        router.buddyConversation = BuddyOpenConversation(goalId: goalId, id: id)
        isListShown = false
      })
  }

  private var openRow: BuddyOpenRow? {
    guard let conversation, case .plan(_, let id) = conversation.scope else {
      return nil
    }

    let questions = conversation.turns + [conversation.asking].compactMap(\.self)

    return BuddyOpenRow(
      id: id, isNew: conversation.isNew,
      asked: questions.first.map { first in
        BuddyOpenRow.Asked(
          title: first.question, lastAskedAt: questions.last?.createdAt ?? first.createdAt)
      })
  }

  private var thread: some View {
    conversationView
      .safeAreaBar(edge: .top) {
        VStack(alignment: .leading, spacing: 0) {
          PageHeader(Text(name))
          dayLine
        }
        .listRowEdges()
        // A list's first row sits this far under the bar, so the title is where every page's is.
        .padding(.top, 12)
        .padding(.bottom, 8)
      }
      .pageColumn()
  }

  @ViewBuilder
  private var conversationView: some View {
    if let goalId {
      if let scope {
        let mistakes = practice.mistakes(goalId: goalId, fixed: false)

        TutorThreadView(
          scope: scope,
          suggestions: suggestions(mistakes: mistakes.state),
          placeholder: Text(
            "Ask anything", tableName: "Buddy",
            comment: "Placeholder of the buddy's composer: it answers and changes the plan"),
          isPage: true
        ) {
          greeting
        }
        // Another conversation starts at its own end, with nothing of this one's scroll.
        .id(scope)
        .loads(mistakes, refreshable: false)
      } else if case .failed = list?.state {
        PageLoadFailure(inBar: false) {
          Label {
            Text("Your buddy", tableName: "Buddy", comment: "Title of the Buddy tab")
          } icon: {
            Image(systemName: "face.smiling")
          }
        } description: {
          Text(
            "Something went wrong. Try again.", tableName: "Buddy",
            comment: "The buddy conversations couldn't be read")
        } retry: {
          await list?.refresh()
        }
      } else {
        ProgressView()
          .frame(maxWidth: .infinity, maxHeight: .infinity)
      }
    } else {
      BuddyGoalStart(name: name, goal: $goalDraft)
    }
  }

  /// The hello says the buddy is an AI (EU AI Act art. 50; Decreto 12.880/2026 art. 11 for minors).
  private var greeting: some View {
    VStack(alignment: .leading, spacing: 12) {
      Text(
        "Hi! I'm \(name), your AI study buddy. Ask me anything, or tell me what to change in your plan.",
        tableName: "Buddy",
        comment: "The buddy's hello at the top of its conversation; the argument is its name"
      )
      .typeStyle(.message)

      if saving.outcome == false {
        FailureLine(
          message: LocalizedStringResource(
            "We couldn't save your buddy. Try again.", table: "Buddy",
            comment: "Saving the buddy failed")
        )
        .typeStyle(.note)
      }

      if !status.buddy.picked {
        Button {
          isEditing = true
        } label: {
          Label {
            Text(
              "Choose your buddy", tableName: "Buddy",
              comment: "Opens choosing a buddy and its name")
          } icon: {
            Image(systemName: "face.smiling")
          }
        }
        .buttonStyle(.outline)
      }
    }
    .accessibilityElement(children: .contain)
  }

  /// None until the notebook is read, so the last one doesn't change under the learner's finger.
  private func suggestions(mistakes: LoadState<Components.Schemas.MistakeList>)
    -> [TutorSuggestion]
  {
    let hasMistake: Bool

    switch mistakes {
    case .idle, .loading:
      return []
    case .loaded(let list):
      hasMistake = list.counts.open + list.counts.fixed > 0
    case .empty, .failed:
      hasMistake = false
    }

    return [
      status.today != nil
        ? TutorSuggestion(
          id: "today",
          label: String(
            localized: "Why am I studying this today?", table: "Buddy",
            comment: "A question to the buddy, sent with one tap"))
        : TutorSuggestion(
          id: "today",
          label: String(
            localized: "What's in my plan for today?", table: "Buddy",
            comment: "A question to the buddy, sent with one tap")
        ),
      TutorSuggestion(
        id: "lighter",
        label: String(
          localized: "I want to study less this week", table: "Buddy",
          comment: "A question to the buddy, sent with one tap")
      ),
      hasMistake
        ? TutorSuggestion(
          id: "mistake",
          label: String(
            localized: "Explain my last mistake", table: "Buddy",
            comment: "A question to the buddy, sent with one tap"))
        : TutorSuggestion(
          id: "focus",
          label: String(
            localized: "What should I focus on first?", table: "Buddy",
            comment: "A question to the buddy, sent with one tap")),
    ]
  }

  private var face: some View {
    BuddyCharacter(look: look, crop: .face, cue: faceCue)
      .frame(width: 32, height: 32)
  }

  private var dayLine: some View {
    HStack(spacing: 16) {
      Button {
        isDayShown = true
      } label: {
        face
      }
      .accessibilityLabel(Text(name))
      .accessibilityHint(
        Text(
          "Shows \(name)'s day", tableName: "Buddy",
          comment: "VoiceOver hint of the buddy's day line; the argument is the buddy's name")
      )

      AccessibilityStack(spacing: 16, stackedSpacing: 4) {
        Button {
          places.open(.energy)
        } label: {
          Label {
            if let current = status.energy.current {
              Text(
                "\((current / 100).formatted(.percent.precision(.fractionLength(0)).locale(.appLanguage))) Energy",
                tableName: "Buddy",
                comment: "The buddy's Energy beside its bolt, such as \"68% Energy\"")
            } else {
              Text("Energy", tableName: "Progress")
            }
          } icon: {
            Image(systemName: "bolt.fill")
              .foregroundStyle(.energy)
          }
          .frame(minHeight: 44)
          .contentShape(.rect)
        }

        if let today = status.today, !today.missions.isEmpty {
          Button {
            isDayShown = true
          } label: {
            Label {
              Text(
                "\(today.missions.filter { $0.status == .done }.count) of \(today.missions.count) missions",
                tableName: "Buddy", comment: "Today's missions done, such as \"0 of 3 missions\"")
            } icon: {
              Image(systemName: "checklist")
            }
            .frame(minHeight: 44)
            .contentShape(.rect)
          }
        }
      }
      .fixedSize(horizontal: false, vertical: true)

      Spacer(minLength: 0)

      DisclosureChevron()
    }
    .buttonStyle(.plain)
    .labelStyle(.titleAndIcon)
    .typeStyle(.note)
    .monospacedDigit()
    .foregroundStyle(.mutedForeground)
    .contentShape(.rect)
  }

  @ViewBuilder
  private var menuItems: some View {
    Button {
      isEditing = true
    } label: {
      Label {
        status.buddy.picked
          ? Text(
            "Change \(name)", tableName: "Buddy",
            comment: "Opens changing the buddy; the argument is its name")
          : Text(
            "Choose your buddy", tableName: "Buddy",
            comment: "Opens choosing a buddy and its name")
      } icon: {
        Image(systemName: status.buddy.picked ? "pencil" : "face.smiling")
      }
    }

    Button {
      isWearing = true
    } label: {
      Label {
        Text(
          "\(name)'s glasses", tableName: "Buddy",
          comment:
            "Names the glasses the learner has collected for their study buddy, as a row and a menu item that opens them; %@ is the buddy's name. A name, not an action."
        )
      } icon: {
        Image(systemName: "eyeglasses")
      }
      Text(
        "\(status.earnedGlasses) of \(status.glasses.count)", tableName: "Buddy",
        comment: "Glasses earned of all of them")
    }

    Button {
      places.open(.memory)
    } label: {
      Label {
        Text(
          "What \(name) remembers", tableName: "Buddy",
          comment: "Opens what the buddy remembers; the argument is its name")
      } icon: {
        Image(systemName: "brain")
      }
    }

    Divider()

    Button {
      places.open(.logbook)
    } label: {
      Label {
        Text("Weekly summary", tableName: "Buddy", comment: "Opens the week's logbook")
      } icon: {
        Image(systemName: "calendar")
      }
    }
  }
}

private struct BuddyDayOpening: Equatable {
  let goalID: String?
  let localDate: String?
  let inSheet: Bool
}

/// Reads the list only for a learner who has one.
private struct LoadsList: ViewModifier {
  let list: Resource<BuddyConversations>?

  func body(content: Content) -> some View {
    if let list {
      content.loads(list, refreshable: false)
    } else {
      content
    }
  }
}
