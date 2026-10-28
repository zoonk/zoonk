import Foundation
import Observation

/// Starting a goal: reading the typed words, creating the goals, and the goal's own onboarding screens. Generation runs start only from these calls, which a learner's tap makes.
@MainActor
@Observable
final class OnboardingStore {
  /// Words Today's box sent with the tap that opened the start flow, read once by it.
  private(set) var sentGoal: String?

  @ObservationIgnored private let api: OnboardingAPI
  @ObservationIgnored private let cache: AppCache
  @ObservationIgnored private let clients: APIClientFactory
  @ObservationIgnored private let session: SessionStore
  @ObservationIgnored private var onboardings: [String: Resource<GoalOnboarding>] = [:]
  @ObservationIgnored private var planLinks: [String: Resource<Components.Schemas.PlanLink>] = [:]

  init(clients: APIClientFactory, cache: AppCache, session: SessionStore) {
    self.api = OnboardingAPI(clients: clients)
    self.cache = cache
    self.clients = clients
    self.session = session
  }

  /// Hands the words to the start flow Today opens next; it reads them once.
  func send(goal: String) {
    sentGoal = goal
  }

  func takeSentGoal() -> String? {
    defer { sentGoal = nil }
    return sentGoal
  }

  /// The learner's bearer, signing a visitor in as a guest first, as main does when a visitor sends a goal.
  func token() async throws -> String {
    if let token = session.authenticatedSession?.bearerToken {
      return token
    }

    guard await session.continueAsGuest(), let token = session.authenticatedSession?.bearerToken
    else {
      throw OnboardingError.failed(.unauthorized)
    }

    return token
  }

  func understand(goal: String) async throws -> OnboardingDraft {
    try await api.understand(goal: goal, token: token())
  }

  func understanding(id: String) async throws -> OnboardingDraft {
    try await api.understanding(id: id, token: token())
  }

  func readAgain(id: String) async throws -> OnboardingDraft {
    try await api.readAgain(id: id, token: token())
  }

  /// Saves one fix on the card: a goal's fact by its place on the card, or when the learner studies.
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

    return try await api.revise(
      id: draftID,
      edit: JSONDecoder().decode(
        Components.Schemas.OnboardingDraftEdit.self,
        from: JSONSerialization.data(withJSONObject: edit)),
      token: token())
  }

  func events(generationID: String) -> AsyncThrowingStream<GenerationEvent, Error> {
    clients.generationEvents(id: generationID, token: session.authenticatedSession?.bearerToken)
  }

  /// Creates the goals the learner confirmed on the card; they share the day's time. Returns the main goal's id.
  func createGoals(
    _ goals: [Components.Schemas.GoalDraftOutput],
    schedule: Components.Schemas.GoalUnderstanding.Case1Payload.SchedulePayload
  ) async throws -> String {
    try await create(
      .init(
        dailyMinutes: schedule.dailyMinutes,
        goals: try goals.map { try PracticeJSON.recode($0) },
        studyDays: schedule.studyDays,
        studyTime: schedule.studyTime,
        timeZone: TimeZone.current.identifier))
  }

  /// A question gets its quick explanation: an explain goal named after it, closing the draft.
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

  /// Musicianship for an instrument (reading music, ear training and rhythm): a learn goal to start today.
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
    try await api.joinInstrumentWaitlist(
      instrument: instrument, token: session.authenticatedSession?.bearerToken)
  }

  /// The rest of a new goal's onboarding, one screen per question, ending with the plan.
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

  /// Saves one answer; the response is the screens still ahead, shown without another read.
  func answer(_ answer: OnboardingAnswer, goalID: String) async throws -> GoalOnboarding {
    let updated = try await api.answer(answer, goalID: goalID, token: token())
    onboarding(goalID: updated.goal.id).update { _ in updated }
    cache.invalidate([.goals, .learningProfile])
    return updated
  }

  /// Starts the goal's curriculum again after its run stopped.
  func writeGoal(goalID: String) async throws -> String {
    try await api.writeGoal(goalID: goalID, token: token())
  }

  /// "Start over" archives every goal this onboarding created, so the next goal starts clean.
  func startOver(goalIDs: [String]) async throws {
    let token = try await token()

    try await withThrowingTaskGroup { group in
      for goalID in goalIDs {
        group.addTask { [api] in try await api.archive(goalID: goalID, token: token) }
      }

      try await group.waitForAll()
    }

    cache.invalidate([.goals, .learningProfile])
  }

  func placement(goalID: String) async throws -> GoalPlacement {
    try await api.placement(goalID: goalID, token: token())
  }

  func answerPlacement(
    goalID: String,
    itemID: String,
    answer: PracticeAnswer,
    duration: Duration
  ) async throws -> Components.Schemas.PlacementAnswerResult {
    let result = try await api.answerPlacement(
      .init(
        answer: PracticeJSON.recode(answer),
        durationMs: Int(duration.components.seconds * 1000),
        itemId: itemID,
        timeZone: TimeZone.current.identifier),
      goalID: goalID,
      token: token())

    cache.invalidate([.learnerModel])
    return result
  }

  /// Ends placement, then writes the plan's first lessons ahead, as main does once it's done.
  func finishPlacement(goalID: String, fromScratch: Bool) async throws {
    let token = try await token()
    try await api.completePlacement(goalID: goalID, fromScratch: fromScratch, token: token)
    try? await api.prepareLessons(goalID: goalID, token: token)
    cache.invalidate([.goals, .learnerModel, .learningProfile])
  }

  /// Starts a Library course as the learner's goal from its start page's tap; a visitor becomes a guest first.
  func startCourse(courseID: String, chapterID: String?, level: String?) async throws -> String {
    let goalID = try await api.startCourse(
      courseID: courseID, chapterID: chapterID, level: level, token: token())
    cache.invalidate([.goals, .learningProfile])
    return goalID
  }

  /// A shared plan's outline, as anyone reads it; a signed-in owner is sent to their own plan.
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
    let started = try await api.startFromPlanLink(
      id: id, dailyMinutes: dailyMinutes, token: token())
    cache.invalidate([.goals, .learningProfile])
    return started
  }

  /// Skips a language goal's level test: the plan starts from the level the learner gave.
  func skipLevelTest(goalID: String) async throws {
    try await api.finishLevelTest(goalID: goalID, token: token())
    cache.invalidate([.goals, .learnerModel, .learningProfile])
  }

  private func create(_ input: Components.Schemas.GoalCreateInput) async throws -> String {
    let response = try await api.createGoals(input, token: token())
    cache.invalidate([.goals, .learningProfile])

    guard let goalID = response.goals.first?.id else {
      throw OnboardingError.failed(.unavailable)
    }

    return goalID
  }

  /// The day's time an explanation takes, as main sends it.
  private static let explanationMinutes = 5

  /// Musicianship starts with a gentle daily time.
  private static let musicianshipMinutes = 15

  private static func goalDraft(_ json: [String: Any]) throws -> Components.Schemas.GoalDraft {
    try JSONDecoder().decode(
      Components.Schemas.GoalDraft.self, from: JSONSerialization.data(withJSONObject: json))
  }
}
