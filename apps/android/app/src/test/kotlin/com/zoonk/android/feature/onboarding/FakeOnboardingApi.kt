package com.zoonk.android.feature.onboarding

import com.zoonk.android.data.ApiError
import com.zoonk.android.data.ApiException
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.GenerationEvent
import com.zoonk.android.data.GenerationSource
import com.zoonk.api.ApiJson
import com.zoonk.api.models.AllowanceResponse
import com.zoonk.api.models.CreateUploadRequest
import com.zoonk.api.models.Generation
import com.zoonk.api.models.Goal
import com.zoonk.api.models.GoalCreateInput
import com.zoonk.api.models.GoalCreateResponse
import com.zoonk.api.models.MaterialQuestionAnswer
import com.zoonk.api.models.MaterialQuestionInput
import com.zoonk.api.models.OnboardingDraft
import com.zoonk.api.models.OnboardingDraftEdit
import com.zoonk.api.models.PlanLinkStartInput
import com.zoonk.api.models.Source
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
}
