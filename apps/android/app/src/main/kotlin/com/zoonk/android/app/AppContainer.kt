package com.zoonk.android.app

import android.content.Context
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.ProcessLifecycleOwner
import com.zoonk.android.BuildConfig
import com.zoonk.android.app.shell.GoalSwitch
import com.zoonk.android.data.ApiClients
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.DraftStore
import com.zoonk.android.data.EncryptedSessionCredentials
import com.zoonk.android.data.LearnerSummaryStore
import com.zoonk.android.data.LearningProfileStore
import com.zoonk.android.data.LiveLearningProfileApi
import com.zoonk.android.data.LiveSessionApi
import com.zoonk.android.data.LoadState
import com.zoonk.android.data.PrivateImages
import com.zoonk.android.data.SessionCredentials
import com.zoonk.android.data.SessionState
import com.zoonk.android.data.SessionStore
import com.zoonk.android.data.SignInResult
import com.zoonk.android.data.StoredSession
import com.zoonk.android.data.apiHttpClient
import com.zoonk.android.data.clearCredentialState
import com.zoonk.android.data.imageLoader
import com.zoonk.android.data.perform
import com.zoonk.android.feature.account.AccountStore
import com.zoonk.android.feature.account.LiveAccountApi
import com.zoonk.android.feature.account.PlayIntegrity
import com.zoonk.android.feature.activities.code.CodeSandbox
import com.zoonk.android.feature.audio.ExoAudioOutput
import com.zoonk.android.feature.audio.SpeechPlayer
import com.zoonk.android.feature.audio.VoiceFiles
import com.zoonk.android.feature.buddy.BuddyStore
import com.zoonk.android.feature.buddy.EarlierQuestionsStore
import com.zoonk.android.feature.buddy.LiveBuddyApi
import com.zoonk.android.feature.catalog.CatalogStore
import com.zoonk.android.feature.catalog.LiveCatalogApi
import com.zoonk.android.feature.ceremonies.MilestoneViews
import com.zoonk.android.feature.checkpoint.CheckpointStore
import com.zoonk.android.feature.checkpoint.LiveCheckpointApi
import com.zoonk.android.feature.conversation.ConversationStore
import com.zoonk.android.feature.conversation.LiveConversationApi
import com.zoonk.android.feature.exam.ExamStore
import com.zoonk.android.feature.exam.LiveExamApi
import com.zoonk.android.feature.explain.ExplainStore
import com.zoonk.android.feature.explain.LiveExplainApi
import com.zoonk.android.feature.feedback.FeedbackSender
import com.zoonk.android.feature.feedback.LiveFeedbackApi
import com.zoonk.android.feature.goalcontent.GoalContentStore
import com.zoonk.android.feature.goalcontent.LiveGoalContentApi
import com.zoonk.android.feature.language.LanguageProgressStore
import com.zoonk.android.feature.language.LanguageUnitStore
import com.zoonk.android.feature.language.LiveLanguageProgressApi
import com.zoonk.android.feature.language.LiveLanguageUnitApi
import com.zoonk.android.feature.livecall.LiveCallTransports
import com.zoonk.android.feature.livecall.OngoingCalls
import com.zoonk.android.feature.livecall.WebRtcLiveCallTransport
import com.zoonk.android.feature.memory.LiveMemoryApi
import com.zoonk.android.feature.memory.MemoryStore
import com.zoonk.android.feature.mindmaps.LiveMindMapApi
import com.zoonk.android.feature.mindmaps.MindMapStore
import com.zoonk.android.feature.mistakes.LiveMistakesApi
import com.zoonk.android.feature.mistakes.MistakesStore
import com.zoonk.android.feature.mock.LiveMockApi
import com.zoonk.android.feature.mock.MockStore
import com.zoonk.android.feature.mock.chooser.LiveMockStartApi
import com.zoonk.android.feature.mock.chooser.MockStarter
import com.zoonk.android.feature.onboarding.LiveOnboardingApi
import com.zoonk.android.feature.onboarding.OnboardingStore
import com.zoonk.android.feature.plan.LivePlanApi
import com.zoonk.android.feature.plan.PlanStore
import com.zoonk.android.feature.player.LessonPlayerStore
import com.zoonk.android.feature.player.LiveLessonPlayerApi
import com.zoonk.android.feature.player.TodayChoices
import com.zoonk.android.feature.practice.block.LiveQuestionBlockApi
import com.zoonk.android.feature.practice.block.QuestionBlockStore
import com.zoonk.android.feature.pronunciation.LivePronunciationApi
import com.zoonk.android.feature.pronunciation.PronunciationStore
import com.zoonk.android.feature.recap.RecapStore
import com.zoonk.android.feature.search.LiveSearchApi
import com.zoonk.android.feature.search.SearchStore
import com.zoonk.android.feature.session.LiveStudyApi
import com.zoonk.android.feature.session.StudyOpener
import com.zoonk.android.feature.speaking.LiveSpeakingApi
import com.zoonk.android.feature.speaking.SpeakingStore
import com.zoonk.android.feature.stats.LiveStatsApi
import com.zoonk.android.feature.stats.StatsStore
import com.zoonk.android.feature.subscription.GooglePlayBilling
import com.zoonk.android.feature.subscription.LiveSubscriptionApi
import com.zoonk.android.feature.subscription.NoPlayBilling
import com.zoonk.android.feature.subscription.SubscriptionStore
import com.zoonk.android.feature.today.LiveTodayApi
import com.zoonk.android.feature.today.TodayStore
import com.zoonk.android.feature.tutor.LiveTutorApi
import com.zoonk.android.feature.tutor.TutorStore
import com.zoonk.android.navigation.LearnerAccess
import com.zoonk.api.models.LearnerSummary
import com.zoonk.api.models.LearnerSummaryGoal
import com.zoonk.api.models.SpeechClipRequest
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.flow.map
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
                previous?.let {
                    images.forget(it)
                    voiceFiles.forget(it)
                }
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
    val learningProfile = LearningProfileStore(LiveLearningProfileApi(api), cache)

    val plans = PlanStore(LivePlanApi(api), cache)
    val goalContent = GoalContentStore(LiveGoalContentApi(api), cache)
    val mindMaps = MindMapStore(LiveMindMapApi(api, images), cache)

    // Account and Plus (L1).
    private val integrity =
        BuildConfig.PLAY_INTEGRITY_CLOUD_PROJECT_NUMBER
            .toLongOrNull()
            ?.takeIf { previewAccess == null }
            ?.let { PlayIntegrity(context, it, scope) }
    val account = AccountStore(LiveAccountApi(api, integrity), sessions, cache)
    val memory = MemoryStore(LiveMemoryApi(api), cache)
    val feedback = FeedbackSender(LiveFeedbackApi(api), sessions)
    val subscriptions =
        SubscriptionStore(
            api = LiveSubscriptionApi(api),
            // Previews make no requests, Play's included.
            billing = if (previewAccess == null) GooglePlayBilling(context) else NoPlayBilling,
            sessions = sessions,
            cache = cache,
            scope = scope,
            isForeground =
                if (previewAccess == null) {
                    ProcessLifecycleOwner
                        .get()
                        .lifecycle.currentStateFlow
                        .map { it.isAtLeast(Lifecycle.State.STARTED) }
                } else {
                    flowOf(false)
                },
        )

    val tutor = TutorStore(LiveTutorApi(api), cache, sessions, memory::undo, plans::decideChange)
    val earlierQuestions =
        EarlierQuestionsStore(
            api = { session, cursor -> perform { api.clients(session).lessons.listEarlierQuestions(cursor) } },
            cache = cache,
            sessions = sessions,
        )

    // Speech clips and recorded answers.
    val voiceFiles = VoiceFiles(File(context.cacheDir, "voice-clips"), api.http, images::isPrivate, sessions)
    val speech =
        SpeechPlayer(
            clips = { session, language, text, personal ->
                perform { api.clients(session).language.requestSpeechClip(SpeechClipRequest(language, text, personal)) }.url.toString()
            },
            files = voiceFiles,
            output = ExoAudioOutput(context),
            sessions = sessions,
            scope = scope,
        )

    // Lesson player (L4).
    val lessonPlayer = LessonPlayerStore(LiveLessonPlayerApi(api), cache)
    val todayChoices = TodayChoices(drafts)
    val explain = ExplainStore(LiveExplainApi(api), cache)

    // Activities (L5).
    val codeSandbox = CodeSandbox(context, scope)

    // Today and the session (lane L3).
    private val timeZone = {
        java.util.TimeZone
            .getDefault()
            .id
    }
    val today = TodayStore(LiveTodayApi(api), cache, scope, timeZone)
    val studyOpener = StudyOpener(LiveStudyApi(api), cache, timeZone, scope)
    val recap =
        RecapStore(
            api = { session, goalId, timeZone ->
                perform { api.clients(session).milestones.getCurrentUserWeeklyRecap(goalId = goalId, timeZone = timeZone) }
            },
            cache = cache,
            timeZone = timeZone,
        )
    val goalSwitch = GoalSwitch(learningProfile::setActiveGoal)
    val milestoneViews = MilestoneViews(api, cache)

    // Pronunciation reviews (L8).
    val pronunciation = PronunciationStore(LivePronunciationApi(api), cache, timeZone)

    // Live calls and speaking (L9).
    val conversations = ConversationStore(LiveConversationApi(api), cache)
    val speaking = SpeakingStore(LiveSpeakingApi(api), cache)
    val languageUnits = LanguageUnitStore(LiveLanguageUnitApi(api), cache)
    val languageProgress = LanguageProgressStore(LiveLanguageProgressApi(api), cache)
    val calls = OngoingCalls(context.applicationContext, scope)
    val callTransports =
        LiveCallTransports { microphone, onEvent, onLost -> WebRtcLiveCallTransport(context, microphone, onEvent, onLost) }

    val onboarding =
        OnboardingStore(
            api = LiveOnboardingApi(api),
            cache = cache,
            sessions = sessions,
            startGuest = { account.startAsGuest() == SignInResult.SignedIn },
        )

    // Practice and checks (lane L6).
    val questionBlocks = QuestionBlockStore(LiveQuestionBlockApi(api), cache, timeZone)
    val mistakes = MistakesStore(LiveMistakesApi(api), cache, timeZone)
    val checkpoints = CheckpointStore(LiveCheckpointApi(api), cache, timeZone)

    val buddy = BuddyStore(LiveBuddyApi(api), cache, timeZone, learnerSummary.summary, scope)

    /** Who the shell shows screens to, which its gates read. */
    val learnerAccess: StateFlow<LearnerAccess> =
        previewAccess?.let(::MutableStateFlow)
            ?: combine(sessions.state, learnerSummary.summary.state, ::learnerAccess)
                .stateIn(scope, SharingStarted.Eagerly, LearnerAccess.Restoring)

    val catalog = CatalogStore(LiveCatalogApi(api), cache)
    val search = SearchStore(LiveSearchApi(api), cache)
    val stats = StatsStore(LiveStatsApi(api), cache)

    // Exams and mocks (L7).
    val exams = ExamStore(LiveExamApi(api), cache, timeZone)
    val mocks = MockStore(LiveMockApi(api), cache)
    val mockStarter = MockStarter(LiveMockStartApi(api), cache)

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
