import Foundation
import Observation

/// Generation runs start only from these calls, which a learner's tap makes.
@MainActor
@Observable
final class OnboardingStore {
  private(set) var sentGoal: SentGoal?
  let resume: Resource<OnboardingResume>
  /// What each goal run's stream said of its deck: ready (its id), or nil once the run ended its
  /// deck step without one. A wait trusts this over an onboarding read that may be older.
  private var decks: [String: String?] = [:]

  @ObservationIgnored private let api: OnboardingAPI
  @ObservationIgnored private let cache: AppCache
  @ObservationIgnored private let clients: APIClientFactory
  @ObservationIgnored private let session: SessionStore
  @ObservationIgnored private var onboardings: [String: Resource<GoalOnboarding>] = [:]
  @ObservationIgnored private var planLinks: [String: Resource<Components.Schemas.PlanLink>] = [:]
  @ObservationIgnored private var revealDays: [String: Resource<PlanRevealRead>] = [:]

  init(clients: APIClientFactory, cache: AppCache, session: SessionStore) {
    let api = OnboardingAPI(clients: clients)
    self.api = api
    self.cache = cache
    self.clients = clients
    self.session = session
    resume = cache.resource(
      audience: .signedIn, domains: [.goals], isEmpty: { $0.draft == nil },
      fetch: { session in
        guard let session else {
          return nil
        }

        return try await api.resume(token: session.bearerToken)
      })
  }

  func send(_ goal: SentGoal) {
    sentGoal = goal
  }

  func takeSentGoal() -> SentGoal? {
    defer { sentGoal = nil }
    return sentGoal
  }

  /// So the write that follows has a session to belong to.
  private func ensureSession() async throws {
    guard await session.continueAsGuest() else {
      throw OnboardingError.failed(.unauthorized)
    }
  }

  func understand(goal: String) async throws -> OnboardingDraft {
    try await ensureSession()
    let draft = try await cache.onboardingWrite { [api] identity in
      try await api.understand(goal: goal, token: identity.bearerToken)
    }

    resume.invalidate()
    return draft
  }

  /// Reading starts nothing.
  func understanding(id: String) async throws -> OnboardingDraft {
    guard let token = session.authenticatedSession?.bearerToken else {
      throw CancellationError()
    }

    return try await api.understanding(id: id, token: token)
  }

  func readAgain(id: String) async throws -> OnboardingDraft {
    try await cache.onboardingWrite { [api] identity in
      try await api.readAgain(id: id, token: identity.bearerToken)
    }
  }

  func revise(
    draftID: String,
    field: UnderstoodField,
    goal: Int,
    value: String
  ) async throws -> OnboardingDraft {
    var edit: [String: Any] = ["field": field.rawValue, "value": value]

    if field != .studyTime {
      edit["goal"] = goal
    }

    let draftEdit = try JSONDecoder().decode(
      Components.Schemas.OnboardingDraftEdit.self,
      from: JSONSerialization.data(withJSONObject: edit))

    return try await cache.onboardingWrite { [api] identity in
      try await api.revise(id: draftID, edit: draftEdit, token: identity.bearerToken)
    }
  }

  func events(generationID: String) -> AsyncThrowingStream<GenerationEvent, Error> {
    clients.generationEvents(id: generationID, token: session.authenticatedSession?.bearerToken)
  }

  func found(deckID: String, generationID: String) {
    if decks[generationID] != .some(deckID) {
      decks[generationID] = .some(deckID)
    }
  }

  /// The deck a wait deals from, and whether one is on its way: the onboarding read names the
  /// deck at open, and the run's stream says when it's ready or that none is coming.
  func waitDeck(for view: GoalOnboarding) -> WaitDeck {
    if let generationID = view.generationId, let heard = decks[generationID] {
      return WaitDeck(id: heard, isComing: false)
    }

    switch view.warmUp?.status {
    case .ready?: return WaitDeck(id: view.warmUp?.id, isComing: false)
    case .writing?: return WaitDeck(id: nil, isComing: true)
    case nil: return WaitDeck(id: nil, isComing: false)
    }
  }

  /// Follows a goal's run until it says whether its deck is ready, so every wait after it knows.
  /// Returns the deck once it's ready; nil when the run ended its deck step without one, or ended.
  func followDeck(generationID: String) async -> String? {
    do {
      for try await event in events(generationID: generationID) {
        if let id = event.warmUpID {
          found(deckID: id, generationID: generationID)
          return id
        }

        if event.step == "warmUpFailed", event.status == "completed" {
          break
        }
      }
    } catch is GenerationStopped {
      // A stopped run writes no deck.
    } catch {
      // A broken stream says nothing about the deck.
      return nil
    }

    if !Task.isCancelled {
      decks[generationID] = .some(nil)
    }

    return nil
  }

  /// In the draft's `timeZone`, which counted the learner's today for the card's dates.
  func createGoals(
    _ goals: [Components.Schemas.GoalDraftOutput],
    schedule: Components.Schemas.GoalUnderstanding.Case1Payload.SchedulePayload,
    sourceIDs: [String],
    timeZone: String
  ) async throws -> String {
    try await create(
      .init(
        dailyMinutes: schedule.dailyMinutes,
        goals: try goals.map { try PracticeJSON.recode($0) },
        sourceIds: sourceIDs.isEmpty ? nil : sourceIDs,
        studyDays: schedule.studyDays,
        studyTime: schedule.studyTime,
        timeZone: timeZone))
  }

  func startWaitingGoal(_ goal: LearnerWaitingGoal) async throws -> String {
    var input: Components.Schemas.GoalCreateInput = try PracticeJSON.recode(goal.input)
    input.timeZone = TimeZone.current.identifier
    return try await create(input)
  }

  func createExplanation(draft: OnboardingDraft, question: String) async throws -> String {
    try await create(
      .init(
        dailyMinutes: Self.explanationMinutes,
        goals: [
          try Self.goalDraft([
            "details": ["onboardingId": draft.id, "question": draft.prompt],
            "kind": "explain",
            "language": OnboardingAPI.language,
            "prompt": draft.prompt,
            "title": question,
          ])
        ],
        timeZone: TimeZone.current.identifier))
  }

  func createMusicianship(draft: OnboardingDraft, instrument: String) async throws -> String {
    try await create(
      .init(
        dailyMinutes: Self.musicianshipMinutes,
        goals: [
          try Self.goalDraft([
            "details": [
              "instrument": instrument, "onboardingId": draft.id,
              "subject": String(
                localized: LocalizedStringResource(
                  "musicianship", table: "Onboarding",
                  comment: "The subject of a musicianship goal, mid-sentence")),
            ],
            "kind": "learn",
            "language": OnboardingAPI.language,
            "prompt": draft.prompt,
            "title": String(
              localized: LocalizedStringResource(
                "Musicianship for \(instrument)", table: "Onboarding",
                comment: "Title of the goal that teaches musicianship for an instrument")),
          ])
        ],
        timeZone: TimeZone.current.identifier))
  }

  func joinInstrumentWaitlist(instrument: String) async throws -> WaitlistOutcome {
    try await cache.onboardingWrite { [api] identity in
      try await api.joinInstrumentWaitlist(instrument: instrument, token: identity.bearerToken)
    }
  }

  func onboarding(goalID: String) -> Resource<GoalOnboarding> {
    if let resource = onboardings[goalID] {
      return resource
    }

    // Only this flow's answers change it, and each answer's response is the new value.
    let resource: Resource<GoalOnboarding> = cache.resource(audience: .signedIn) { [api] session in
      guard let session else {
        return nil
      }

      return try await api.onboarding(goalID: goalID, token: session.bearerToken)
    }

    onboardings[goalID] = resource
    return resource
  }

  func answer(_ answer: OnboardingAnswer, goalID: String) async throws -> GoalOnboarding {
    let updated = try await cache.onboardingWrite(invalidating: [.goals, .learningProfile]) {
      [api] identity in
      try await api.answer(answer, goalID: goalID, token: identity.bearerToken)
    }

    onboarding(goalID: updated.goal.id).update { _ in updated }
    return updated
  }

  /// The reveal's Today: the goal's first day as Today will show it. Reading it writes nothing.
  func revealToday(goalID: String) -> Resource<PlanRevealRead> {
    if let resource = revealDays[goalID] {
      return resource
    }

    let resource: Resource<PlanRevealRead> = cache.resource(
      audience: .signedIn, domains: [.goals, .learnerModel, .userProgress]
    ) { [api] session in
      guard let session else {
        return nil
      }

      return try await api.revealToday(goalID: goalID, token: session.bearerToken)
    }

    revealDays[goalID] = resource
    return resource
  }

  /// The reveal's action: until it's saved, resume and Today bring the learner back to the plan.
  func markPlanRevealed(goalID: String) async throws {
    try await cache.onboardingWrite(invalidating: [.goals]) { [api] identity in
      try await api.markPlanRevealed(goalID: goalID, token: identity.bearerToken)
    }

    onboarding(goalID: goalID).invalidate()
  }

  func writeGoal(goalID: String) async throws -> String {
    try await cache.onboardingWrite { [api] identity in
      try await api.writeGoal(goalID: goalID, token: identity.bearerToken)
    }
  }

  func startOver(goalIDs: [String]) async throws {
    try await cache.onboardingWrite(invalidating: [.goals, .learningProfile]) { [api] identity in
      try await withThrowingTaskGroup { group in
        for goalID in goalIDs {
          group.addTask { try await api.archive(goalID: goalID, token: identity.bearerToken) }
        }

        try await group.waitForAll()
      }
    }
  }

  /// Reading it writes nothing.
  func placement(goalID: String) async throws -> GoalPlacement {
    guard let token = session.authenticatedSession?.bearerToken else {
      throw CancellationError()
    }

    return try await api.placement(goalID: goalID, token: token)
  }

  func answerPlacement(
    goalID: String,
    itemID: String,
    answer: PracticeAnswer,
    duration: Duration
  ) async throws -> Components.Schemas.PlacementAnswerResult {
    let input = Components.Schemas.PlacementAnswerInput(
      answer: try PracticeJSON.recode(answer),
      durationMs: Int(duration.components.seconds * 1000),
      itemId: itemID,
      timeZone: TimeZone.current.identifier)

    return try await cache.onboardingWrite(invalidating: [.learnerModel]) { [api] identity in
      try await api.answerPlacement(input, goalID: goalID, token: identity.bearerToken)
    }
  }

  func finishPlacement(goalID: String, fromScratch: Bool) async throws {
    try await cache.onboardingWrite(invalidating: [.goals, .learnerModel, .learningProfile]) {
      [api] identity in
      try await api.completePlacement(
        goalID: goalID, fromScratch: fromScratch, token: identity.bearerToken)
    }
  }

  func startCourse(courseID: String, chapterID: String?, level: String?) async throws -> String {
    try await ensureSession()
    return try await cache.onboardingWrite(invalidating: [.goals, .learningProfile]) {
      [api] identity in
      try await api.startCourse(
        courseID: courseID, chapterID: chapterID, level: level, token: identity.bearerToken)
    }
  }

  func planLink(id: String) -> Resource<Components.Schemas.PlanLink> {
    if let resource = planLinks[id] {
      return resource
    }

    let resource: Resource<Components.Schemas.PlanLink> = cache.resource(audience: .viewer) {
      [api] session in
      try await api.planLink(id: id, token: session?.bearerToken)
    }

    planLinks[id] = resource
    return resource
  }

  func startFromPlanLink(id: String, dailyMinutes: Int) async throws -> (
    goalID: String, isNew: Bool
  ) {
    try await ensureSession()
    return try await cache.onboardingWrite(invalidating: [.goals, .learningProfile]) {
      [api] identity in
      try await api.startFromPlanLink(
        id: id, dailyMinutes: dailyMinutes, token: identity.bearerToken)
    }
  }

  /// `aim` asks about a language goal's other aim; nil answers for its own.
  func timeAdvice(
    goalID: String, week: ScheduleWeek, dailyMinutes: Int, aim: String? = nil
  ) async throws -> TimeAdvice {
    guard let token = session.authenticatedSession?.bearerToken else {
      throw CancellationError()
    }

    return try await api.timeAdvice(
      goalID: goalID, week: week, dailyMinutes: dailyMinutes, aim: aim, token: token)
  }

  func timeToCover(goalID: String, week: ScheduleWeek) async throws -> TimeToCover {
    guard let token = session.authenticatedSession?.bearerToken else {
      throw CancellationError()
    }

    return try await api.timeToCover(goalID: goalID, week: week, token: token)
  }

  func attach(_ material: MaterialInput) async throws -> AttachedSource {
    try await cache.onboardingWrite { [api] identity in
      try await api.attach(material, token: identity.bearerToken)
    }
  }

  /// A name can't nest folders or climb out with "..", and its own id keeps two files of the same
  /// name apart.
  func attachFile(_ file: URL, goal: (id: String, language: String)? = nil) async throws
    -> AttachedSource
  {
    guard let userID = session.account?.user.id else {
      throw OnboardingError.signUpRequired
    }

    let name = file.lastPathComponent.replacing("/", with: "-").replacing(/\.{2,}/, with: ".")
    let pathname = "sources/\(userID)/\(UUID().uuidString.lowercased())-\(name)"

    return try await cache.onboardingWrite { [api] identity in
      try await api.upload(file: file, pathname: pathname, token: identity.bearerToken)
      return try await api.attach(.file(pathname, goal: goal), token: identity.bearerToken)
    }
  }

  func askMaterial(question: String, sourceIDs: [String]) async throws -> MaterialAnswer {
    try await cache.onboardingWrite { [api] identity in
      try await api.askMaterial(
        question: question, sourceIDs: sourceIDs, token: identity.bearerToken)
    }
  }

  func levelTest(goalID: String) async throws -> LevelTest {
    guard let token = session.authenticatedSession?.bearerToken else {
      throw CancellationError()
    }

    return try await api.levelTest(goalID: goalID, token: token)
  }

  /// Only from the learner's tap; nil once the questions are written.
  func prepareLevelTest(goalID: String) async throws -> String? {
    try await cache.onboardingWrite { [api] identity in
      try await api.prepareLevelTest(goalID: goalID, token: identity.bearerToken)
    }
  }

  func answerLevelTest(
    goalID: String,
    questionID: String,
    answerIndex: Int?,
    skipped: Bool,
    duration: Duration
  ) async throws -> LevelTest {
    let input = Components.Schemas.LanguageLevelTestAnswerInput(
      answerIndex: answerIndex,
      durationMs: Int(duration.components.seconds * 1000), questionId: questionID,
      skipped: skipped ? true : nil)

    return try await cache.onboardingWrite { [api] identity in
      try await api.answerLevelTest(input, goalID: goalID, token: identity.bearerToken)
    }
  }

  func finishLevelTest(goalID: String) async throws {
    try await cache.onboardingWrite(invalidating: [.goals, .learnerModel, .learningProfile]) {
      [api] identity in
      try await api.finishLevelTest(goalID: goalID, token: identity.bearerToken)
    }

    // The finish writes the tested level into the goal, which the plan so far shows beside the result.
    onboarding(goalID: goalID).invalidate()
  }

  private func create(_ input: Components.Schemas.GoalCreateInput) async throws -> String {
    let response = try await cache.onboardingWrite(invalidating: [.goals, .learningProfile]) {
      [api] identity in
      try await api.createGoals(input, token: identity.bearerToken)
    }

    guard let goalID = response.goals.first?.id else {
      throw OnboardingError.failed(.unavailable)
    }

    return goalID
  }

  private static let explanationMinutes = 5

  private static let musicianshipMinutes = 15

  private static func goalDraft(_ json: [String: Any]) throws -> Components.Schemas.GoalDraft {
    try JSONDecoder().decode(
      Components.Schemas.GoalDraft.self, from: JSONSerialization.data(withJSONObject: json))
  }
}

extension AppCache {
  /// Throws a product refusal as its `OnboardingError`, an `APIError` failure as
  /// `OnboardingError.failed`, and a result for a session that changed meanwhile as
  /// `CancellationError`, which screens ignore.
  func onboardingWrite<Value: Sendable>(
    invalidating domains: Set<DataDomain> = [],
    _ write: (AuthenticatedSession) async throws -> Value
  ) async throws -> Value {
    let result = await mutate(invalidating: domains) {
      identity -> Result<Value, OnboardingError> in
      do {
        return .success(try await write(identity))
      } catch let refusal as OnboardingError {
        return .failure(refusal)
      }
    }

    switch result {
    case .done(let outcome):
      return try outcome.get()
    case .failed(let error):
      throw OnboardingError.failed(error)
    case .obsolete:
      throw CancellationError()
    }
  }
}
