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
import com.zoonk.api.models.LanguageConversation
import com.zoonk.api.models.LanguageConversationCompletionInput
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
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
    lateinit var model: ConversationViewModel
        private set

    fun show(
        compose: ComposeContentTestRule,
        dark: Boolean = false,
    ) {
        val context = ApplicationProvider.getApplicationContext<Application>()
        shadowOf(context).grantPermissions(Manifest.permission.RECORD_AUDIO)
        val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)
        val session = FakeSession(AuthenticatedSession("ana", "token-a", "local-a"))
        val cache = AppCache(session, scope)
        model =
            ConversationViewModel(
                conversationId = id,
                store = ConversationStore(api, cache),
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
            )
        val exits =
            object : ConversationExits {
                override fun close() {
                    closed++
                }

                override fun open(route: AppRoute) {
                    opened += route
                }
            }
        val speech = silentSpeech(context, session, scope)
        compose.setContent { ZoonkTheme(darkTheme = dark) { ConversationContent(model, speech, exits) } }
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
    var completion: ((LanguageConversationCompletionInput) -> CallCompletion)? = null

    override suspend fun conversation(
        session: AuthenticatedSession?,
        id: UUID,
    ) = stored

    override suspend fun start(
        session: AuthenticatedSession,
        request: CallRequest,
    ) = stored.id

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
