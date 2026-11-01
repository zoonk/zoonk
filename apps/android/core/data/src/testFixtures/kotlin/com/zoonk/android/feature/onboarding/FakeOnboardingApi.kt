package com.zoonk.android.feature.onboarding

import com.zoonk.android.data.ApiError
import com.zoonk.android.data.ApiException
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.Audience
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
import com.zoonk.api.models.Onboarding
import com.zoonk.api.models.OnboardingAnswerInput
import com.zoonk.api.models.OnboardingDraft
import com.zoonk.api.models.OnboardingDraftEdit
import com.zoonk.api.models.Placement
import com.zoonk.api.models.PlacementAnswerInput
import com.zoonk.api.models.PlacementAnswerResult
import com.zoonk.api.models.PlanLink
import com.zoonk.api.models.PlanLinkStartInput
import com.zoonk.api.models.PlanTimeAdvice
import com.zoonk.api.models.PlanTimeAdviceInput
import com.zoonk.api.models.PlanTimeToCover
import com.zoonk.api.models.PlanTimeToCoverInput
import com.zoonk.api.models.PlanTimeToCoverSuggested
import com.zoonk.api.models.Source
import com.zoonk.api.models.TodayUploadRequest
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flowOf
import kotlinx.datetime.LocalDate
import kotlinx.serialization.json.JsonObject
import java.util.UUID

const val DRAFT_ID = "6f9d2c1e-3b4a-4c5d-8e6f-7a8b9c0d1e2f"
const val GOAL_ID = "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d"

fun understoodDraft(
    prompt: String = "pass the bar exam",
    understanding: String = goalsUnderstanding(),
): OnboardingDraft =
    ApiJson.decodeFromString(
        """{"activeGoalLimit":null,"generationId":null,"goalId":null,"id":"$DRAFT_ID","prompt":"$prompt","status":"understood","understanding":$understanding}""",
    )

fun failedDraft(): OnboardingDraft =
    ApiJson.decodeFromString(
        """{"activeGoalLimit":null,"generationId":null,"goalId":null,"id":"$DRAFT_ID","prompt":"pass the bar exam","status":"failed","understanding":null}""",
    )

fun readingDraft(prompt: String = "pass the bar exam"): OnboardingDraft =
    ApiJson.decodeFromString(
        """{"activeGoalLimit":null,"generationId":"run-1","goalId":null,"id":"$DRAFT_ID","prompt":"$prompt","status":"understanding","understanding":null}""",
    )

fun goalsUnderstanding(
    title: String = "Pass the bar exam",
    details: String = """{"onboardingId":"$DRAFT_ID"}""",
    examDates: String = "[]",
    targetDate: String? = null,
) = """
    {"status":"goals","schedule":{"dailyMinutes":15,"studyDays":null,"studyTime":null,"studyTimeNote":null},
     "goals":[{"cutoff":null,"examDates":$examDates,
       "draft":{"kind":"exam","language":"en","prompt":"pass the bar exam","title":"$title","details":$details${targetDate?.let {
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

private const val UPLOAD_ID = "8c1d2e3f-4a5b-4c6d-9e7f-8a9b0c1d2e3f"

fun uploadAskOf(): TodayUploadRequest =
    ApiJson.decodeFromString(
        """{"examDocument":"notice","goalId":"$GOAL_ID","goalKind":"exam","language":"pt","reason":"noOfficialSource"}""",
    )

const val EXAM_GOAL_ID = "2b3c4d5e-6f7a-4b8c-9d0e-1f2a3b4c5d6e"

fun AppCache.noAllowance() = resource<AllowanceResponse>(Audience.SignedIn) { null }

fun setupView(
    steps: List<String>,
    goalId: String = GOAL_ID,
    kind: String = "learn",
    details: String = """{"answered":[]}""",
    targetDate: String? = null,
    targetLanguage: String? = null,
    examChoices: String = "[]",
    planReady: Boolean = true,
): Onboarding =
    ApiJson.decodeFromString(
        """
        {"dateProblem":null,"examChoices":$examChoices,"examDays":null,"examSubjects":[],"followUps":[],"generationId":null,"goalIds":["$goalId"],
         "libraryCourse":null,"planReadiness":{"readingNotice":false,"ready":$planReady},"quickTestMinutes":2,"recommendedMinutes":30,"steps":[${steps.joinToString(
            ",",
        ) { "\"$it\"" }}],
         "timeChoices":[${DAILY_TIMES.joinToString(",") { "{\"minutes\":$it,\"split\":null}" }}],
         "goal":{"createdAt":"2026-10-28T12:00:00Z","dailyMinutes":30,"details":$details,"examBlueprintId":null,"id":"$goalId",
          "isActive":true,"kind":"$kind","language":"en","plan":null,"primaryCourseId":null,"prompt":"learn statistics","status":"active",
          "studyDays":[],"studyTime":null,"targetDate":${targetDate?.let {
            "\"$it\""
        } ?: "null"},"targetLanguage":${targetLanguage?.let { "\"$it\"" } ?: "null"},"timezone":null,"title":"Learn statistics"}}
        """.trimIndent(),
    )

private fun planLinkOf(): PlanLink =
    ApiJson.decodeFromString(
        """
        {"dailyTimes":$DAILY_TIMES,"owner":null,
         "outline":{"goalKind":"exam","hours":40.5,"language":"en","skillCount":24,"targetLanguage":null,
          "subject":{"title":"Bar exam","description":"Pass the state bar on the first try."},
          "phases":[{"hours":20.0,"milestone":"Every subject once","name":"Building the base"},
                    {"hours":0.0,"milestone":null,"name":""}]}}
        """.trimIndent(),
    )

class FakeOnboardingApi : OnboardingApi {
    var understood: (String) -> OnboardingDraft = { understoodDraft(prompt = it) }
    var draft: OnboardingDraft = understoodDraft()
    var refusal: ApiException? = null
    var events: Flow<GenerationEvent> = flowOf()
    val generationSessions = mutableListOf<AuthenticatedSession?>()
    val understandCalls = mutableListOf<Pair<String, String>>()
    val drafts = mutableListOf<String>()
    val created = mutableListOf<GoalCreateInput>()
    val fromPlans = mutableListOf<Pair<String, PlanLinkStartInput>>()
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
    ): OnboardingDraft = draft

    override suspend fun createGoals(
        session: AuthenticatedSession,
        input: GoalCreateInput,
    ): GoalCreateResponse {
        created += input
        refusal?.let { throw it }
        return goalCreated()
    }

    override suspend fun planLink(
        session: AuthenticatedSession?,
        planId: String,
    ): PlanLink = planLinkOf()

    val courseStarts = mutableListOf<Pair<String, JsonObject>>()

    /** Holds a course's start until it completes. */
    var courseStartGate: CompletableDeferred<Unit>? = null

    override suspend fun startCourse(
        session: AuthenticatedSession,
        courseId: String,
        body: JsonObject,
    ): Goal {
        courseStarts += courseId to body
        courseStartGate?.await()
        refusal?.let { throw it }
        return goalCreated().goals.single()
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

    var setup: (String) -> Onboarding = { throw ApiException(ApiError.NotFound) }
    val answers = mutableListOf<Pair<String, OnboardingAnswerInput>>()
    var reply: (String, OnboardingAnswerInput) -> Onboarding = { goalId, _ -> setup(goalId) }

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
    ) = Unit

    var advice: (PlanTimeAdviceInput) -> PlanTimeAdvice = { throw ApiException(ApiError.Unavailable) }

    override suspend fun timeAdvice(
        session: AuthenticatedSession,
        goalId: String,
        input: PlanTimeAdviceInput,
    ) = advice(input)

    var cover: (PlanTimeToCoverInput) -> PlanTimeToCover = { throw ApiException(ApiError.Unavailable) }

    val coverAsks = mutableListOf<PlanTimeToCoverInput>()

    /** Holds every time search after the first [coverGateAfter] until it completes. */
    var coverGate: CompletableDeferred<Unit>? = null
    var coverGateAfter = 1
    var coverMostAtOnce = 0
    private var coverAtOnce = 0

    override suspend fun timeToCover(
        session: AuthenticatedSession,
        goalId: String,
        input: PlanTimeToCoverInput,
    ): PlanTimeToCover {
        coverAsks += input
        coverMostAtOnce = maxOf(coverMostAtOnce, ++coverAtOnce)
        try {
            if (coverAsks.size > coverGateAfter) coverGate?.await()
            return cover(input)
        } finally {
            coverAtOnce--
        }
    }

    override suspend fun uploadFile(
        session: AuthenticatedSession,
        pathname: String,
        file: PickedFile,
    ) = Unit

    override suspend fun attach(
        session: AuthenticatedSession,
        request: CreateUploadRequest,
    ): Source =
        ApiJson.decodeFromString(
            """
            {"fetchedAt":"2026-10-29T12:00:00Z","id":"$UPLOAD_ID","kind":"upload","language":"pt","mimeType":"text/plain",
             "publisher":null,"reusePolicy":null,"title":"Edital","url":null,"validUntil":null,"visibility":"private"}
            """.trimIndent(),
        )

    var researchFailure: ApiException? = null

    override suspend fun dismissUploadRequest(
        session: AuthenticatedSession,
        goalId: UUID,
    ) = Unit

    override suspend fun answerUploadRequest(
        session: AuthenticatedSession,
        goalId: UUID,
        sourceIds: List<UUID>,
    ) {
        researchFailure?.let { throw it }
    }

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
    var writeFailure: ApiException? = null
    var placementReads = 0
    val placementAnswers = mutableListOf<PlacementAnswerInput>()

    /** Holds the placement's reads until it completes. */
    var placementGate: CompletableDeferred<Unit>? = null

    override suspend fun placement(
        session: AuthenticatedSession,
        goalId: String,
    ): Placement {
        placementReads++
        placementGate?.await()
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
    }

    override suspend fun finishMock(
        session: AuthenticatedSession,
        mockId: String,
    ) = Unit

    var levelTest: LanguageLevelTest = levelTestOf()
    var levelTestReads = 0
    var prepared = 0
    var levelTestAnswered: (LanguageLevelTestAnswerInput) -> LanguageLevelTest = { levelTestOf(answered = 1, next = DONE_NEXT) }
    val levelTestAnswers = mutableListOf<LanguageLevelTestAnswerInput>()
    var replyLost = false
    var finishedLevelTests = 0

    /** Holds the level test's reads until it completes, or fails them when it completes exceptionally. */
    var levelTestGate: CompletableDeferred<Unit>? = null

    override suspend fun levelTest(
        session: AuthenticatedSession,
        goalId: String,
    ): LanguageLevelTest {
        levelTestReads++
        levelTestGate?.await()
        return levelTest
    }

    override suspend fun prepareLevelTest(
        session: AuthenticatedSession,
        goalId: String,
    ): LanguageLevelTestGeneration {
        prepared++
        writeFailure?.let { throw it }
        return LanguageLevelTestGeneration(generationId = "bank-run", status = LanguageLevelTestGeneration.Status.STARTED)
    }

    override suspend fun answerLevelTest(
        session: AuthenticatedSession,
        goalId: String,
        input: LanguageLevelTestAnswerInput,
    ): LanguageLevelTest {
        levelTestAnswers += input
        writeFailure?.let { throw it }
        levelTest = levelTestAnswered(input)
        if (replyLost) throw ApiException(ApiError.Network)
        return levelTest
    }

    override suspend fun speakLevelTest(
        session: AuthenticatedSession,
        goalId: String,
        recording: VoiceRecording,
    ): LanguageLevelTestSpokenResult {
        writeFailure?.let { throw it }
        levelTest = levelTestOf(answered = 1, next = DONE_NEXT)
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

/** Core's rule: the time that covers everything when it's at most 4 hours a day, else the [focus] time it offers. */
fun suggestionFor(
    recommended: Long?,
    focus: Long?,
): PlanTimeToCoverSuggested? =
    when {
        recommended != null && recommended <= MOST_SUGGESTED -> suggestion(PlanTimeToCoverSuggested.Kind.EVERYTHING, recommended)
        focus != null -> suggestion(PlanTimeToCoverSuggested.Kind.FOCUS, focus)
        else -> null
    }

fun suggestion(
    kind: PlanTimeToCoverSuggested.Kind,
    minutes: Long,
) = PlanTimeToCoverSuggested(
    coveredShare = if (kind == PlanTimeToCoverSuggested.Kind.EVERYTHING) 1.0 else 0.6,
    everyTopic = true,
    kind = kind,
    minutes = minutes,
    split = null,
)

fun coverOf(
    recommended: Long?,
    ready: Boolean = true,
    focus: Long? = null,
) = PlanTimeToCover(
    fittingDate = null,
    most = null,
    ready = ready,
    recommendedMinutes = recommended,
    suggested = suggestionFor(recommended, focus).takeIf { ready },
    targetDate = LocalDate(2030, 11, 8),
    targetDateNamedMonth = false,
)

fun adviceOf(
    share: Double?,
    endDate: LocalDate? = null,
    targetDate: LocalDate? = LocalDate(2030, 11, 8),
) = PlanTimeAdvice(
    coveredShare = share,
    endDate = endDate,
    fullCourseEndDate = null,
    measure = if (targetDate != null) PlanTimeAdvice.Measure.EXAM else PlanTimeAdvice.Measure.GOAL,
    numbers = null,
    ready = true,
    targetDate = targetDate,
    targetDateNamedMonth = false,
)

/** Core's `DAILY_TIME_CHOICES`: 5 and 10 minutes, quarter hours to 4 hours, then half hours to a whole day. */
val DAILY_TIMES = listOf(5, 10) + (15..240 step 15) + (270..1440 step 30)

private const val MOST_SUGGESTED = 240L
