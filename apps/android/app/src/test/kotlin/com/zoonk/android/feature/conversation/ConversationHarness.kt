package com.zoonk.android.feature.conversation

import android.Manifest
import android.app.Application
import androidx.activity.ComponentActivity
import androidx.compose.runtime.Composable
import androidx.compose.ui.test.junit4.ComposeContentTestRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.test.core.app.ApplicationProvider
import com.zoonk.android.data.ApiError
import com.zoonk.android.data.ApiException
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.FakeSession
import com.zoonk.android.data.apiHttpClient
import com.zoonk.android.feature.audio.AudioOutput
import com.zoonk.android.feature.audio.PlaybackEnd
import com.zoonk.android.feature.audio.SpeechPlayer
import com.zoonk.android.feature.audio.VoiceFiles
import com.zoonk.android.feature.livecall.FakeCallClient
import com.zoonk.android.feature.livecall.FakeTransport
import com.zoonk.android.feature.livecall.LiveCall
import com.zoonk.android.feature.livecall.LiveServerEvent
import com.zoonk.android.feature.livecall.OngoingCalls
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.ui.theme.ZoonkTheme
import com.zoonk.api.ApiJson
import com.zoonk.api.models.CompletedLanguageConversation
import com.zoonk.api.models.LanguageCheckpointCall
import com.zoonk.api.models.LanguageConversation
import com.zoonk.api.models.LanguageConversationCompletionInput
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.map
import org.robolectric.Shadows.shadowOf
import java.io.File
import java.util.UUID

/** A conversation screen on fake API reads, a fake call client and fake peers, with the microphone allowed. */
internal class ConversationHarness(
    val id: UUID = UUID.fromString("00000000-0000-4000-8000-0000000000c1"),
) {
    val api = FakeConversationApi(conversation(id))
    val client = FakeCallClient()
    val transports = mutableListOf<FakeTransport>()
    val transport get() = transports.last()
    var closed = 0
        private set
    val opened = mutableListOf<AppRoute>()
    val context: Application = ApplicationProvider.getApplicationContext()
    val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)
    private val session = FakeSession(AuthenticatedSession("ana", "token-a", "local-a"))
    val store = ConversationStore(api, AppCache(session, scope))
    val exits =
        object : ConversationExits {
            override fun close() {
                closed++
            }

            override fun open(route: AppRoute) {
                opened += route
            }
        }
    private val speech by lazy { silentSpeech(context, session, scope) }
    private val models = mutableMapOf<UUID, ConversationViewModel>()
    val prep = MemoryPrepTimes()

    init {
        shadowOf(context).grantPermissions(Manifest.permission.RECORD_AUDIO)
    }

    fun model(conversationId: UUID = id): ConversationViewModel =
        models.getOrPut(conversationId) {
            ConversationViewModel(
                conversationId = conversationId,
                store = store,
                newCall = { script ->
                    LiveCall(
                        script,
                        client,
                        { microphone, onEvent, onLost -> FakeTransport(microphone, onEvent, onLost).also(transports::add) },
                        scope,
                    )
                },
                ongoing = OngoingCalls(context, scope),
                timeZone = { "Europe/Madrid" },
                prep = prep,
            )
        }

    @Composable
    fun Conversation(
        conversationId: UUID = id,
        startWith: Boolean? = null,
    ) = ConversationContent(model(conversationId), speech, exits, startWith)

    fun show(
        compose: ComposeContentTestRule,
        dark: Boolean = false,
    ) {
        compose.setContent { ZoonkTheme(darkTheme = dark) { Conversation() } }
    }

    fun goLive(compose: ComposeContentTestRule) {
        compose.onNodeWithText("Start the call").performClick()
        compose.waitForIdle()
        transport.onEvent(LiveServerEvent.Started)
        compose.waitForIdle()
    }
}

internal fun silentSpeech(
    context: Application,
    session: FakeSession,
    scope: CoroutineScope,
) = SpeechPlayer(
    clips = { _, _, _, _ -> error("No clips in these tests") },
    files = VoiceFiles(File(context.cacheDir, "voice-clips"), apiHttpClient(), { false }, session),
    output = SilentOutput,
    sessions = session,
    scope = scope,
)

private object SilentOutput : AudioOutput {
    override suspend fun play(
        file: File,
        rate: Float,
        onStart: () -> Unit,
    ) = PlaybackEnd.Stopped

    override fun stop() = Unit
}

internal class FakeConversationApi(
    var stored: LanguageConversation,
) : ConversationApi {
    val completions = mutableListOf<LanguageConversationCompletionInput>()
    var checkpoint: LanguageCheckpointCall = checkpointIntro()
    var checkpointReads = 0
    val starts = mutableListOf<CallRequest>()

    /** The API's refusal of the next start, as `ApiException`. */
    var startRefusal: ApiException? = null
    var completion: ((LanguageConversationCompletionInput) -> CallCompletion)? = null

    override suspend fun conversation(
        session: AuthenticatedSession?,
        id: UUID,
    ) = stored

    override suspend fun checkpointCall(
        session: AuthenticatedSession?,
        blockId: UUID,
    ): LanguageCheckpointCall {
        checkpointReads++
        return checkpoint
    }

    override suspend fun start(
        session: AuthenticatedSession,
        request: CallRequest,
    ): UUID {
        starts += request
        startRefusal?.let { throw it }
        return stored.id
    }

    override suspend fun complete(
        session: AuthenticatedSession,
        id: UUID,
        input: LanguageConversationCompletionInput,
    ): CompletedLanguageConversation {
        completions += input
        when (completion?.invoke(input)) {
            CallCompletion.Ended -> throw ApiException(ApiError.Unavailable, "CONVERSATION_ENDED", 409)
            else -> Unit
        }
        return completed(stored)
    }
}

internal fun conversation(
    id: UUID,
    locked: Boolean = false,
    kind: LanguageConversation.Kind = LanguageConversation.Kind.PRACTICE,
): LanguageConversation = ApiJson.decodeFromString(conversationJson(id, locked, kind, result = null))

private fun completed(conversation: LanguageConversation): CompletedLanguageConversation {
    val result =
        """
        {"brainPower":12,"passed":true,"spokenSeconds":2,"stars":2,"feedback":{"kind":"call","encouragement":"You did well.",
        "wentWell":["Un café, por favor"],"improve":{"said":"Un café","better":"Un café, por favor","why":"Add please."},"pronunciation":[]}}
        """.trimIndent()
    val json = conversationJson(conversation.id, conversation.locked, conversation.kind, result, met = true)
    return ApiJson.decodeFromString(json.dropLast(1) + ""","ceremony":null,"missionMoment":null,"reached":{"energy":null,"level":null}}""")
}

private fun conversationJson(
    id: UUID,
    locked: Boolean,
    kind: LanguageConversation.Kind,
    result: String?,
    met: Boolean = false,
) = """
    {"character":{"name":"Lucía","place":"Café in Madrid","role":"Waiter"},"exam":null,"examTask":null,"goalId":null,
    "hints":["Quería un café"],"id":"$id","kind":"${kind.value}","level":"A2","locked":$locked,"minutes":3,
    "objectives":[{"description":"Say what you'd like","label":"Ask for a coffee","met":$met},{"description":"Ask what it costs","label":"Ask the price","met":false}],
    "openingLine":"¡Hola!","result":$result,"situation":"You're at a café.","status":"${if (result == null) "ready" else "completed"}",
    "targetLanguage":"es","title":"Order at the café","unit":null}
    """.trimIndent()

internal fun checkpointIntro(dailyLimitReached: Boolean = false): LanguageCheckpointCall =
    ApiJson.decodeFromString(
        """
        {"status":"notStarted","dailyLimitReached":$dailyLimitReached,"intro":{"character":{"name":"Lucía","place":"Café in Madrid","role":"Waiter"},
        "exam":null,"examTask":null,"kind":"checkpoint","level":"A2","minutes":3,
        "objectives":[{"description":"Say what you'd like","label":"Ask for a coffee","met":false}],
        "situation":"You're at a café.","targetLanguage":"es","title":"Order at the café"}}
        """.trimIndent(),
    )

internal fun checkpointStatus(json: String): LanguageCheckpointCall = ApiJson.decodeFromString(json)

internal class MemoryPrepTimes : PrepTimes {
    private val starts = kotlinx.coroutines.flow.MutableStateFlow<Map<UUID, Long>>(emptyMap())

    fun started(card: UUID) = card in starts.value

    override fun startedAt(card: UUID) = starts.map { it[card] }

    override suspend fun start(
        card: UUID,
        at: Long,
    ) {
        starts.value += card to at
    }
}

internal val EXAM_GOAL: UUID = UUID.fromString("00000000-0000-4000-8000-0000000000e1")

/** An exam task's or a speaking mock's conversation, with [result] once graded. */
internal fun examConversation(
    id: UUID,
    result: String? = null,
    kind: String = "examSpeaking",
    examTask: String? = com.zoonk.android.feature.speaking.EXAM_TASK,
    exam: String? = null,
): LanguageConversation =
    ApiJson.decodeFromString(
        """
        {"character":{"name":"Marta","place":"Instituto Cervantes","role":"Examiner"},"exam":${exam?.let {
            "\"$it\""
        }},"examTask":$examTask,
        "goalId":"$EXAM_GOAL","hints":[],"id":"$id","kind":"$kind","level":"B2","locked":false,"minutes":7,"objectives":[],
        "openingLine":"Buenos días.","result":$result,"situation":"An exam room.","status":"${if (result == null) "ready" else "completed"}",
        "targetLanguage":"es","title":"Valorar propuestas","unit":null}
        """.trimIndent(),
    )
