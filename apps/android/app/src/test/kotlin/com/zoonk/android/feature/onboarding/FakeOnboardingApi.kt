package com.zoonk.android.feature.onboarding

import com.zoonk.android.data.ApiError
import com.zoonk.android.data.ApiException
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.GenerationEvent
import com.zoonk.android.data.GenerationSource
import com.zoonk.android.feature.audio.VoiceRecording
import com.zoonk.api.ApiJson
import com.zoonk.api.models.AllowanceResponse
import com.zoonk.api.models.CreateUploadRequest
import com.zoonk.api.models.Generation
import com.zoonk.api.models.Goal
import com.zoonk.api.models.GoalCreateInput
import com.zoonk.api.models.GoalCreateResponse
import com.zoonk.api.models.GoalGenerationRun
import com.zoonk.api.models.LanguageLevelTest
import com.zoonk.api.models.LanguageLevelTestAnswerInput
import com.zoonk.api.models.LanguageLevelTestGeneration
import com.zoonk.api.models.LanguageLevelTestSpokenResult
import com.zoonk.api.models.LanguageLevelTestSpokenResultHeard
import com.zoonk.api.models.MaterialQuestionAnswer
import com.zoonk.api.models.MaterialQuestionInput
import com.zoonk.api.models.MockOptions
import com.zoonk.api.models.Onboarding
import com.zoonk.api.models.OnboardingAnswerInput
import com.zoonk.api.models.OnboardingDraft
import com.zoonk.api.models.OnboardingDraftEdit
import com.zoonk.api.models.Placement
import com.zoonk.api.models.PlacementAnswerInput
import com.zoonk.api.models.PlacementAnswerResult
import com.zoonk.api.models.Plan
import com.zoonk.api.models.PlanLinkStartInput
import com.zoonk.api.models.PlanTimeAdvice
import com.zoonk.api.models.PlanTimeAdviceInput
import com.zoonk.api.models.PlanTimeToCover
import com.zoonk.api.models.PlanTimeToCoverInput
import com.zoonk.api.models.Source
import com.zoonk.api.models.Syllabus
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flowOf

internal const val DRAFT_ID = "6f9d2c1e-3b4a-4c5d-8e6f-7a8b9c0d1e2f"
internal const val GOAL_ID = "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d"

internal fun understoodDraft(
    prompt: String = "pass the bar exam",
    understanding: String = goalsUnderstanding(),
): OnboardingDraft =
    ApiJson.decodeFromString(
        """{"generationId":null,"goalId":null,"id":"$DRAFT_ID","prompt":"$prompt","status":"understood","understanding":$understanding}""",
    )

internal fun failedDraft(prompt: String = "pass the bar exam"): OnboardingDraft =
    ApiJson.decodeFromString(
        """{"generationId":null,"goalId":null,"id":"$DRAFT_ID","prompt":"$prompt","status":"failed","understanding":null}""",
    )

internal fun readingDraft(
    prompt: String = "pass the bar exam",
    generationId: String = "run-1",
): OnboardingDraft =
    ApiJson.decodeFromString(
        """{"generationId":"$generationId","goalId":null,"id":"$DRAFT_ID","prompt":"$prompt","status":"understanding","understanding":null}""",
    )

internal fun goalsUnderstanding(
    title: String = "Pass the bar exam",
    kind: String = "exam",
    details: String = """{"onboardingId":"$DRAFT_ID"}""",
    examDates: String = "[]",
    targetDate: String? = null,
) = """
    {"status":"goals","schedule":{"dailyMinutes":15,"studyDays":null,"studyTime":null,"studyTimeNote":null},
     "goals":[{"cutoff":null,"examDates":$examDates,
       "draft":{"kind":"$kind","language":"en","prompt":"pass the bar exam","title":"$title","details":$details${targetDate?.let {
    ""","targetDate":"$it""""
} ?: ""}}}]}
    """.trimIndent()

internal fun goalCreated(): GoalCreateResponse =
    ApiJson.decodeFromString(
        """
        {"generations":[],"refused":[],"research":[],"goals":[{"createdAt":"2026-10-28T12:00:00Z","dailyMinutes":15,"details":{},
         "examBlueprintId":null,"id":"$GOAL_ID","isActive":true,"kind":"exam","language":"en","plan":null,"primaryCourseId":null,
         "prompt":"pass the bar exam","status":"active","studyDays":[],"studyTime":null,"targetDate":null,"targetLanguage":null,
         "timezone":null,"title":"Pass the bar exam"}]}
        """.trimIndent(),
    )

internal const val EXAM_GOAL_ID = "2b3c4d5e-6f7a-4b8c-9d0e-1f2a3b4c5d6e"

internal fun setupView(
    steps: List<String>,
    goalId: String = GOAL_ID,
    kind: String = "learn",
    details: String = """{"answered":[]}""",
    targetDate: String? = null,
    targetLanguage: String? = null,
): Onboarding =
    ApiJson.decodeFromString(
        """
        {"examChoices":[],"examDays":null,"examSubjects":[],"followUps":[],"generationId":null,"goalIds":["$goalId"],
         "libraryCourse":null,"recommendedMinutes":30,"steps":[${steps.joinToString(",") { "\"$it\"" }}],
         "goal":{"createdAt":"2026-10-28T12:00:00Z","dailyMinutes":30,"details":$details,"examBlueprintId":null,"id":"$goalId",
          "isActive":true,"kind":"$kind","language":"en","plan":null,"primaryCourseId":null,"prompt":"learn statistics","status":"active",
          "studyDays":[],"studyTime":null,"targetDate":${targetDate?.let {
            "\"$it\""
        } ?: "null"},"targetLanguage":${targetLanguage?.let { "\"$it\"" } ?: "null"},"timezone":null,"title":"Learn statistics"}}
        """.trimIndent(),
    )

internal class FakeOnboardingApi : OnboardingApi {
    var understood: (String) -> OnboardingDraft = { understoodDraft(prompt = it) }
    var draft: OnboardingDraft = understoodDraft()
    var refusal: ApiException? = null
    var events: Flow<GenerationEvent> = flowOf()
    val generationSessions = mutableListOf<AuthenticatedSession?>()
    val understandCalls = mutableListOf<Pair<String, String>>()
    val drafts = mutableListOf<String>()
    val created = mutableListOf<GoalCreateInput>()
    val fromPlans = mutableListOf<Pair<String, PlanLinkStartInput>>()
    val revisions = mutableListOf<OnboardingDraftEdit>()
    val sessions = mutableListOf<AuthenticatedSession>()

    override suspend fun understand(
        session: AuthenticatedSession,
        goal: String,
        language: String,
    ): OnboardingDraft {
        sessions += session
        understandCalls += goal to language
        refusal?.let { throw it }
        return understood(goal)
    }

    override suspend fun draft(
        session: AuthenticatedSession,
        id: String,
    ): OnboardingDraft {
        drafts += id
        return draft
    }

    var readsAgain = 0
    var readAgainGate: CompletableDeferred<Unit>? = null

    override suspend fun readAgain(
        session: AuthenticatedSession,
        id: String,
    ): OnboardingDraft {
        readsAgain++
        readAgainGate?.await()
        return draft
    }

    override suspend fun revise(
        session: AuthenticatedSession,
        id: String,
        edit: OnboardingDraftEdit,
    ): OnboardingDraft {
        revisions += edit
        return draft
    }

    override suspend fun createGoals(
        session: AuthenticatedSession,
        input: GoalCreateInput,
    ): GoalCreateResponse {
        created += input
        refusal?.let { throw it }
        return goalCreated()
    }

    override suspend fun createFromPlanLink(
        session: AuthenticatedSession,
        planId: String,
        input: PlanLinkStartInput,
    ): Goal {
        fromPlans += planId to input
        refusal?.let { throw it }
        return goalCreated().goals.single()
    }

    override suspend fun joinWaitlist(
        session: AuthenticatedSession,
        instrument: String,
        language: String,
    ) = Unit

    override suspend fun allowance(session: AuthenticatedSession): AllowanceResponse = throw ApiException(ApiError.Unavailable)

    var setup: (String) -> Onboarding = { throw ApiException(ApiError.NotFound) }
    val answers = mutableListOf<Pair<String, OnboardingAnswerInput>>()
    var reply: (String, OnboardingAnswerInput) -> Onboarding = { goalId, _ -> setup(goalId) }
    val archived = mutableListOf<String>()

    override suspend fun onboarding(
        session: AuthenticatedSession,
        goalId: String,
    ) = setup(goalId)

    override suspend fun answer(
        session: AuthenticatedSession,
        goalId: String,
        input: OnboardingAnswerInput,
    ): Onboarding {
        answers += goalId to input
        refusal?.let { throw it }
        return reply(goalId, input)
    }

    var generationId: (String) -> String? = { null }
    val generationReads = mutableListOf<String>()

    override suspend fun goalGenerationRun(
        session: AuthenticatedSession,
        goalId: String,
    ): GoalGenerationRun {
        generationReads += goalId
        return GoalGenerationRun(generationId(goalId))
    }

    override suspend fun writeGoal(
        session: AuthenticatedSession,
        goalId: String,
    ) = "run-2"

    override suspend fun archive(
        session: AuthenticatedSession,
        goalId: String,
    ) {
        archived += goalId
    }

    var advice: (PlanTimeAdviceInput) -> PlanTimeAdvice = { throw ApiException(ApiError.Unavailable) }

    override suspend fun timeAdvice(
        session: AuthenticatedSession,
        goalId: String,
        input: PlanTimeAdviceInput,
    ) = advice(input)

    override suspend fun timeToCover(
        session: AuthenticatedSession,
        goalId: String,
        input: PlanTimeToCoverInput,
    ): PlanTimeToCover = throw ApiException(ApiError.Unavailable)

    override suspend fun uploadFile(
        session: AuthenticatedSession,
        pathname: String,
        file: PickedFile,
    ) = Unit

    override suspend fun attach(
        session: AuthenticatedSession,
        request: CreateUploadRequest,
    ): Source = throw ApiException(ApiError.Unavailable)

    override suspend fun askMaterial(
        session: AuthenticatedSession,
        input: MaterialQuestionInput,
    ): MaterialQuestionAnswer = throw ApiException(ApiError.Unavailable)

    override fun generations(session: AuthenticatedSession?): GenerationSource {
        generationSessions += session
        return object : GenerationSource {
            override fun events(id: String) = this@FakeOnboardingApi.events

            override suspend fun status(id: String) = Generation.Status.RUNNING
        }
    }

    var placement: Placement = placementOf()
    var answered: (PlacementAnswerInput) -> Placement = { placementOf(status = "done", next = null, answered = 1, complete = true) }
    var mockOptions: MockOptions? = null
    var plan: Plan = planOf()
    var syllabus: Syllabus = syllabusOf(emptyList(), kind = "modules")
    var writeFailure: ApiException? = null
    var placementReads = 0
    val placementAnswers = mutableListOf<PlacementAnswerInput>()
    val finishedPlacements = mutableListOf<Boolean>()
    val finishedMocks = mutableListOf<String>()

    override suspend fun placement(
        session: AuthenticatedSession,
        goalId: String,
    ): Placement {
        placementReads++
        return placement
    }

    override suspend fun answerPlacement(
        session: AuthenticatedSession,
        goalId: String,
        input: PlacementAnswerInput,
    ): PlacementAnswerResult {
        placementAnswers += input
        writeFailure?.let { throw it }
        placement = answered(input)
        return PlacementAnswerResult(isCorrect = true, placement = placement)
    }

    override suspend fun finishPlacement(
        session: AuthenticatedSession,
        goalId: String,
        fromScratch: Boolean,
    ) {
        writeFailure?.let { throw it }
        finishedPlacements += fromScratch
    }

    override suspend fun mockOptions(
        session: AuthenticatedSession,
        goalId: String,
    ): MockOptions = mockOptions ?: throw ApiException(ApiError.Unavailable, code = "NOT_AN_EXAM")

    override suspend fun finishMock(
        session: AuthenticatedSession,
        mockId: String,
    ) {
        finishedMocks += mockId
    }

    override suspend fun plan(
        session: AuthenticatedSession,
        goalId: String,
    ): Plan = plan

    override suspend fun syllabus(
        session: AuthenticatedSession,
        goalId: String,
    ): Syllabus = syllabus

    var levelTest: LanguageLevelTest = levelTestOf()
    var levelTestReads = 0
    var preparation = LanguageLevelTestGeneration(generationId = "bank-run", status = LanguageLevelTestGeneration.Status.STARTED)
    var prepared = 0
    var levelTestAnswered: (LanguageLevelTestAnswerInput) -> LanguageLevelTest = { levelTestOf(answered = 1, next = DONE_NEXT) }
    val levelTestAnswers = mutableListOf<LanguageLevelTestAnswerInput>()
    var spoken: () -> LanguageLevelTest = { levelTestOf(answered = 1, next = DONE_NEXT) }
    val spokenTakes = mutableListOf<VoiceRecording>()
    var finishedLevelTests = 0

    override suspend fun levelTest(
        session: AuthenticatedSession,
        goalId: String,
    ): LanguageLevelTest {
        levelTestReads++
        return levelTest
    }

    override suspend fun prepareLevelTest(
        session: AuthenticatedSession,
        goalId: String,
    ): LanguageLevelTestGeneration {
        prepared++
        writeFailure?.let { throw it }
        return preparation
    }

    override suspend fun answerLevelTest(
        session: AuthenticatedSession,
        goalId: String,
        input: LanguageLevelTestAnswerInput,
    ): LanguageLevelTest {
        levelTestAnswers += input
        writeFailure?.let { throw it }
        levelTest = levelTestAnswered(input)
        return levelTest
    }

    override suspend fun speakLevelTest(
        session: AuthenticatedSession,
        goalId: String,
        recording: VoiceRecording,
    ): LanguageLevelTestSpokenResult {
        spokenTakes += recording
        writeFailure?.let { throw it }
        levelTest = spoken()
        return LanguageLevelTestSpokenResult(LanguageLevelTestSpokenResultHeard(1.0, "Vorrei un caffè", emptyList()), levelTest)
    }

    override suspend fun finishLevelTest(
        session: AuthenticatedSession,
        goalId: String,
    ) {
        writeFailure?.let { throw it }
        finishedLevelTests++
    }
}
