import Foundation
import Observation

/// Generation runs start only from these calls, which a learner's tap makes.
@MainActor
@Observable
final class OnboardingStore {
  private(set) var sentGoal: SentGoal?

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

  func send(_ goal: SentGoal) {
    sentGoal = goal
  }

  func takeSentGoal() -> SentGoal? {
    defer { sentGoal = nil }
    return sentGoal
  }

  /// So the write that follows has a session to belong to.
  private func ensureSession() async throws {
    if session.authenticatedSession != nil {
      return
    }

    guard await session.continueAsGuest() else {
      throw OnboardingError.failed(.unauthorized)
    }
  }

  func understand(goal: String) async throws -> OnboardingDraft {
    try await ensureSession()
    return try await cache.onboardingWrite { [api] identity in
      try await api.understand(goal: goal, token: identity.bearerToken)
    }
  }

  /// Reading starts nothing.
  func understanding(id: String) async throws -> OnboardingDraft {
    guard let token = session.authenticatedSession?.bearerToken else {
      throw CancellationError()
    }

    return try await api.understanding(id: id, token: token)
  }

  func generationStatus(id: String) async throws -> GenerationStatus {
    guard let token = session.authenticatedSession?.bearerToken else {
      throw CancellationError()
    }

    return try await api.generationStatus(id: id, token: token)
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

  func createGoals(
    _ goals: [Components.Schemas.GoalDraftOutput],
    schedule: Components.Schemas.GoalUnderstanding.Case1Payload.SchedulePayload,
    sourceIDs: [String]
  ) async throws -> String {
    try await create(
      .init(
        dailyMinutes: schedule.dailyMinutes,
        goals: try goals.map { try PracticeJSON.recode($0) },
        sourceIds: sourceIDs.isEmpty ? nil : sourceIDs,
        studyDays: schedule.studyDays,
        studyTime: schedule.studyTime,
        timeZone: TimeZone.current.identifier))
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
      try? await api.prepareLessons(goalID: goalID, token: identity.bearerToken)
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

  func timeAdvice(goalID: String, week: ScheduleWeek, dailyMinutes: Int) async throws -> TimeAdvice
  {
    guard let token = session.authenticatedSession?.bearerToken else {
      throw CancellationError()
    }

    return try await api.timeAdvice(
      goalID: goalID, week: week, dailyMinutes: dailyMinutes, token: token)
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
  func attachFile(_ file: URL) async throws -> AttachedSource {
    guard let userID = session.account?.user.id else {
      throw OnboardingError.signUpRequired
    }

    let name = file.lastPathComponent.replacing("/", with: "-").replacing(/\.{2,}/, with: ".")
    let pathname = "sources/\(userID)/\(UUID().uuidString.lowercased())-\(name)"

    return try await cache.onboardingWrite { [api] identity in
      try await api.upload(file: file, pathname: pathname, token: identity.bearerToken)
      return try await api.attach(.file(pathname), token: identity.bearerToken)
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
    duration: Duration
  ) async throws -> LevelTest {
    let input = Components.Schemas.LanguageLevelTestAnswerInput(
      answerIndex: answerIndex,
      durationMs: Int(duration.components.seconds * 1000), questionId: questionID)

    return try await cache.onboardingWrite { [api] identity in
      try await api.answerLevelTest(input, goalID: goalID, token: identity.bearerToken)
    }
  }

  func finishLevelTest(goalID: String) async throws {
    try await cache.onboardingWrite(invalidating: [.goals, .learnerModel, .learningProfile]) {
      [api] identity in
      try await api.finishLevelTest(goalID: goalID, token: identity.bearerToken)
    }
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
