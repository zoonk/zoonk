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

  /// Signs a visitor in as a guest first, as main does when a visitor sends a goal or starts a
  /// course, so the write that follows has a session to belong to.
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

  /// Reads a draft again once its run reports it's done; reading starts nothing.
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

  /// Creates the goals the learner confirmed on the card; they share the day's time. Returns the main goal's id.
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
    try await cache.onboardingWrite { [api] identity in
      try await api.joinInstrumentWaitlist(instrument: instrument, token: identity.bearerToken)
    }
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
    let updated = try await cache.onboardingWrite(invalidating: [.goals, .learningProfile]) {
      [api] identity in
      try await api.answer(answer, goalID: goalID, token: identity.bearerToken)
    }

    onboarding(goalID: updated.goal.id).update { _ in updated }
    return updated
  }

  /// Starts the goal's curriculum again after its run stopped.
  func writeGoal(goalID: String) async throws -> String {
    try await cache.onboardingWrite { [api] identity in
      try await api.writeGoal(goalID: goalID, token: identity.bearerToken)
    }
  }

  /// "Start over" archives every goal this onboarding created, so the next goal starts clean.
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

  /// Placement's next step; reading it writes nothing.
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

  /// Ends placement, then writes the plan's first lessons ahead, as main does once it's done.
  func finishPlacement(goalID: String, fromScratch: Bool) async throws {
    try await cache.onboardingWrite(invalidating: [.goals, .learnerModel, .learningProfile]) {
      [api] identity in
      try await api.completePlacement(
        goalID: goalID, fromScratch: fromScratch, token: identity.bearerToken)
      try? await api.prepareLessons(goalID: goalID, token: identity.bearerToken)
    }
  }

  /// Starts a Library course as the learner's goal from its start page's tap; a visitor becomes a guest first.
  func startCourse(courseID: String, chapterID: String?, level: String?) async throws -> String {
    try await ensureSession()
    return try await cache.onboardingWrite(invalidating: [.goals, .learningProfile]) {
      [api] identity in
      try await api.startCourse(
        courseID: courseID, chapterID: chapterID, level: level, token: identity.bearerToken)
    }
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

  /// Saves pasted text or a link as the learner's own material.
  func attach(_ material: MaterialInput) async throws -> AttachedSource {
    try await cache.onboardingWrite { [api] identity in
      try await api.attach(material, token: identity.bearerToken)
    }
  }

  /// A file the learner picked: uploaded into their own folder (`sources/{userId}/`), then saved like pasted text. A name can't nest folders or climb out with "..", and its own id keeps two files of the same name apart.
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

  /// A question about the learner's material, answered from its pages.
  func askMaterial(question: String, sourceIDs: [String]) async throws -> MaterialAnswer {
    try await cache.onboardingWrite { [api] identity in
      try await api.askMaterial(
        question: question, sourceIDs: sourceIDs, token: identity.bearerToken)
    }
  }

  func placementMock(goalID: String) async throws -> PlacementMock {
    guard let token = session.authenticatedSession?.bearerToken else {
      throw CancellationError()
    }

    return try await api.placementMock(goalID: goalID, token: token)
  }

  /// Stops the placement mock, then ends placement: the mock's answers set where the plan starts.
  func stopPlacementMock(id: String, goalID: String) async throws {
    try await cache.onboardingWrite(invalidating: [.learnerModel, .userProgress]) {
      [api] identity in
      try await api.stopMock(id: id, token: identity.bearerToken)
    }
    try await finishPlacement(goalID: goalID, fromScratch: false)
  }

  func levelTest(goalID: String) async throws -> LevelTest {
    guard let token = session.authenticatedSession?.bearerToken else {
      throw CancellationError()
    }

    return try await api.levelTest(goalID: goalID, token: token)
  }

  /// The learner's tap asks for the pair's questions; the run writing them, or nil once they're written.
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

  /// Ends a language goal's level test with its answers, or skips it: the plan starts from the level the learner gave.
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

  /// The day's time an explanation takes, as main sends it.
  private static let explanationMinutes = 5

  /// Musicianship starts with a gentle daily time.
  private static let musicianshipMinutes = 15

  private static func goalDraft(_ json: [String: Any]) throws -> Components.Schemas.GoalDraft {
    try JSONDecoder().decode(
      Components.Schemas.GoalDraft.self, from: JSONSerialization.data(withJSONObject: json))
  }
}

extension AppCache {
  /// `mutate` for onboarding's writes, which the API can refuse for a product reason (a goal
  /// limit, the guests' daily budget, haste): a refusal is thrown as that `OnboardingError`, an
  /// `APIError` failure as `OnboardingError.failed`, and a result for a session that ended or
  /// changed meanwhile (or signed out on `unauthorized`) as `CancellationError`, which screens
  /// ignore: nothing they'd show belongs to the learner on screen now.
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
