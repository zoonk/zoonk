package com.zoonk.android.feature.conversation

import android.Manifest
import android.content.pm.PackageManager
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.core.content.ContextCompat
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.zoonk.android.R
import com.zoonk.android.app.AppContainer
import com.zoonk.android.data.ApiError
import com.zoonk.android.data.LoadState
import com.zoonk.android.data.collectShown
import com.zoonk.android.data.recode
import com.zoonk.android.data.value
import com.zoonk.android.feature.audio.SpeechPlayer
import com.zoonk.android.feature.ceremonies.MomentAfterCeremony
import com.zoonk.android.feature.ceremonies.MomentCeremony
import com.zoonk.android.feature.ceremonies.SessionCeremony
import com.zoonk.android.feature.ceremonies.momentBuddy
import com.zoonk.android.feature.livecall.LiveCall
import com.zoonk.android.feature.livecall.LiveCallFailure
import com.zoonk.android.feature.livecall.LiveCallPhase
import com.zoonk.android.feature.livecall.LiveConversationCalls
import com.zoonk.android.feature.session.DayMoment
import com.zoonk.android.feature.session.ReachedFacts
import com.zoonk.android.feature.session.missionMomentFacts
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.ui.characters.buddyName
import com.zoonk.android.ui.components.CelebrationScope
import com.zoonk.android.ui.components.LoadFailedMessage
import com.zoonk.api.models.CompletedLanguageConversation
import com.zoonk.api.models.LanguageConversation
import com.zoonk.api.models.LanguageConversationIntro
import kotlinx.coroutines.launch
import java.util.TimeZone
import java.util.UUID

/** Where a call's screens lead: back to where it opened, or to sign-in and Plus. */
interface ConversationExits {
    fun close()

    fun open(route: AppRoute)
}

/** `/conversation/{id}`: a call's intro, the call, its problems and its result. */
@Composable
fun ConversationScreen(
    route: AppRoute.Conversation,
    app: AppContainer,
    navigator: AppNavigator,
) {
    val exits =
        remember(navigator) {
            object : ConversationExits {
                override fun close() = navigator.closeTask()

                override fun open(route: AppRoute) = navigator.open(route)
            }
        }
    val id = remember(route.conversationId) { runCatching { UUID.fromString(route.conversationId) }.getOrNull() }
    if (id == null) {
        NotFound(onClose = exits::close)
        return
    }
    ConversationEntry(id, app, exits, from = route.from, mock = route.mock)
}

/** A saved call's milestone ceremony and the day's moment, drawn with the learner's buddy. */
internal class CallMoments(
    val ceremony: MomentCeremony,
    val dayMoment: @Composable (CompletedLanguageConversation) -> Unit,
)

/** With [startWith], the call starts as soon as it's read, from the tap that opened it (a checkpoint's Start). */
@Composable
internal fun ConversationEntry(
    id: UUID,
    app: AppContainer,
    exits: ConversationExits,
    startWith: Boolean? = null,
    from: String? = null,
    mock: String? = null,
) {
    val model =
        viewModel(key = "conversation:$id") {
            ConversationViewModel(
                conversationId = id,
                store = app.conversations,
                newCall = { script -> LiveCall(script, LiveConversationCalls(id, app.api, app.cache), app.callTransports, app.scope) },
                ongoing = app.calls,
                timeZone = { TimeZone.getDefault().id },
                prep = DraftPrepTimes(app.drafts, app.sessions),
                scope = app.scope,
            )
        }
    val moments =
        remember(app) {
            CallMoments(
                ceremony = { milestone, onClose -> SessionCeremony(app, milestone, onClose) },
                dayMoment = { completion -> CallDayMoment(app, completion) },
            )
        }
    ConversationContent(model, app.speech, exits, moments, startWith, fromExam = from == FROM_EXAM, fromMock = mock != null)
}

@Composable
private fun CallDayMoment(
    app: AppContainer,
    completion: CompletedLanguageConversation,
) {
    val buddy = momentBuddy(app)

    DayMoment(
        missions = completion.missionMoment?.missionMomentFacts(),
        reached = ReachedFacts(completion.reached.level, completion.reached.energy),
        ceremony = completion.ceremony?.kind,
        buddy = buddy.look,
        buddyName = buddy.name,
    )
}

@Composable
internal fun ConversationContent(
    model: ConversationViewModel,
    speech: SpeechPlayer,
    exits: ConversationExits,
    moments: CallMoments,
    startWith: Boolean? = null,
    fromExam: Boolean = false,
    fromMock: Boolean = false,
) {
    val load by model.conversation.collectShown()
    val scope = rememberCoroutineScope()

    when (val state = load) {
        LoadState.Idle, LoadState.Loading -> {
            CallFrame(title = "", onClose = exits::close) {
                item(key = "loading") { Box(Modifier.callItem(), contentAlignment = Alignment.Center) { CircularProgressIndicator() } }
            }
        }

        is LoadState.Failed -> {
            if (state.error == ApiError.NotFound) {
                NotFound(onClose = exits::close)
            } else {
                CallFrame(title = "", onClose = exits::close) {
                    item(
                        key = "failed",
                    ) { LoadFailedMessage(onRetry = { scope.launch { model.conversation.refresh() } }, modifier = Modifier.callItem()) }
                }
            }
        }

        LoadState.Empty -> {
            NotFound(onClose = exits::close)
        }

        is LoadState.Loaded -> {
            Conversation(state.value, model, speech, exits, moments, startWith, fromExam, fromMock)
        }
    }
}

@Composable
private fun Conversation(
    stored: LanguageConversation,
    model: ConversationViewModel,
    speech: SpeechPlayer,
    exits: ConversationExits,
    moments: CallMoments,
    startWith: Boolean?,
    fromExam: Boolean,
    fromMock: Boolean,
) {
    val completed = model.completed
    // A mock's task goes straight back to the mock once saved: the mock shows no feedback until it's over.
    LaunchedEffect(completed) { if (completed != null && fromMock) exits.close() }
    val conversation = remember(completed, stored) { completed?.recode<CompletedLanguageConversation, LanguageConversation>() ?: stored }
    val intro = remember(conversation) { conversation.recode<LanguageConversation, LanguageConversationIntro>() }
    val result = conversation.result
    val title = conversationTitle(conversation)
    val startCall = rememberCallStart { microphone, takeover -> model.start(conversation, microphone, takeover) }
    val onSeePlus = { exits.open(AppRoute.Subscription) }
    LaunchedEffect(model) { if (startWith != null && result == null) model.startOnce(conversation, startWith) }

    val examTask = conversation.examTask
    val goalId = conversation.goalId
    val again =
        when {
            goalId == null -> null
            conversation.kind == LanguageConversation.Kind.SPEAKING_MOCK -> CallRequest.SpeakingMock(goalId)
            examTask != null && examTask.sectionId == null -> CallRequest.ExamSpeaking(goalId, examTask.task.key)
            else -> null
        }
    val resultActions =
        ResultActions(
            onContinue = exits::close,
            onClose = exits::close,
            onTryAgain =
                again?.let { request ->
                    {
                        model.startAgain(request) { id ->
                            exits.close()
                            exits.open(AppRoute.Conversation(id.toString(), from = if (fromExam) FROM_EXAM else null))
                        }
                    }
                },
            nextTask =
                examTask?.nextTask?.takeIf { !fromExam }?.let { next ->
                    {
                        exits.close()
                        exits.open(AppRoute.Speaking(task = next))
                    }
                },
        )

    if (result != null) {
        // A call opened after it ended was celebrated then; one just saved shows its milestone's ceremony before its result.
        MomentAfterCeremony(completed?.ceremony?.takeUnless { fromMock }, moments.ceremony) {
            val dayMoment: @Composable () -> Unit = { completed?.let { moments.dayMoment(it) } }
            when {
                conversation.kind == LanguageConversation.Kind.SPEAKING_MOCK -> {
                    SpeakingMockResult(conversation, resultActions, dayMoment)
                }

                examTask != null -> {
                    ExamSpeakingResult(conversation, examTask, resultActions, dayMoment)
                }

                else -> {
                    CelebrationScope(play = completed != null) {
                        ConversationResult(
                            conversation = conversation,
                            result = result,
                            speech = speech,
                            onContinue = exits::close,
                            onClose = exits::close,
                            onSeePlus = onSeePlus,
                            dayMoment = dayMoment,
                        )
                    }
                }
            }
        }
        return
    }

    val call = model.call
    val callState = call?.state?.collectAsStateWithLifecycle()?.value
    val save = model.save
    val problemActions =
        CallProblemActions(
            onClose = exits::close,
            onRetry = { startCall(false) },
            onTakeover = { startCall(true) },
            onEnd = { call?.hangUp() },
            onCreateAccount = { exits.open(AppRoute.Login) },
            onSeePlus = onSeePlus,
        )

    when {
        conversation.locked || callState?.failure == LiveCallFailure.PlusRequired -> {
            CallIntro(intro, CallIntroStart.PlusRequired, onStart = {}, onSeePlus = onSeePlus, onClose = exits::close)
        }

        callState == null && examTask != null -> {
            val prepStartedAt by model.prepStartedAt.collectAsStateWithLifecycle(null)
            ExamTaskIntro(conversation, examTask, prepStartedAt, model::startPrep, exits::close) {
                StartCallButton(starting = false, onClick = { startCall(false) }, modifier = Modifier.barAction())
            }
        }

        callState == null -> {
            CallIntro(intro, CallIntroStart.Idle, onStart = { startCall(false) }, onSeePlus = onSeePlus, onClose = exits::close)
        }

        save == CallSave.Ended || save == CallSave.TakenOver -> {
            val kind = if (save == CallSave.TakenOver) CallProblemKind.TakenOver else CallProblemKind.SaveEnded
            CallProblem(kind, title, problemActions)
        }

        save != null || callState.phase == LiveCallPhase.Ended -> {
            SavingCall(
                save ?: CallSave.Saving,
                grading = conversation.grades,
                title = title,
                onRetry = model::saveAgain,
                onClose = exits::close,
            )
        }

        callState.phase == LiveCallPhase.Failed -> {
            CallProblem(CallProblemKind.Failed(callState.failure ?: LiveCallFailure.Connect, callState.limit), title, problemActions)
        }

        else -> {
            ConversationLive(
                conversation = conversation,
                call = callState,
                usedHelp = model.usedHelp,
                actions =
                    LiveCallActions(
                        // Ending a call that hasn't connected goes back to its intro.
                        onEnd = { if (callState.phase == LiveCallPhase.Connecting) model.showIntro() else call.hangUp() },
                        onHelp = model::help,
                        onMute = call::toggleMute,
                        onSend = call::sendText,
                    ),
            )
        }
    }
}

private const val FROM_EXAM = "exam"

/** A speaking mock and an exam task are graded on the exam's criteria when they end, which takes longer. */
private val LanguageConversation.grades: Boolean
    get() = kind == LanguageConversation.Kind.SPEAKING_MOCK || examTask != null

/**
 * Asks for the microphone, then starts: the call is reserved only once the learner answered, since
 * its time starts then. Without the microphone the call runs on typed replies.
 */
@Composable
internal fun rememberCallStart(start: (microphone: Boolean, takeover: Boolean) -> Unit): (takeover: Boolean) -> Unit {
    val context = LocalContext.current
    val currentStart by rememberUpdatedState(start)
    var takeover by rememberSaveable { mutableStateOf(false) }
    val permission =
        rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted -> currentStart(granted, takeover) }
    return remember(context, permission) {
        { asked: Boolean ->
            takeover = asked
            if (ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) {
                currentStart(true, asked)
            } else {
                permission.launch(Manifest.permission.RECORD_AUDIO)
            }
        }
    }
}

@Composable
private fun NotFound(onClose: () -> Unit) {
    CallFrame(title = "", onClose = onClose) {
        item(key = "not-found") {
            CallOffMessage(stringResource(R.string.conversation_not_found_title), Modifier.callItem()) {
                Text(
                    stringResource(R.string.conversation_not_found_description),
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    style = MaterialTheme.typography.bodyLarge,
                )
            }
        }
    }
}
