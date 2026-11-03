package com.zoonk.android.feature.player

import androidx.activity.compose.LocalActivity
import androidx.activity.compose.LocalOnBackPressedDispatcherOwner
import androidx.compose.foundation.ScrollState
import androidx.compose.foundation.focusable
import androidx.compose.foundation.gestures.animateScrollBy
import androidx.compose.foundation.gestures.detectHorizontalDragGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.layout.wrapContentWidth
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.IntState
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.MutableIntState
import androidx.compose.runtime.SideEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.SaveableStateHolder
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.saveable.rememberSaveableStateHolder
import androidx.compose.runtime.setValue
import androidx.compose.runtime.withFrameNanos
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.input.key.key
import androidx.compose.ui.input.key.onKeyEvent
import androidx.compose.ui.input.key.onPreviewKeyEvent
import androidx.compose.ui.input.key.type
import androidx.compose.ui.input.pointer.PointerEventPass
import androidx.compose.ui.input.pointer.PointerEventType
import androidx.compose.ui.input.pointer.PointerInputScope
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.Layout
import androidx.compose.ui.layout.layoutId
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.ProgressBarRangeInfo
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.isTraversalGroup
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.progressBarRangeInfo
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.constrainHeight
import androidx.compose.ui.unit.constrainWidth
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.LifecycleStartEffect
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.zoonk.android.R
import com.zoonk.android.feature.audio.VoiceRecording
import com.zoonk.android.feature.ceremonies.MomentAfterCeremony
import com.zoonk.android.feature.ceremonies.MomentCeremony
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
import com.zoonk.android.feature.player.engine.round
import com.zoonk.android.feature.player.engine.screen
import com.zoonk.android.feature.player.language.LessonLanguage
import com.zoonk.android.feature.player.language.PromptAudio
import com.zoonk.android.feature.player.language.PromptAudioEffect
import com.zoonk.android.feature.player.language.PromptAudioIconButton
import com.zoonk.android.feature.player.language.promptAudioUrl
import com.zoonk.android.feature.player.language.rememberLessonLanguage
import com.zoonk.android.feature.player.model.LessonAnswer
import com.zoonk.android.feature.player.model.PlayableLesson
import com.zoonk.android.feature.player.model.StepContent
import com.zoonk.android.feature.player.steps.FillsView
import com.zoonk.android.feature.player.steps.LessonMapView
import com.zoonk.android.feature.player.steps.LocalPrimaryFocus
import com.zoonk.android.feature.player.steps.LocalScreenWork
import com.zoonk.android.feature.player.steps.LocalStepViewHeight
import com.zoonk.android.feature.player.steps.StepActions
import com.zoonk.android.feature.player.steps.StepPart
import com.zoonk.android.feature.player.steps.StepView
import com.zoonk.android.feature.player.steps.count
import com.zoonk.android.feature.player.steps.keyPick
import com.zoonk.android.feature.player.steps.rememberScreenWork
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.ui.components.CelebrationScope
import com.zoonk.android.ui.components.DropdownMenu
import com.zoonk.android.ui.components.LabelChip
import com.zoonk.android.ui.components.LocalPrivatePictures
import com.zoonk.android.ui.components.MeterPart
import com.zoonk.android.ui.components.MeterParts
import com.zoonk.android.ui.components.ModalBottomSheet
import com.zoonk.android.ui.components.OutlinedIconButton
import com.zoonk.android.ui.components.TaskActionBar
import com.zoonk.android.ui.components.TaskActions
import com.zoonk.android.ui.scaffold.BeforeFold
import com.zoonk.android.ui.scaffold.PageSpan
import com.zoonk.android.ui.scaffold.SpreadScreen
import com.zoonk.android.ui.scaffold.TaskExitConfirmation
import com.zoonk.android.ui.scaffold.TaskScaffold
import com.zoonk.android.ui.scaffold.onPageSpan
import com.zoonk.android.ui.scaffold.spreadFold
import com.zoonk.android.ui.scaffold.spreadShows
import com.zoonk.api.models.LearnerSummaryBuddy
import com.zoonk.api.models.LessonMap
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
            modifier = Modifier.lessonColumnWidth(),
            verticalArrangement = Arrangement.spacedBy(COLUMN_SPACING),
            content = content,
        )
    }
}

/** For a screen with one decision, such as a gate or a wait. */
@Composable
internal fun LessonColumnBeforeFold(content: @Composable ColumnScope.() -> Unit) {
    BeforeFold { beforeFold -> LessonColumn(beforeFold.padding(vertical = 24.dp), content) }
}

/**
 * A lesson's end as the shared foldables rule lays out a result: what was [done], then what's [next]
 * beside the way on. [withMoment] is whether its moment is on screen yet, which waits for the save.
 * The lesson's [map] sits under what was done on a spread; one column keeps it behind ⋮.
 */
@Composable
internal fun LessonEndPages(
    withMoment: Boolean,
    done: @Composable ColumnScope.() -> Unit,
    next: @Composable ColumnScope.() -> Unit,
    map: StepContent.Map? = null,
) {
    // The moment plays once: made again after a fold or a rotation, the end shows it as it finished.
    var played by rememberSaveable { mutableStateOf(false) }
    val plays = remember { !played }
    SideEffect { if (withMoment) played = true }
    // The one column keeps its own scroll, so folding back finds it where the learner left it.
    val scroll = rememberScrollState()
    val doneScroll = rememberScrollState()
    val nextScroll = rememberScrollState()
    var span by remember { mutableStateOf<PageSpan?>(null) }

    CelebrationScope(play = plays) {
        BoxWithConstraints(Modifier.fillMaxSize().onPageSpan { span = it }) {
            val fold = spreadFold(maxWidth, span)

            if (fold == null) {
                EndPage(Modifier.fillMaxSize(), scroll, Alignment.CenterHorizontally) {
                    done()
                    next()
                }
            } else {
                EndPage(Modifier.width(fold.start).fillMaxHeight().semantics { isTraversalGroup = true }, doneScroll, Alignment.End) {
                    done()
                    if (map != null) {
                        HorizontalDivider()
                        Text(
                            stringResource(R.string.player_lesson_map),
                            Modifier.semantics { heading() },
                            style = MaterialTheme.typography.titleMedium,
                        )
                        LessonMapView(map.map, map.title)
                    }
                }
                EndPage(
                    Modifier.fillMaxSize().padding(start = fold.end).semantics { isTraversalGroup = true },
                    nextScroll,
                    Alignment.Start,
                    next,
                )
            }
        }
    }
}

@Composable
private fun EndPage(
    modifier: Modifier,
    scroll: ScrollState,
    align: Alignment.Horizontal,
    content: @Composable ColumnScope.() -> Unit,
) {
    Column(
        modifier
            .verticalScroll(scroll)
            .padding(vertical = 24.dp)
            .wrapContentWidth(align)
            .lessonColumnWidth(),
        verticalArrangement = Arrangement.spacedBy(COLUMN_SPACING),
        content = content,
    )
}

/**
 * A [LessonColumn] as tall as the view at least: the part with the [FillsView] id stretches over
 * the height the other parts leave, never shorter than its own content. An empty part takes no gap,
 * so a page whose screen draws nothing on it starts level with the page beside it. A page of a
 * spread [align]s its column toward the split, so on a very wide window the pages still meet there.
 */
@Composable
private fun StepColumn(
    modifier: Modifier,
    align: Alignment.Horizontal = Alignment.CenterHorizontally,
    content: @Composable () -> Unit,
) {
    Layout(content, modifier.wrapContentWidth(align).lessonColumnWidth()) { measurables, constraints ->
        val spacing = COLUMN_SPACING.roundToPx()
        val loose = constraints.copy(minWidth = 0, minHeight = 0)
        val filling = measurables.indexOfFirst { it.layoutId == FillsView }
        val others = measurables.mapIndexed { index, part -> if (index == filling) null else part.measure(loose) }
        val gaps = spacing * (others.count { it == null || it.height > 0 } - 1).coerceAtLeast(0)
        val left = (constraints.minHeight - gaps - others.sumOf { it?.height ?: 0 }).coerceAtLeast(0)
        val parts = others.mapIndexed { index, part -> part ?: measurables[index].measure(loose.copy(minHeight = left)) }

        layout(
            constraints.constrainWidth(parts.maxOfOrNull { it.width } ?: 0),
            constraints.constrainHeight(parts.sumOf { it.height } + gaps),
        ) {
            var y = 0
            parts.forEach {
                it.placeRelative(0, y)
                if (it.height > 0) y += it.height + spacing
            }
        }
    }
}

private fun Modifier.lessonColumnWidth() = widthIn(max = COLUMN_WIDTH).fillMaxWidth().padding(horizontal = COLUMN_PADDING)

private val COLUMN_WIDTH = 640.dp
private val COLUMN_PADDING = 20.dp
private val COLUMN_SPACING = 20.dp

@Composable
fun LessonPlayer(
    lesson: PlayableLesson,
    state: LessonPlayerState?,
    ending: LessonEnding,
    viewModel: LessonPlayerViewModel,
    exits: LessonPlayerExits,
    navigator: AppNavigator,
    endSlot: LessonEndSlot? = null,
    buddy: LearnerSummaryBuddy? = null,
    ceremony: MomentCeremony? = null,
    tutor: LessonTutor? = null,
) {
    val screen = remember(state) { state?.screen() }
    val ownEnd =
        endSlot?.takeIf {
            state?.completion?.status == CompletionStatus.Saving ||
                state?.completion?.status == CompletionStatus.Saved
        }
    val language = rememberLessonLanguage(lesson.language, lesson.targetLanguage)
    val shownStep = screen?.step?.takeIf { state?.run !is LessonRun.Refused }
    language.prompt?.let { PromptAudioEffect(shownStep, viewModel.cantTalk, it) }
    val activity = LocalActivity.current
    LifecycleStartEffect(viewModel) { onStopOrDispose { if (activity?.isChangingConfigurations != true) viewModel.leave() } }
    val actions =
        remember(viewModel) {
            object : StepActions {
                private var keyPicks: ((LessonAnswer?) -> Unit)? = null

                override fun select(answer: LessonAnswer?) = viewModel.select(answer)

                override fun pickByKey(answer: LessonAnswer?) {
                    val own = keyPicks
                    if (own == null) select(answer) else own(answer)
                }

                override fun takeKeyPicks(pick: ((LessonAnswer?) -> Unit)?) {
                    keyPicks = pick
                }

                override fun runPrimary() {
                    viewModel.state.value
                        ?.screen()
                        ?.primary
                        ?.takeIf { it.enabled }
                        ?.let { if (it.isCheck) viewModel.check() else viewModel.dispatch(LessonAction.Continue) }
                }

                override fun dontKnow(stepId: String) = viewModel.dispatch(LessonAction.DontKnow(stepId))

                override fun skipWriting() = viewModel.skipWriting()

                override fun explainFirst() = viewModel.dispatch(LessonAction.ExplainFirst)

                override val cantTalk get() = viewModel.cantTalk

                override fun setCantTalk(chosen: Boolean) = viewModel.setCantTalk(chosen)

                override val cantListen get() = viewModel.cantListen

                override fun setCantListen(chosen: Boolean) = viewModel.setCantListen(chosen)

                override suspend fun gradeSpoken(
                    stepId: String,
                    recording: VoiceRecording,
                ) = viewModel.gradeSpoken(stepId, recording)

                override fun exampleLine(stepId: String) = viewModel.exampleLine(stepId)
            }
        }
    val focus = remember { FocusRequester() }
    val primaryFocus = remember { FocusRequester() }
    val canvasWork = rememberSaveableStateHolder()
    var asking by rememberSaveable { mutableStateOf(false) }
    // Ask opened beside the screen on an open book sits on the page after the fold, so it hides while the device is closed.
    var askedOnSpread by rememberSaveable { mutableStateOf(false) }
    // A suggestion the help beside a teaching screen put in the buddy's composer, until the buddy takes it.
    var offerId by rememberSaveable { mutableStateOf<String?>(null) }
    // Main's offer to ask the buddy stops for a question once it's turned down or the buddy is asked about it.
    var closedOffers by rememberSaveable { mutableStateOf(emptyList<String>()) }
    val stepId = screen?.step?.id
    val closeOffer = { if (stepId != null) closedOffers = closedOffers + stepId }
    val ask = { onSpread: Boolean ->
        asking = true
        askedOnSpread = onSpread
        closeOffer()
    }
    val touches = remember { mutableIntStateOf(0) }
    val offer: (@Composable (BuddyOfferReason) -> Unit)? =
        if (tutor == null || stepId in closedOffers) {
            null
        } else {
            { reason ->
                val spread = spreadShows()
                AskBuddyOffer(reason, tutor.identity, onAsk = { ask(spread) }, onDismiss = closeOffer)
            }
        }
    val help: (@Composable () -> Unit)? =
        tutor?.takeIf { it.canAsk }?.let { buddy ->
            {
                val spread = spreadShows()
                ScreenHelp(buddy) { suggestion ->
                    offerId = suggestion?.id
                    ask(spread)
                }
            }
        }
    val unsent = screen?.unsentAnswer == true
    val backDispatcher = LocalOnBackPressedDispatcherOwner.current?.onBackPressedDispatcher
    // Escape leaves as back does, so leaving with an unsent answer asks first.
    val leave = { backDispatcher?.onBackPressed() ?: exits.close() }

    SpreadScreen {
        TaskScaffold(
            onClose = exits::close,
            modifier =
                Modifier
                    .focusRequester(focus)
                    .focusable()
                    .pointerInput(Unit) { countTouches(touches) }
                    .onPreviewKeyEvent { event ->
                        if (event.type == KeyEventType.KeyDown) touches.intValue++
                        false
                    }.onKeyEvent { event ->
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
                        { TaskActionBar { DoneAction(ownEnd, saving = state.completion?.status == CompletionStatus.Saving) } }
                    }

                    state.phase == LessonPhase.Completed -> {
                        { TaskActionBar { CompletionActions(lesson, state, ending, viewModel, exits) } }
                    }

                    screen.primary != null -> {
                        {
                            val spread = spreadShows()
                            TaskActionBar {
                                ActionBar(
                                    screen,
                                    actions,
                                    language.prompt,
                                    primaryFocus,
                                    onBack = { viewModel.dispatch(LessonAction.GoBack) },
                                ) {
                                    // A screen that already offers help keeps the ask quiet.
                                    tutor?.askButton?.invoke(
                                        state.tutorScope(screen),
                                        state.showsMiss(screen) && screen.struggleOffer == null,
                                        asking && (spread || !askedOnSpread),
                                        tutor.suggestions.firstOrNull { it.id == offerId },
                                        { offerId = null },
                                    ) { open -> if (open) ask(spread) else asking = false }
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
                    CompositionLocalProvider(LocalPrimaryFocus provides primaryFocus) {
                        Content(
                            state,
                            screen,
                            ending,
                            viewModel,
                            actions,
                            exits,
                            navigator,
                            ownEnd,
                            language,
                            buddy,
                            ceremony,
                            offer,
                            help,
                            touches,
                            canvasWork,
                        )
                    }
                }
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
            actions.pickByKey(pick.answer)
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
    val done = if (state.phase == LessonPhase.Completed) segments.size else state.position

    LessonColumn(
        Modifier.padding(bottom = 8.dp).semantics {
            contentDescription = label
            progressBarRangeInfo = ProgressBarRangeInfo(done.toFloat(), 0f..segments.size.coerceAtLeast(1).toFloat())
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
private val STEP_PADDING = 16.dp
private val REVEAL_MARGIN = 16.dp

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
    buddy: LearnerSummaryBuddy?,
    ceremony: MomentCeremony?,
    offer: (@Composable (BuddyOfferReason) -> Unit)?,
    help: (@Composable () -> Unit)?,
    touches: IntState,
    canvasWork: SaveableStateHolder,
) {
    val run = state.run

    when {
        run is LessonRun.Refused -> {
            Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState())) {
                LessonAccessScreen(run.refusal, onRetry = viewModel::retryStart, exits = exits)
            }
        }

        state.phase == LessonPhase.Completed -> {
            MomentAfterCeremony(state.completion?.result?.ceremonyMilestone(), ceremony) {
                if (ownEnd == null) LessonCompletionView(state, ending, buddy) else ownEnd.body(state)
            }
        }

        else -> {
            val step = screen.step ?: return
            // The one column and the screen's page across a fold share their scroll, so a reading place keeps as the book
            // opens or closes; the turn's page has its own.
            val scroll = rememberScrollState()
            val turnScroll = rememberScrollState()
            val reveal = remember(step.id, state.position) { FeedbackReveal() }
            var span by remember { mutableStateOf<PageSpan?>(null) }

            // A new screen starts at its top; the same one recreated (the book folding, a rotation) stays where it was.
            var scrolledTo by rememberSaveable { mutableStateOf<String?>(null) }
            val screenKey = "${step.id}:${state.position}"
            // "From the lesson" sits in the one column or on the page before the fold, so the screens it's open on are kept
            // here, each for its round.
            var openRecaps by rememberSaveable { mutableStateOf(emptyList<String>()) }
            val round = "${step.id}:${state.round(step.id)}"
            val recap = @Composable {
                LessonRecap(state, screen, round in openRecaps) {
                    openRecaps =
                        if (it) openRecaps + round else openRecaps - round
                }
            }
            val work = rememberScreenWork(canvasWork, step.id, state.round(step.id))

            LaunchedEffect(screenKey) {
                if (scrolledTo != screenKey) {
                    scroll.scrollTo(0)
                    turnScroll.scrollTo(0)
                    scrolledTo = screenKey
                }
            }
            PrefetchPictures(state)

            val layoutDirection = LocalLayoutDirection.current

            CompositionLocalProvider(LocalFeedbackReveal provides reveal, LocalScreenWork provides work) {
                BoxWithConstraints(
                    Modifier
                        .fillMaxSize()
                        .onPageSpan { span = it }
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
                        },
                ) {
                    val fold = spreadFold(maxWidth, span)
                    // The turn's page is the whole column without a fold, so the work in it keeps when the book opens or closes.
                    val part = if (fold == null) StepPart.Whole else StepPart.Turn

                    StepColumn(
                        Modifier
                            .fillMaxSize()
                            .then(if (fold == null) Modifier else Modifier.padding(start = fold.end).semantics { isTraversalGroup = true })
                            .onGloballyPositioned { reveal.viewport = it }
                            .verticalScroll(if (fold == null) scroll else turnScroll)
                            .padding(vertical = STEP_PADDING),
                        align = if (fold == null) Alignment.CenterHorizontally else Alignment.Start,
                    ) {
                        Notice(state, screen, viewModel, part)
                        CompositionLocalProvider(LocalStepViewHeight provides if (fold == null) maxHeight - STEP_PADDING * 2 else null) {
                            work.Page(turn = true) { StepView(step, state, screen, actions, navigator, language, part) }
                        }
                        // Beside a teaching screen's text, the buddy's help stays in view, so it never also pops up after a pause.
                        if (help != null && fold != null && step.teachesInText) {
                            help()
                        } else if (offer != null && screen.quickCheck == null) {
                            StrugglePause(step, state.position, touches) { offer(BuddyOfferReason.Pause) }
                        }
                        Result(state, screen, if (fold == null) scroll else turnScroll, reveal, viewModel, exits, offer)
                        if (fold == null) recap()
                    }

                    if (fold != null) {
                        // Feedback scrolls into view on the turn's page; the question here doesn't scroll with it.
                        CompositionLocalProvider(LocalFeedbackReveal provides null) {
                            StepColumn(
                                Modifier
                                    .width(fold.start)
                                    .fillMaxHeight()
                                    .semantics { isTraversalGroup = true }
                                    .verticalScroll(scroll)
                                    .padding(vertical = STEP_PADDING),
                                align = Alignment.End,
                            ) {
                                Notice(state, screen, viewModel, StepPart.Screen)
                                work.Page(turn = false) { StepView(step, state, screen, actions, navigator, language, StepPart.Screen) }
                                recap()
                            }
                        }
                    }
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
            .mapNotNull { state.steps[it] }
            .flatMap { step -> listOfNotNull(step.image?.url) + step.optionPictures.values.map { it.url } }

    LaunchedEffect(ahead, pictures.session) {
        ahead.forEach { url -> pictures.images.loader.enqueue(pictures.images.request(context, url, pictures.session)) }
    }
}

@Composable
private fun Notice(
    state: LessonPlayerState,
    screen: LessonScreen,
    viewModel: LessonPlayerViewModel,
    part: StepPart,
) {
    val quickCheck = screen.quickCheck
    // Asking to fix a wrong answer is part of the learner's turn, beside the answer.
    val shown = if (quickCheck == null && state.notice == LessonNotice.SelfCorrect) part.showsTurn else part.showsScreen

    if (!shown) return

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
    scroll: ScrollState,
    reveal: FeedbackReveal,
    viewModel: LessonPlayerViewModel,
    exits: LessonPlayerExits,
    offer: (@Composable (BuddyOfferReason) -> Unit)?,
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

    val margin = with(LocalDensity.current) { REVEAL_MARGIN.toPx() }

    // The verdict scrolls into view after a check, not when the learner goes back to review it.
    LaunchedEffect(step.id, state.position) {
        if (!state.reviewing) {
            withFrameNanos {}
            scroll.animateScrollBy(reveal.scrollBy(margin))
        }
    }

    Column(Modifier.revealPart(reveal, RevealPart.Result), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        if (showsOwnResult(step)) {
            LessonResultNotes(next, screen.hyperdriveStreak)
        } else {
            val explanations by viewModel.explanations.collectAsStateWithLifecycle()
            LessonStepResultView(step, result, next, screen.hyperdriveStreak) {
                ExplainAnswer(
                    explanation = explanations[step.id],
                    onExplain = viewModel::explainAnswer,
                    onCreateAccount = { exits.open(AppRoute.Login) },
                    onSeePlus = { exits.open(AppRoute.Subscription) },
                )
            }
        }

        if (screen.struggleOffer != null) offer?.invoke(BuddyOfferReason.Misses)
    }
}

/** A press, a scroll or a key is the learner still there, as main's struggle pause counts them. */
private suspend fun PointerInputScope.countTouches(touches: MutableIntState) {
    awaitPointerEventScope {
        while (true) {
            val type = awaitPointerEvent(PointerEventPass.Initial).type
            if (type == PointerEventType.Press || type == PointerEventType.Scroll) touches.intValue++
        }
    }
}

@Composable
private fun ActionBar(
    screen: LessonScreen,
    actions: StepActions,
    prompt: PromptAudio?,
    primaryFocus: FocusRequester,
    onBack: () -> Unit,
    ask: @Composable () -> Unit,
) {
    val primary = screen.primary ?: return
    // Listening plays its sentence from its own button on the screen.
    val promptUrl = screen.step?.takeIf { it.isReadStep }?.let { promptAudioUrl(it) }

    val back: (@Composable () -> Unit)? =
        if (screen.canGoBack) {
            {
                OutlinedIconButton(onClick = onBack) {
                    Icon(painterResource(R.drawable.ic_chevron_left), contentDescription = stringResource(R.string.player_previous_screen))
                }
            }
        } else {
            null
        }

    TaskActions(back) { width ->
        if (promptUrl != null && prompt != null) PromptAudioIconButton(promptUrl, prompt)
        Button(onClick = actions::runPrimary, enabled = primary.enabled, modifier = width.focusRequester(primaryFocus)) {
            if (primary.busy) {
                CircularProgressIndicator(Modifier.padding(end = 8.dp).size(18.dp), strokeWidth = 2.dp)
            }
            Text(stringResource(primary.label.text()))
        }
        ask()
    }
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
    var open by rememberSaveable { mutableStateOf(false) }
    var mapOpen by rememberSaveable { mutableStateOf(false) }
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
            if (isDone && lesson.map != null) {
                DropdownMenuItem(
                    text = { Text(stringResource(R.string.player_lesson_map)) },
                    onClick = {
                        open = false
                        mapOpen = true
                    },
                    leadingIcon = { Icon(painterResource(R.drawable.ic_lan), contentDescription = null) },
                )
            }
        }
    }

    val map = lesson.map
    if (mapOpen && isDone && map != null) {
        LessonMapSheet(map, lesson.title, onDismiss = { mapOpen = false })
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun LessonMapSheet(
    map: LessonMap,
    title: String,
    onDismiss: () -> Unit,
) {
    ModalBottomSheet(onDismissRequest = onDismiss) {
        LessonColumn(Modifier.verticalScroll(rememberScrollState()).padding(bottom = 24.dp)) {
            Text(stringResource(R.string.player_lesson_map), Modifier.semantics { heading() }, style = MaterialTheme.typography.titleLarge)
            LessonMapView(map, title)
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
