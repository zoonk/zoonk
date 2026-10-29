package com.zoonk.android.app

import android.content.Context
import com.zoonk.android.BuildConfig
import com.zoonk.android.data.ApiClients
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.DraftStore
import com.zoonk.android.data.EncryptedSessionCredentials
import com.zoonk.android.data.LearnerSummaryStore
import com.zoonk.android.data.LearningProfileStore
import com.zoonk.android.data.LiveSessionApi
import com.zoonk.android.data.LoadState
import com.zoonk.android.data.PrivateImages
import com.zoonk.android.data.SessionCredentials
import com.zoonk.android.data.SessionState
import com.zoonk.android.data.SessionStore
import com.zoonk.android.data.StoredSession
import com.zoonk.android.data.apiHttpClient
import com.zoonk.android.data.clearCredentialState
import com.zoonk.android.data.imageLoader
import com.zoonk.android.data.perform
import com.zoonk.android.feature.account.AccountStore
import com.zoonk.android.feature.account.LiveAccountApi
import com.zoonk.android.feature.account.NoBotProof
import com.zoonk.android.feature.feedback.FeedbackSender
import com.zoonk.android.feature.feedback.LiveFeedbackApi
import com.zoonk.android.feature.memory.LiveMemoryApi
import com.zoonk.android.feature.memory.MemoryStore
import com.zoonk.android.feature.plan.LivePlanApi
import com.zoonk.android.feature.plan.PlanStore
import com.zoonk.android.navigation.LearnerAccess
import com.zoonk.api.models.LearnerSummary
import com.zoonk.api.models.LearnerSummaryGoal
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import okhttp3.HttpUrl.Companion.toHttpUrl
import java.io.File

class AppContainer private constructor(
    context: Context,
    credentials: SessionCredentials,
    previewAccess: LearnerAccess?,
) {
    constructor(context: Context) : this(context, EncryptedSessionCredentials(context), previewAccess = null)

    val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
    val api = ApiClients("${BuildConfig.API_BASE_URL}/v1/".toHttpUrl(), apiHttpClient { buildTypeSetup() })
    val images = PrivateImages(api.baseUrl, imageLoader(context, api.http))
    val drafts = DraftStore(File(context.filesDir, "drafts"), scope)
    val sessions: SessionStore =
        SessionStore(
            api = LiveSessionApi(api),
            appleClientId = BuildConfig.APPLE_CLIENT_ID,
            appleReflectorUrl = api.baseUrl.resolve("/auth/apple/android").toString(),
            credentials = credentials,
            drafts = drafts,
            onChange = { previous, _ ->
                cache.followSession()
                previous?.let(images::forget)
            },
            clearCredentialState = { clearCredentialState(context) },
        )
    val cache = AppCache(sessions, scope)
    val learnerSummary =
        LearnerSummaryStore(
            api = { session -> perform { api.clients(session).account.getCurrentUserSummary() }.summary },
            cache = cache,
            scope = scope,
        )
    val learningProfile =
        LearningProfileStore(
            api = { session -> perform { api.clients(session).account.getCurrentUserLearningProfile() }.profile },
            cache = cache,
        )

    val plans = PlanStore(LivePlanApi(api), cache)

    // Account and Plus (L1).
    val account = AccountStore(LiveAccountApi(api, NoBotProof), sessions, cache)
    val memory = MemoryStore(LiveMemoryApi(api), cache)
    val feedback = FeedbackSender(LiveFeedbackApi(api), sessions)

    /** Who the shell shows screens to, which its gates read. */
    val learnerAccess: StateFlow<LearnerAccess> =
        previewAccess?.let(::MutableStateFlow)
            ?: combine(sessions.state, learnerSummary.summary.state, ::learnerAccess)
                .stateIn(scope, SharingStarted.Eagerly, LearnerAccess.Restoring)

    init {
        scope.launch { sessions.restore() }
    }

    companion object {
        /** For previews and shell tests: no stored session and no requests; screens open as for [access]. */
        fun preview(
            context: Context,
            access: LearnerAccess = LearnerAccess.Learner,
        ) = AppContainer(context, NoStoredSession, access)
    }
}

internal fun learnerAccess(
    session: SessionState,
    summary: LoadState<LearnerSummary>,
): LearnerAccess =
    when (session) {
        // Gated screens wait while the stored session can't be checked, as while it's restored.
        SessionState.Restoring -> {
            LearnerAccess.Restoring
        }

        SessionState.Unavailable -> {
            LearnerAccess.Unavailable
        }

        is SessionState.SignedOut -> {
            if (session.sessionEnded) LearnerAccess.SessionEnded else LearnerAccess.Visitor
        }

        is SessionState.SignedIn -> {
            val goals = (summary as? LoadState.Loaded)?.value?.goals
            when {
                goals == null -> LearnerAccess.SignedIn
                goals.none(LearnerSummaryGoal::isFollowed) -> LearnerAccess.NoGoal
                else -> LearnerAccess.Learner
            }
        }
    }

/** Main's sidebar follows every goal but quick explanations, until archived. */
private val LearnerSummaryGoal.isFollowed: Boolean
    get() = kind != LearnerSummaryGoal.Kind.EXPLAIN && status != LearnerSummaryGoal.Status.ARCHIVED

private object NoStoredSession : SessionCredentials {
    override suspend fun read(): StoredSession? = null

    override suspend fun write(session: StoredSession?) = Unit

    override suspend fun pendingApple(): com.zoonk.android.data.PendingAppleSignIn? = null

    override suspend fun writePendingApple(pending: com.zoonk.android.data.PendingAppleSignIn?) = Unit
}
