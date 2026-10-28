import Foundation

/// A row of the search tab: what it says and what it does. Rows are data, so building them is cheap
/// and testable; `SearchScreen` runs their actions.
struct SearchItem: Equatable, Identifiable {
  enum Action: Equatable {
    /// Opens the buddy's tab with the question waiting in its composer.
    case ask(String)
    case feedback
    case open(AppRoute)
    case present(AppSheet)
    case select(AppTab)
    case switchGoal(String)
  }

  let id: String
  let title: String
  let systemImage: String
  var badge = 0
  /// Other words that find the row, such as "Buddy" for the buddy's own name.
  var keywords: String?
  let action: Action

  func matches(_ text: String) -> Bool {
    title.localizedStandardContains(text) || keywords?.localizedStandardContains(text) == true
  }
}

struct SearchGroup: Equatable, Identifiable {
  let id: String
  let title: String
  let items: [SearchItem]
  /// Settings, help and quick explanations are found by name only, as on main.
  var isShownWithoutQuery = true
}

/// Main's palette groups in its order: the learner's actions, where they can go, their other goals,
/// quick explanations, the plan's subjects and chapters (from the Plan's cached `syllabus`), then
/// settings and help. A visitor gets the ways in instead.
func searchGroups(
  summary: LearnerSummary?, isSignedIn: Bool, syllabus: GoalSyllabus? = nil
) -> [SearchGroup] {
  guard isSignedIn, let summary else {
    return [visitorPages, helpGroup]
  }

  return [
    actions(summary),
    places(summary),
    otherGoals(summary),
    explanations(summary),
    plan(syllabus),
    settingsGroup(isGuest: summary.identity.isAnonymous),
    helpGroup,
  ].filter { !$0.items.isEmpty }
}

/// What a query can always do, last: ask the buddy about it, then start a goal from it.
func searchFallback(question: String, summary: LearnerSummary?) -> SearchGroup {
  let startGoal = SearchItem(
    id: "start-goal",
    title: summary?.followedGoals.isEmpty == false
      ? String(
        localized: "Start a new goal: “\(question)”", table: "Search",
        comment: "Starts another goal from what the learner typed in search")
      : String(
        localized: "Start a goal: “\(question)”", table: "Search",
        comment: "Starts a goal from what the learner typed in search"),
    systemImage: "target",
    action: .open(.startGoal(goal: question)))

  guard let summary, canAskBuddy(summary) else {
    return SearchGroup(
      id: "fallback",
      title: String(
        localized: "New goal", table: "Search", comment: "Search group to start a goal"),
      items: [startGoal])
  }

  let ask = SearchItem(
    id: "ask",
    title: String(
      localized: "Ask \(buddyName(summary)): “\(question)”", table: "Search",
      comment: "Asks the study buddy what the learner typed in search; the first value is its name"),
    systemImage: "bubble.left.and.text.bubble.right",
    action: .ask(question))

  return SearchGroup(
    id: "fallback",
    title: String(localized: "Ask", table: "Search", comment: "Search group to ask the buddy"),
    items: [ask, startGoal])
}

private func actions(_ summary: LearnerSummary) -> SearchGroup {
  let places = summary.places
  var items: [SearchItem] = []

  if (summary.todayBlocksLeft ?? 0) > 0 {
    items.append(
      SearchItem(
        id: "continue",
        title: String(
          localized: "Continue today's session", table: "Search",
          comment: "Search action that continues the day's session"),
        systemImage: "play.fill",
        action: .open(.session)))
  }

  if places.exam {
    items.append(
      SearchItem(
        id: "mock",
        title: String(
          localized: "Take a mock exam", table: "Search",
          comment: "Search action that opens the mock exam chooser"),
        systemImage: LearnKind.mock.systemImage,
        action: .open(.mockChooser)))
  }

  if places.readyMistakes > 0 {
    items.append(
      SearchItem(
        id: "practice-mistakes",
        title: String(
          localized: "Practice your mistakes", table: "Search",
          comment: "Search action that practices the mistakes ready for review"),
        systemImage: LearnKind.mistakes.systemImage,
        badge: places.readyMistakes,
        action: .open(.mistakePractice())))
  }

  if canAskBuddy(summary) {
    items.append(
      SearchItem(
        id: "ask-buddy",
        title: String(
          localized: "Ask \(buddyName(summary))…", table: "Search",
          comment: "Search action that opens the buddy's chat; the value is its name"),
        systemImage: "bubble.left.and.text.bubble.right",
        action: .select(.buddy)))
  }

  return SearchGroup(
    id: "actions",
    title: String(localized: "Actions", table: "Search", comment: "Search group of actions"),
    items: items)
}

private func places(_ summary: LearnerSummary) -> SearchGroup {
  let places = summary.places
  var items = [
    tab(.today),
    tab(.plan),
    SearchItem(
      id: "buddy", title: buddyName(summary), systemImage: AppTab.buddy.systemImage,
      keywords: String(
        localized: "Buddy", table: "Search", comment: "Search word that finds the buddy by role"),
      action: .select(.buddy)),
    SearchItem(
      id: "mistakes", title: String(localized: AppTab.mistakes.title),
      systemImage: AppTab.mistakes.systemImage, badge: places.readyMistakes,
      action: .open(.mistakes)),
  ]

  if places.exam {
    items.append(place(.exam, route: .exam))
  }

  if places.speaking {
    items.append(place(.speaking, route: .speaking))
  }

  if places.mindMaps {
    items.append(place(.mindMaps, route: .mindMaps))
  }

  items += [
    SearchItem(
      id: "logbook",
      title: String(
        localized: "Logbook", table: "Search", comment: "Search row for the weekly recap"),
      systemImage: "book.closed",
      action: .open(.logbook)),
    place(.statistics, route: .statistics),
    SearchItem(
      id: "courses",
      title: String(
        localized: "Explore courses", table: "Search", comment: "Search row for the catalog"),
      systemImage: "books.vertical",
      action: .open(.catalog)),
  ]

  return SearchGroup(
    id: "places",
    title: String(localized: "Go to", table: "Search", comment: "Search group of places"),
    items: items)
}

private func otherGoals(_ summary: LearnerSummary) -> SearchGroup {
  let shownID = summary.shownGoal?.id

  return SearchGroup(
    id: "goals",
    title: String(
      localized: "Your goals", table: "Search", comment: "Search group of the learner's goals"),
    items: summary.followedGoals.filter { $0.id != shownID }.map { goal in
      SearchItem(
        id: "goal-\(goal.id)",
        title: String(
          localized: "Switch to \(goal.title)", table: "Search",
          comment: "Search row that switches to another goal; the value is its title"),
        systemImage: "arrow.left.arrow.right",
        action: .switchGoal(goal.id))
    })
}

private func explanations(_ summary: LearnerSummary) -> SearchGroup {
  SearchGroup(
    id: "explanations",
    title: String(
      localized: "Quick explanations", table: "Search",
      comment: "Search group of unfinished quick explanations"),
    items: summary.openExplanations.map { goal in
      SearchItem(
        id: "explanation-\(goal.id)", title: goal.title, systemImage: "lightbulb",
        action: .open(.explain(goalId: goal.id)))
    },
    isShownWithoutQuery: false)
}

/// The shown goal's subjects (where they have their own page) and chapters, found by name.
private func plan(_ syllabus: GoalSyllabus?) -> SearchGroup {
  guard let syllabus else {
    return SearchGroup(id: "plan", title: "", items: [])
  }

  let isLanguage = syllabus.goal.kind == "language"

  let subjects =
    syllabus.hasSubjectPages
    ? syllabus.subjects.map { subject in
      SearchItem(
        id: "subject-\(subject.key)", title: subject.name, systemImage: "square.grid.2x2",
        action: .open(.subject(subjectKey: subject.key)))
    } : []

  let chapters = syllabus.subjects.flatMap(\.chapters).compactMap { chapter -> SearchItem? in
    chapter.chapterId.map { chapterId in
      SearchItem(
        id: "chapter-\(chapterId)", title: chapter.title, systemImage: "rectangle.stack",
        action: .open(
          isLanguage ? .languageUnit(chapterId: chapterId) : .chapter(chapterId: chapterId)))
    }
  }

  return SearchGroup(
    id: "plan",
    title: String(
      localized: "Your plan", table: "Search",
      comment: "Search group of the plan's subjects and chapters"),
    items: subjects + chapters,
    isShownWithoutQuery: false)
}

private func settingsGroup(isGuest: Bool) -> SearchGroup {
  func setting(_ id: String, _ title: String, _ systemImage: String) -> SearchItem {
    SearchItem(id: id, title: title, systemImage: systemImage, action: .present(.account))
  }

  var items = [
    setting(
      "settings",
      String(localized: "Settings", table: "Search", comment: "Search row for the settings"),
      "gearshape"),
    setting(
      "preferences",
      String(localized: "Preferences", table: "Search", comment: "Search row for Preferences"),
      "slider.horizontal.3"),
    setting(
      "memory",
      String(localized: "Memory", table: "Search", comment: "Search row for what Zoonk remembers"),
      "brain"),
    SearchItem(
      id: "subscription",
      title: String(
        localized: "Subscription", table: "Search", comment: "Search row for Zoonk Plus"),
      systemImage: "sparkles",
      action: .present(.subscription)),
  ]

  if !isGuest {
    items.insert(
      setting(
        "profile",
        String(localized: "Profile", table: "Search", comment: "Search row for the profile"),
        "person"),
      at: 1)
  }

  return SearchGroup(
    id: "settings",
    title: String(localized: "My account", table: "Search", comment: "Search group of settings"),
    items: items,
    isShownWithoutQuery: false)
}

private let helpGroup = SearchGroup(
  id: "help",
  title: String(localized: "Help", table: "Search", comment: "Search group of help"),
  items: [
    SearchItem(
      id: "feedback",
      title: String(
        localized: "Send feedback", table: "Search", comment: "Search row that opens feedback"),
      systemImage: "bubble.left",
      action: .feedback)
  ],
  isShownWithoutQuery: false)

private var visitorPages: SearchGroup {
  SearchGroup(
    id: "places",
    title: String(localized: "Go to", table: "Search", comment: "Search group of places"),
    items: [
      SearchItem(
        id: "courses",
        title: String(
          localized: "Explore courses", table: "Search", comment: "Search row for the catalog"),
        systemImage: "books.vertical",
        action: .open(.catalog)),
      SearchItem(
        id: "start",
        title: String(
          localized: "Start a goal", table: "Search", comment: "Search row to start a goal"),
        systemImage: "target",
        action: .select(.today)),
      SearchItem(
        id: "login",
        title: String(localized: "Log in", table: "Search", comment: "Search row to log in"),
        systemImage: "person.crop.circle",
        action: .present(.signIn)),
    ])
}

private func tab(_ tab: AppTab) -> SearchItem {
  SearchItem(
    id: "\(tab)", title: String(localized: tab.title), systemImage: tab.systemImage,
    action: .select(tab))
}

private func place(_ tab: AppTab, route: AppRoute) -> SearchItem {
  SearchItem(
    id: "\(tab)", title: String(localized: tab.title), systemImage: tab.systemImage,
    action: .open(route))
}

/// The buddy tutors a learner's goals; guests can't talk to it, as on main.
private func canAskBuddy(_ summary: LearnerSummary) -> Bool {
  !summary.identity.isAnonymous && !summary.followedGoals.isEmpty
}

private func buddyName(_ summary: LearnerSummary) -> String {
  summary.buddyDisplayName
}
