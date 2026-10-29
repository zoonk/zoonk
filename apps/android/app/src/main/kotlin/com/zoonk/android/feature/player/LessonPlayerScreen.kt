package com.zoonk.android.feature.player

import androidx.activity.compose.LocalOnBackPressedDispatcherOwner
import androidx.compose.foundation.focusable
import androidx.compose.foundation.gestures.detectHorizontalDragGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.relocation.BringIntoViewRequester
import androidx.compose.foundation.relocation.bringIntoViewRequester
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.adaptive.currentWindowAdaptiveInfoV2
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.input.key.key
import androidx.compose.ui.input.key.onKeyEvent
import androidx.compose.ui.input.key.type
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.ProgressBarRangeInfo
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.progressBarRangeInfo
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.window.core.layout.WindowSizeClass
import com.zoonk.android.R
import com.zoonk.android.feature.audio.VoiceRecording
import com.zoonk.android.feature.player.engine.CompletionStatus
import com.zoonk.android.feature.player.engine.LessonAction
import com.zoonk.android.feature.player.engine.LessonNotice
import com.zoonk.android.feature.player.engine.LessonPhase
import com.zoonk.android.feature.player.engine.LessonPlayerState
import com.zoonk.android.feature.player.engine.LessonRun
import com.zoonk.android.feature.player.engine.LessonScreen
import com.zoonk.android.feature.player.engine.PrimaryLabel
import com.zoonk.android.feature.player.engine.Segment
import com.zoonk.android.feature.player.engine.isLanguageStep
import com.zoonk.android.feature.player.engine.isReadStep
import com.zoonk.android.feature.player.engine.screen
import com.zoonk.android.feature.player.language.LessonLanguage
import com.zoonk.android.feature.player.language.PromptAudio
import com.zoonk.android.feature.player.language.PromptAudioEffect
import com.zoonk.android.feature.player.language.PromptAudioIconButton
import com.zoonk.android.feature.player.language.promptAudioUrl
import com.zoonk.android.feature.player.language.rememberLessonLanguage
import com.zoonk.android.feature.player.model.LessonAnswer
import com.zoonk.android.feature.player.model.PlayableLesson
import com.zoonk.android.feature.player.steps.StepActions
import com.zoonk.android.feature.player.steps.StepView
import com.zoonk.android.feature.player.steps.SummaryIdeas
import com.zoonk.android.feature.player.steps.count
import com.zoonk.android.feature.player.steps.keyPick
import com.zoonk.android.feature.tutor.TutorScope
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.ui.components.LabelChip
import com.zoonk.android.ui.components.LocalPrivatePictures
import com.zoonk.android.ui.components.MeterPart
import com.zoonk.android.ui.components.MeterParts
import com.zoonk.android.ui.components.OutlinedIconButton
import com.zoonk.android.ui.scaffold.TaskExitConfirmation
import com.zoonk.android.ui.scaffold.TaskScaffold
import kotlin.math.abs

/** Where the player leads: other features' routes, over the lesson or in its place. */
interface LessonPlayerExits {
    fun close()

    fun open(route: AppRoute)

    /** Closes the lesson and opens [route] where it was. */
    fun replace(route: AppRoute)
}

/** The column every screen of the lesson reads in, centered on wide windows. */
@Composable
internal fun LessonColumn(
    modifier: Modifier = Modifier,
    content: @Composable ColumnScope.() -> Unit,
) {
    Box(modifier.fillMaxWidth(), contentAlignment = Alignment.TopCenter) {
        Column(
            modifier = Modifier.widthIn(max = COLUMN_WIDTH).fillMaxWidth().padding(horizontal = COLUMN_PADDING),
            verticalArrangement = Arrangement.spacedBy(20.dp),
            content = content,
        )
    }
}

private val COLUMN_WIDTH = 640.dp
private val COLUMN_PADDING = 20.dp

/** The action bar's actions line up with the column above them. */
@Composable
private fun BarColumn(content: @Composable () -> Unit) {
    Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
        Box(Modifier.widthIn(max = COLUMN_WIDTH - COLUMN_PADDING * 2).fillMaxWidth()) { content() }
    }
}

@Composable
fun LessonPlayer(
    lesson: PlayableLesson,
    state: LessonPlayerState?,
    ending: LessonEnding,
    viewModel: LessonPlayerViewModel,
    exits: LessonPlayerExits,
    navigator: AppNavigator,
    endSlot: LessonEndSlot? = null,
    ask: (@Composable (TutorScope, worded: Boolean) -> Unit)? = null,
) {
    val screen = remember(state) { state?.screen() }
    val ownEnd =
        endSlot?.takeIf {
            state?.completion?.status == CompletionStatus.Saving ||
                state?.completion?.status == CompletionStatus.Saved
        }
    val language = rememberLessonLanguage(lesson.language, lesson.targetLanguage)
    language.prompt?.let { PromptAudioEffect(screen?.step, it) }
    val actions =
        remember(viewModel) {
            object : StepActions {
                override fun select(answer: LessonAnswer?) = viewModel.select(answer)

                override fun runPrimary() {
                    viewModel.state.value
                        ?.screen()
                        ?.primary
                        ?.takeIf { it.enabled }
                        ?.let { if (it.isCheck) viewModel.check() else viewModel.dispatch(LessonAction.Continue) }
                }

                override fun dontKnow(stepId: String) = viewModel.dispatch(LessonAction.SkipWriting(stepId = stepId))

                override fun skipWriting() = viewModel.skipWriting()

                override fun explainFirst() = viewModel.dispatch(LessonAction.ExplainFirst)

                override val cantTalk get() = viewModel.cantTalk

                override fun setCantTalk(chosen: Boolean) = viewModel.setCantTalk(chosen)

                override suspend fun gradeSpoken(
                    stepId: String,
                    recording: VoiceRecording,
                ) = viewModel.gradeSpoken(stepId, recording)
            }
        }
    val focus = remember { FocusRequester() }
    val unsent = screen?.unsentAnswer == true
    val backDispatcher = LocalOnBackPressedDispatcherOwner.current?.onBackPressedDispatcher
    // Escape leaves as back does, so leaving with an unsent answer asks first.
    val leave = { backDispatcher?.onBackPressed() ?: exits.close() }

    TaskScaffold(
        onClose = exits::close,
        modifier =
            Modifier
                .focusRequester(focus)
                .focusable()
                .onKeyEvent { event ->
                    event.type == KeyEventType.KeyDown && state != null && screen != null &&
                        handleKey(event.key, state, screen, viewModel, actions, leave) {
                            if (ownEnd == null) {
                                completionMainAction(lesson, state, ending, viewModel, exits)
                            } else {
                                ownEnd.done.takeIf { state.completion?.status == CompletionStatus.Saved }
                            }
                        }
                },
        title = { LessonTitle(lesson.title) },
        actions = { ScreenMenu(lesson, state, screen, viewModel) },
        exitConfirmation =
            if (unsent) {
                TaskExitConfirmation(
                    title = stringResource(R.string.player_leave_title),
                    description = stringResource(R.string.player_leave_description),
                    confirm = stringResource(R.string.task_leave),
                    cancel = stringResource(R.string.player_keep_writing),
                )
            } else {
                null
            },
        bottomBar =
            when {
                state == null || screen == null -> {
                    null
                }

                state.phase == LessonPhase.Completed && ownEnd != null -> {
                    { BarColumn { DoneAction(ownEnd, saving = state.completion?.status == CompletionStatus.Saving) } }
                }

                state.phase == LessonPhase.Completed -> {
                    { BarColumn { CompletionActions(lesson, state, ending, viewModel, exits) } }
                }

                screen.primary != null -> {
                    {
                        BarColumn {
                            ActionBar(screen, actions, language.prompt, onBack = { viewModel.dispatch(LessonAction.GoBack) }) {
                                // A screen that already offers help keeps the ask quiet.
                                ask?.invoke(state.tutorScope(screen), state.showsMiss(screen) && screen.struggleOffer == null)
                            }
                        }
                    }
                }

                else -> {
                    null
                }
            },
    ) { padding ->
        Column(Modifier.fillMaxSize().padding(padding)) {
            if (state == null || screen == null) {
                Starting()
            } else {
                Segments(screen.segments, state)
                Content(state, screen, ending, viewModel, actions, exits, navigator, ownEnd, language)
            }
        }
    }

    LaunchedEffect(Unit) { focus.requestFocus() }
}

private fun handleKey(
    key: Key,
    state: LessonPlayerState,
    screen: LessonScreen,
    viewModel: LessonPlayerViewModel,
    actions: StepActions,
    leave: () -> Unit,
    completionAction: () -> (() -> Unit)?,
): Boolean {
    val digit = DIGIT_KEYS.indexOf(key)

    return when {
        (key == Key.Enter || key == Key.NumPadEnter) && state.phase == LessonPhase.Completed -> {
            completionAction()?.invoke()
            true
        }

        key == Key.Enter || key == Key.NumPadEnter -> {
            actions.runPrimary()
            true
        }

        key == Key.DirectionLeft && screen.canGoBack -> {
            viewModel.dispatch(LessonAction.GoBack)
            true
        }

        key == Key.DirectionRight && screen.canGoForward -> {
            viewModel.dispatch(LessonAction.Continue)
            true
        }

        key == Key.Escape -> {
            leave()
            true
        }

        digit >= 0 && state.phase == LessonPhase.Playing -> {
            val step = screen.step ?: return false
            val pick = keyPick(step, digit, state) ?: return false
            viewModel.select(pick.answer)
            true
        }

        else -> {
            false
        }
    }
}

private val DIGIT_KEYS = listOf(Key.One, Key.Two, Key.Three, Key.Four, Key.Five, Key.Six, Key.Seven, Key.Eight, Key.Nine)

@Composable
private fun Starting() {
    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { CircularProgressIndicator() }
}

@Composable
private fun Segments(
    segments: List<Segment>,
    state: LessonPlayerState,
) {
    val parts = segmentParts(segments)
    val label = stringResource(R.string.player_progress)
    val done = if (state.phase == LessonPhase.Completed) state.queue.size else state.position

    LessonColumn(
        Modifier.padding(bottom = 8.dp).semantics {
            contentDescription = label
            progressBarRangeInfo =
                ProgressBarRangeInfo(
                    done.toFloat(),
                    0f..state.queue.size
                        .coerceAtLeast(1)
                        .toFloat(),
                )
        },
    ) {
        MeterParts(parts)
    }
}

@Composable
internal fun segmentParts(segments: List<Segment>): List<MeterPart> =
    segments.map { segment ->
        MeterPart(
            when (segment) {
                Segment.Ahead -> MeterPart.Fill.Track
                Segment.Current -> MeterPart.Fill.Place()
                Segment.Right -> MeterPart.Fill.Solid(MaterialTheme.colorScheme.tertiary)
                Segment.Wrong -> MeterPart.Fill.Solid(MaterialTheme.colorScheme.error)
                Segment.Read -> MeterPart.Fill.Solid(MaterialTheme.colorScheme.onSurface.copy(alpha = READ_ALPHA))
            },
        )
    }

private const val READ_ALPHA = 0.25f

private const val SWIPE_DISTANCE = 96f

@Composable
private fun Content(
    state: LessonPlayerState,
    screen: LessonScreen,
    ending: LessonEnding,
    viewModel: LessonPlayerViewModel,
    actions: StepActions,
    exits: LessonPlayerExits,
    navigator: AppNavigator,
    ownEnd: LessonEndSlot?,
    language: LessonLanguage,
) {
    val run = state.run

    when {
        run is LessonRun.Refused -> {
            Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState())) {
                LessonAccessScreen(run.refusal, onRetry = viewModel::retryStart, exits = exits)
            }
        }

        state.phase == LessonPhase.Completed -> {
            Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState())) {
                if (ownEnd == null) LessonCompletionView(state, ending) else ownEnd.body(state)
            }
        }

        else -> {
            val step = screen.step ?: return
            val scroll = rememberScrollState()

            LaunchedEffect(step.id, state.position) { scroll.scrollTo(0) }
            PrefetchPictures(state)

            val layoutDirection = LocalLayoutDirection.current

            Column(
                Modifier
                    .fillMaxSize()
                    .verticalScroll(scroll)
                    .pointerInput(screen.canGoBack, screen.canGoForward) {
                        var travelled = 0f
                        detectHorizontalDragGestures(
                            onDragStart = { travelled = 0f },
                            onHorizontalDrag = { _, amount -> travelled += amount },
                            onDragEnd = {
                                val forward = if (layoutDirection == LayoutDirection.Rtl) travelled > 0 else travelled < 0
                                if (abs(travelled) > SWIPE_DISTANCE * density) {
                                    if (forward && screen.canGoForward) viewModel.dispatch(LessonAction.Continue)
                                    if (!forward && screen.canGoBack) viewModel.dispatch(LessonAction.GoBack)
                                }
                            },
                        )
                    }.padding(vertical = 16.dp),
            ) {
                LessonColumn {
                    Notice(state, screen, viewModel)
                    // A screen's own picks (placed words, filled blanks) start over on the next screen and on a retry.
                    key(step.id, state.position) { StepView(step, state, screen, actions, navigator, language) }
                    Result(state, screen)
                }
            }
        }
    }
}

private const val PICTURES_AHEAD = 2

/** The next screens' pictures load ahead, so they show at once when the learner gets there. */
@Composable
private fun PrefetchPictures(state: LessonPlayerState) {
    val pictures = LocalPrivatePictures.current ?: return
    val context = LocalContext.current
    val ahead =
        state.queue
            .drop(state.position + 1)
            .take(PICTURES_AHEAD)
            .mapNotNull { state.steps[it]?.image?.url }

    LaunchedEffect(ahead, pictures.session) {
        ahead.forEach { url -> pictures.images.loader.enqueue(pictures.images.request(context, url, pictures.session)) }
    }
}

@Composable
private fun Notice(
    state: LessonPlayerState,
    screen: LessonScreen,
    viewModel: LessonPlayerViewModel,
) {
    val quickCheck = screen.quickCheck

    if (quickCheck != null) {
        LabelChip(
            text = stringResource(R.string.player_quick_check, count(quickCheck.first + 1), count(quickCheck.second)),
            icon = R.drawable.ic_bolt,
        )
        return
    }

    val (icon, text) =
        when (state.notice) {
            LessonNotice.SelfCorrect -> R.drawable.ic_edit to R.string.player_notice_self_correct
            LessonNotice.AnswerNotSaved -> R.drawable.ic_cloud_off to R.string.player_notice_answer_not_saved
            LessonNotice.PictureReady -> R.drawable.ic_image to R.string.player_notice_picture_ready
            LessonNotice.WritingSkipped -> R.drawable.ic_edit_off to R.string.player_notice_writing_skipped
            null -> return
        }

    Row(
        modifier = Modifier.fillMaxWidth().semantics { liveRegion = LiveRegionMode.Polite },
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(painterResource(icon), contentDescription = null, tint = MaterialTheme.colorScheme.onSurfaceVariant)
        Text(
            text = stringResource(text),
            modifier = Modifier.weight(1f),
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            style = MaterialTheme.typography.bodyMedium,
        )
        if (state.notice == LessonNotice.WritingSkipped && state.writingRestore != null && state.phase == LessonPhase.Playing) {
            TextButton(onClick = viewModel::restoreWriting) { Text(stringResource(R.string.player_write_again)) }
        }
    }
}

@Composable
private fun Result(
    state: LessonPlayerState,
    screen: LessonScreen,
) {
    val step = screen.step ?: return
    val result = state.results[step.id] ?: return

    if (state.phase != LessonPhase.Feedback) return

    val next =
        ResultNext(
            nextReviewAt = result.nextReviewAt,
            savedMistake = result.savedMistake && !result.isCorrect,
            willReturn = !result.isCorrect && state.queue.drop(state.position + 1).contains(step.id),
        )

    val requester = remember { BringIntoViewRequester() }

    // The verdict scrolls into view after a check, not when the learner goes back to review it.
    LaunchedEffect(step.id, state.position) { if (!state.reviewing) requester.bringIntoView() }

    Column(Modifier.bringIntoViewRequester(requester), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        if (showsOwnResult(step)) {
            LessonResultNotes(next, screen.hyperdriveStreak)
        } else {
            LessonStepResultView(step, result, next, screen.hyperdriveStreak)
        }
    }
}

@Composable
private fun ActionBar(
    screen: LessonScreen,
    actions: StepActions,
    prompt: PromptAudio?,
    onBack: () -> Unit,
    ask: @Composable () -> Unit,
) {
    val primary = screen.primary ?: return
    // A screen that's read (a word, a letter) has its recording here; listening plays it on the screen.
    val promptUrl = screen.step?.takeIf { it.isReadStep }?.let(::promptAudioUrl)

    TaskActions { width ->
        if (screen.canGoBack) {
            OutlinedIconButton(onClick = onBack) {
                Icon(painterResource(R.drawable.ic_chevron_left), contentDescription = stringResource(R.string.player_previous_screen))
            }
        }
        if (promptUrl != null && prompt != null) PromptAudioIconButton(promptUrl, prompt)
        Button(onClick = actions::runPrimary, enabled = primary.enabled, modifier = width) {
            if (primary.busy) {
                CircularProgressIndicator(Modifier.padding(end = 8.dp).size(18.dp), strokeWidth = 2.dp)
            }
            Text(stringResource(primary.label.text()))
        }
        ask()
    }
}

/**
 * Main's task actions: across the bar on narrower windows, at its end on wide ones. Each button
 * takes the content's `width`: a share of the bar, or as wide as its label.
 */
@Composable
internal fun TaskActions(content: @Composable RowScope.(width: Modifier) -> Unit) {
    val wide = currentWindowAdaptiveInfoV2().windowSizeClass.isWidthAtLeastBreakpoint(WindowSizeClass.WIDTH_DP_EXPANDED_LOWER_BOUND)

    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(12.dp, if (wide) Alignment.End else Alignment.Start),
        verticalAlignment = Alignment.CenterVertically,
    ) { content(if (wide) Modifier.widthIn(min = 160.dp) else Modifier.weight(1f)) }
}

private fun PrimaryLabel.text(): Int =
    when (this) {
        PrimaryLabel.Check -> R.string.player_action_check
        PrimaryLabel.Checking -> R.string.player_action_checking
        PrimaryLabel.Confirm -> R.string.player_action_confirm
        PrimaryLabel.Continue -> R.string.player_action_continue
        PrimaryLabel.Next -> R.string.player_action_next
        PrimaryLabel.NextStep -> R.string.player_action_next_step
        PrimaryLabel.SeeAnswer -> R.string.player_action_see_answer
        PrimaryLabel.SeeHowItWent -> R.string.player_action_see_how_it_went
        PrimaryLabel.Start -> R.string.player_action_start
    }

@Composable
private fun ScreenMenu(
    lesson: PlayableLesson,
    state: LessonPlayerState?,
    screen: LessonScreen?,
    viewModel: LessonPlayerViewModel,
) {
    var open by remember { mutableStateOf(false) }
    var summaryOpen by rememberSaveable { mutableStateOf(false) }
    val isDone = state?.phase == LessonPhase.Completed

    if (screen?.step == null && !isDone) return

    Box {
        IconButton(onClick = { open = true }) {
            Icon(painterResource(R.drawable.ic_more_vert), contentDescription = stringResource(R.string.player_screen_options))
        }
        DropdownMenu(expanded = open, onDismissRequest = { open = false }) {
            DropdownMenuItem(
                text = { Text(stringResource(R.string.player_ai_note), style = MaterialTheme.typography.bodySmall) },
                onClick = {},
                enabled = false,
                leadingIcon = { Icon(painterResource(R.drawable.ic_auto_awesome), contentDescription = null) },
            )
            HorizontalDivider()
            if (screen?.canKnowThis == true) {
                DropdownMenuItem(
                    text = { Text(stringResource(R.string.player_know_this)) },
                    onClick = {
                        open = false
                        viewModel.dispatch(LessonAction.KnowThis)
                    },
                    leadingIcon = { Icon(painterResource(R.drawable.ic_bolt), contentDescription = null) },
                )
            }
            if (isDone && lesson.summaryIdeas.isNotEmpty()) {
                DropdownMenuItem(
                    text = { Text(stringResource(R.string.player_lesson_summary)) },
                    onClick = {
                        open = false
                        summaryOpen = true
                    },
                    leadingIcon = { Icon(painterResource(R.drawable.ic_description), contentDescription = null) },
                )
            }
        }
    }

    if (summaryOpen && isDone) {
        SummarySheet(lesson.summaryIdeas, onDismiss = { summaryOpen = false })
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun SummarySheet(
    ideas: List<String>,
    onDismiss: () -> Unit,
) {
    ModalBottomSheet(onDismissRequest = onDismiss) {
        LessonColumn(Modifier.verticalScroll(rememberScrollState()).padding(bottom = 24.dp)) {
            Text(stringResource(R.string.player_lesson_summary), style = MaterialTheme.typography.titleLarge)
            SummaryIdeas(ideas)
        }
    }
}

/** A lesson that ends its own way, as a quick explanation does: its end once the lesson saves, and Done. */
class LessonEndSlot(
    val body: @Composable (LessonPlayerState) -> Unit,
    val done: () -> Unit,
)

@Composable
private fun DoneAction(
    end: LessonEndSlot,
    saving: Boolean,
) {
    TaskActions { width ->
        Button(onClick = end.done, enabled = !saving, modifier = width) { Text(stringResource(R.string.player_done)) }
    }
}
