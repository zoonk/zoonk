package com.zoonk.android.feature.buddy

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.fitInside
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.text.input.setTextAndPlaceCursorAtEnd
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.layout.Layout
import androidx.compose.ui.layout.WindowInsetsRulers
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.constrainWidth
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.createSavedStateHandle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.zoonk.android.R
import com.zoonk.android.app.AppContainer
import com.zoonk.android.data.LoadState
import com.zoonk.android.data.collectShown
import com.zoonk.android.data.value
import com.zoonk.android.feature.session.MissionOpens
import com.zoonk.android.feature.settings.BuddyEditor
import com.zoonk.android.feature.today.GoalMistakes
import com.zoonk.android.feature.tutor.TutorAccess
import com.zoonk.android.feature.tutor.TutorIdentity
import com.zoonk.android.feature.tutor.TutorPage
import com.zoonk.android.feature.tutor.TutorPanel
import com.zoonk.android.feature.tutor.TutorRoutes
import com.zoonk.android.feature.tutor.TutorScope
import com.zoonk.android.feature.tutor.TutorSuggestion
import com.zoonk.android.feature.tutor.rememberTutor
import com.zoonk.android.feature.tutor.rememberTutorAccess
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.ui.ActOn
import com.zoonk.android.ui.OnVisitEnd
import com.zoonk.android.ui.VisitOf
import com.zoonk.android.ui.characters.Buddy
import com.zoonk.android.ui.characters.BuddyAct
import com.zoonk.android.ui.characters.BuddyActor
import com.zoonk.android.ui.characters.BuddyActorState
import com.zoonk.android.ui.characters.BuddyCrop
import com.zoonk.android.ui.characters.BuddyEnergyState
import com.zoonk.android.ui.characters.BuddyGlasses
import com.zoonk.android.ui.characters.BuddyGlassesPicker
import com.zoonk.android.ui.characters.BuddyLook
import com.zoonk.android.ui.characters.buddyName
import com.zoonk.android.ui.characters.rememberBuddyActorState
import com.zoonk.android.ui.components.DropdownMenu
import com.zoonk.android.ui.components.LoadFailedMessage
import com.zoonk.android.ui.components.ModalBottomSheet
import com.zoonk.android.ui.components.MoreButton
import com.zoonk.android.ui.components.OutlinedButton
import com.zoonk.android.ui.components.PageLoading
import com.zoonk.android.ui.components.rememberExpandedBottomSheetState
import com.zoonk.android.ui.scaffold.PageWithSupportingPane
import com.zoonk.android.ui.scaffold.TabRootScaffold
import com.zoonk.api.models.BuddyStatus
import com.zoonk.api.models.LearnerSummary
import com.zoonk.api.models.LearnerSummaryGoal
import kotlinx.coroutines.launch
import java.util.UUID

/** `/buddy`: the buddy and its day over the goal's conversations, or its offer to start a goal. */
@Composable
fun BuddyScreen(
    route: AppRoute.Buddy,
    app: AppContainer,
    navigator: AppNavigator,
) {
    val status by app.buddy.status.collectShown()
    val summary by app.learnerSummary.summary.collectShown()
    val coroutines = rememberCoroutineScope()

    TabRootScaffold { padding ->
        // The keyboard covers the navigation bar, which imePadding() would leave as a gap above it.
        Box(Modifier.fillMaxSize().padding(padding).fitInside(WindowInsetsRulers.Ime.current)) {
            val read = status
            val learner = summary.value
            when {
                read is LoadState.Loaded && learner != null -> {
                    val goalId = learner.tutoredGoalId
                    if (goalId == null) {
                        BuddyGoalStart(read.value, route.ask, navigator)
                    } else {
                        BuddyPage(read.value, goalId, route, app, navigator)
                    }
                }

                read is LoadState.Failed || summary is LoadState.Failed -> {
                    LoadFailedMessage(
                        onRetry = {
                            coroutines.launch {
                                if (read is LoadState.Failed) app.buddy.status.refresh()
                                if (summary is LoadState.Failed) app.learnerSummary.summary.refresh()
                            }
                        },
                    )
                }

                else -> {
                    PageLoading()
                }
            }
        }
    }
}

/** The buddy tutors the goal the tabs show, unless it's archived or only a quick explanation. */
private val LearnerSummary.tutoredGoalId: String?
    get() =
        goals
            .firstOrNull { it.id == activeGoalId }
            ?.takeIf { it.status != LearnerSummaryGoal.Status.ARCHIVED && it.kind != LearnerSummaryGoal.Kind.EXPLAIN }
            ?.id
            ?.toString()

/**
 * The goal's open conversation beside the list of its others: in the pane where there's room, and
 * in a sheet from the title row where there isn't. A guest, who can't ask, has neither.
 */
@Composable
fun BuddyPage(
    status: BuddyStatus,
    goalId: String,
    route: AppRoute.Buddy,
    app: AppContainer,
    navigator: AppNavigator,
    access: TutorAccess = rememberTutorAccess(app),
) {
    val vm = viewModel { BuddyViewModel(app.buddy, app.learningProfile, app.studyOpener, app.tutor, createSavedStateHandle()) }
    val look = status.look()
    val name = buddyName(look.kind, status.buddy.name)
    val face = rememberBuddyActorState()
    val mistakes by remember(goalId) { app.today.mistakes[UUID.fromString(goalId)] }.collectShown()
    var editing by rememberSaveable { mutableStateOf(false) }
    var wearing by rememberSaveable { mutableStateOf(false) }
    var listing by rememberSaveable { mutableStateOf(false) }
    val coroutines = rememberCoroutineScope()
    // Only while awake: asleep it naps on, and glowing it's already beaming.
    val react: (BuddyAct) -> Unit = { act -> if (look.energyState == BuddyEnergyState.Awake) coroutines.launch { face.play(act) } }
    val composer = remember { FocusRequester() }
    val keyboard = LocalSoftwareKeyboardController.current
    var asking by remember { mutableStateOf(false) }
    // The day's sheet stays open while a mission's block opens, so its row shows the wait or the failure, and closes once a tap leads somewhere.
    var dayOpen by rememberSaveable { mutableStateOf(false) }
    // Asking the buddy happens in this page's own composer, so its mission puts the cursor there.
    val onMission: (BuddyTap) -> Unit = { tap ->
        if (tap.opens == MissionOpens.Buddy) {
            dayOpen = false
            asking = true
        } else {
            vm.openMission(tap, goalId)
        }
    }
    val taps = BuddyDayTaps(onMission, vm.opening, vm.openFailed)
    val asks = access == TutorAccess.Ask
    val listRead = if (asks) remember(goalId) { app.tutor.conversations[goalId] }.collectShown().value else null
    val list = listRead?.value
    val hasConversations = list?.conversations?.isNotEmpty() == true
    // A guest's conversation is only the buddy's hello: it's never read or sent, so it's named here.
    val guestConversation = rememberSaveable(goalId) { UUID.randomUUID().toString() }
    val conversationId = if (asks) vm.openConversation(goalId) else guestConversation

    OnVisitEnd(vm, goalId, onEnd = vm::endVisit)
    ActOn(vm.route) {
        dayOpen = false
        navigator.open(it)
    }
    LaunchedEffect(asking) {
        if (!asking) return@LaunchedEffect
        composer.requestFocus()
        keyboard?.show()
        asking = false
    }
    LaunchedEffect(goalId, list, asks) { if (asks) vm.choose(goalId, route, list) }

    val page =
        TutorPage(
            greeting = stringResource(R.string.buddy_page_greeting, name),
            suggestions = suggestions(hasToday = status.today != null, mistakes = mistakes),
            placeholder = stringResource(R.string.buddy_page_placeholder),
            greetingAction = if (status.buddy.picked) null else ({ PickBuddyButton { editing = true } }),
            onAsked = { react(BuddyAct.Glance) },
            onAnswered = { react(BuddyAct.Smile) },
            composerFocus = composer,
        )
    val routes =
        TutorRoutes(
            createAccount = { navigator.open(AppRoute.Login) },
            signIn = { navigator.open(AppRoute.Login) },
            subscribe = { navigator.open(AppRoute.Subscription) },
            open = navigator::open,
            startCall = app.conversations,
        )
    val tutor = conversationId?.let { rememberTutor(TutorScope.Plan(goalId, it), app) }
    val rows =
        list?.let {
            val shown =
                tutor
                    ?.thread
                    ?.collectShown()
                    ?.value
                    ?.value
            val sending =
                tutor
                    ?.state
                    ?.collectAsStateWithLifecycle()
                    ?.value
                    ?.asking == true
            val unsent = shown?.turns.isNullOrEmpty() && !sending && it.conversations.none { row -> row.id == conversationId }
            BuddyConversationRows(it, openId = conversationId.takeUnless { unsent }, vm.loadingMore, vm.moreFailed)
        }
    val conversationTaps =
        BuddyConversationTaps(
            open = { vm.show(goalId, it) },
            startNew = { if (rows?.openId != null) vm.startNew(goalId) },
            showMore = { vm.showMore(goalId) },
        )

    if (tutor != null) {
        LaunchedEffect(tutor) {
            val ask = vm.takeAsk(conversationId) ?: return@LaunchedEffect
            if (tutor.draft.text.isEmpty()) tutor.draft.setTextAndPlaceCursorAtEnd(ask)
        }
    }

    PageWithSupportingPane(
        supportingPane = if (asks) ({ rows?.let { BuddyConversationsPane(it, conversationTaps) } }) else null,
    ) { beside ->
        Column(Modifier.fillMaxSize(), horizontalAlignment = Alignment.CenterHorizontally) {
            Column(Modifier.widthIn(max = BUDDY_COLUMN_WIDTH).weight(1f)) {
                BuddyHeader(
                    look,
                    face,
                    name,
                    status,
                    Modifier.padding(start = 16.dp, end = 4.dp, top = 8.dp),
                    line = { BuddyTodayLine(status, look, name, taps, dayOpen, { dayOpen = it }, navigator) },
                    menu = {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            if (asks && !beside) BuddyConversationsButton(hasConversations, onOpen = { listing = true })
                            BuddyMenu(
                                status,
                                name,
                                onEdit = { editing = true },
                                onGlasses = { wearing = true },
                                navigator,
                            )
                        }
                    },
                )
                when {
                    tutor != null -> {
                        key(conversationId) {
                            TutorPanel(tutor, access, TutorIdentity(name, look), routes, Modifier.weight(1f), page = page)
                        }
                    }

                    listRead is LoadState.Failed -> {
                        LoadFailedMessage(onRetry = { coroutines.launch { app.tutor.conversations[goalId].refresh() } })
                    }

                    else -> {
                        PageLoading()
                    }
                }
            }
        }
        // Where the pane shows the list, a sheet left open from a narrower window has ended.
        LaunchedEffect(beside) { if (beside) listing = false }
        if (listing && !beside && rows != null) BuddyConversationsSheet(rows, conversationTaps, onDismiss = { listing = false })
    }

    BuddyChanges(
        vm,
        status,
        look,
        BuddyChangesOpen(wearing, editing),
        closeGlasses = { wearing = false },
        closeEditor = { editing = false },
    )
}

/** Which of the buddy's change sheets show. */
internal data class BuddyChangesOpen(
    val glasses: Boolean,
    val editor: Boolean,
)

/** The glasses sheet and the name editor, each its own asker: a save closes or marks only the one that asked. */
@Composable
internal fun BuddyChanges(
    vm: BuddyViewModel,
    status: BuddyStatus,
    look: BuddyLook,
    open: BuddyChangesOpen,
    closeGlasses: () -> Unit,
    closeEditor: () -> Unit,
) {
    if (open.glasses) {
        VisitOf(vm.glassesSheet)
        GlassesSheet(status, look, saveFailed = vm.glassesSaveFailed, onDismiss = closeGlasses) { glasses ->
            vm.saveGlasses(look.kind, glasses, status.buddy.name)
        }
    }
    if (open.editor) {
        VisitOf(vm.editor)
        ActOn(vm.editorSaved) { closeEditor() }
        BuddyEditor(
            look = look,
            name = status.buddy.name.orEmpty(),
            isSaving = vm.isSaving,
            saveFailed = vm.editorSaveFailed,
            onClose = closeEditor,
            onSave = vm::saveEdit,
        )
    }
}

/** None until the mistakes are read, so the last one doesn't change under the learner's finger. */
@Composable
private fun suggestions(
    hasToday: Boolean,
    mistakes: LoadState<GoalMistakes>,
): List<TutorSuggestion> {
    if (mistakes is LoadState.Idle || mistakes is LoadState.Loading) return emptyList()

    val hasMistake = (mistakes.value?.total ?: 0) > 0

    return listOf(
        TutorSuggestion(stringResource(if (hasToday) R.string.tutor_suggest_plan_today else R.string.buddy_page_suggest_plan_today)),
        TutorSuggestion(stringResource(R.string.buddy_page_suggest_lighter)),
        TutorSuggestion(stringResource(if (hasMistake) R.string.buddy_page_suggest_mistake else R.string.buddy_page_suggest_focus)),
    )
}

@Composable
internal fun BuddyHeader(
    look: BuddyLook,
    face: BuddyActorState?,
    name: String,
    status: BuddyStatus,
    modifier: Modifier = Modifier,
    line: (@Composable () -> Unit)? = null,
    menu: (@Composable () -> Unit)? = null,
) {
    Row(
        modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(IDENTITY_GAP),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(Modifier.size(FACE_SIZE)) {
            if (face != null) BuddyActor(look, Modifier.size(FACE_SIZE), crop = BuddyCrop.Face, state = face) else BuddyStill(look)
        }
        NameAndLine(Modifier.weight(1f), line) {
            Text(
                name,
                Modifier.semantics { heading() },
                style = MaterialTheme.typography.titleSmall,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
        }
        menu?.invoke()
    }
}

/**
 * Main's `BuddyIdentityRow`: the day's [line] beside the name while they fit, and under it when they
 * don't, pulled back by its padding so its words start on the name's edge.
 */
@Composable
internal fun NameAndLine(
    modifier: Modifier,
    line: (@Composable () -> Unit)?,
    name: @Composable () -> Unit,
) {
    Layout(content = {
        name()
        line?.invoke()
    }, modifier = modifier) { measurables, constraints ->
        val loose = constraints.copy(minWidth = 0, minHeight = 0)
        val title = measurables[0].measure(loose)
        val gap = IDENTITY_GAP.roundToPx()
        // Beside the name only while the line fits there on one line of its own.
        val beside =
            measurables.getOrNull(1)?.let { title.width + gap + it.maxIntrinsicWidth(title.height) <= constraints.maxWidth } == true
        val day = measurables.getOrNull(1)?.measure(loose)
        when {
            day == null -> {
                layout(constraints.constrainWidth(title.width), title.height) { title.placeRelative(0, 0) }
            }

            beside -> {
                val height = maxOf(title.height, day.height)
                layout(constraints.constrainWidth(title.width + gap + day.width), height) {
                    title.placeRelative(0, (height - title.height) / 2)
                    day.placeRelative(title.width + gap, (height - day.height) / 2)
                }
            }

            else -> {
                layout(constraints.constrainWidth(maxOf(title.width, day.width)), title.height + day.height) {
                    title.placeRelative(0, 0)
                    day.placeRelative(-DAY_LINE_PADDING.roundToPx(), title.height)
                }
            }
        }
    }
}

@Composable
private fun BuddyStill(look: BuddyLook) {
    Buddy(look, Modifier.size(FACE_SIZE), crop = BuddyCrop.Face)
}

@Composable
private fun PickBuddyButton(onPick: () -> Unit) {
    OutlinedButton(onClick = onPick) {
        Icon(painterResource(R.drawable.ic_mood), contentDescription = null, Modifier.size(ButtonDefaults.IconSize))
        Text(stringResource(R.string.buddy_page_choose), Modifier.padding(start = ButtonDefaults.IconSpacing))
    }
}

@Composable
private fun BuddyMenu(
    status: BuddyStatus,
    name: String,
    onEdit: () -> Unit,
    onGlasses: () -> Unit,
    navigator: AppNavigator,
) {
    var open by rememberSaveable { mutableStateOf(false) }
    val more = stringResource(R.string.buddy_page_more, name)

    Box {
        MoreButton(onClick = { open = true }, contentDescription = more, quiet = true)
        DropdownMenu(expanded = open, onDismissRequest = { open = false }) {
            DropdownMenuItem(
                text = {
                    Text(
                        if (status.buddy.picked) {
                            stringResource(
                                R.string.buddy_page_change,
                                name,
                            )
                        } else {
                            stringResource(R.string.buddy_page_choose)
                        },
                    )
                },
                onClick = {
                    open = false
                    onEdit()
                },
                leadingIcon = {
                    Icon(
                        painterResource(if (status.buddy.picked) R.drawable.ic_edit else R.drawable.ic_mood),
                        contentDescription = null,
                    )
                },
            )
            DropdownMenuItem(
                text = { Text(stringResource(R.string.buddy_glasses)) },
                onClick = {
                    open = false
                    onGlasses()
                },
                leadingIcon = { Icon(painterResource(R.drawable.ic_eyeglasses), contentDescription = null) },
                trailingIcon = { GlassesCount(status) },
            )
            DropdownMenuItem(
                text = { Text(stringResource(R.string.buddy_page_remembers, name)) },
                onClick = {
                    open = false
                    navigator.open(AppRoute.Memory)
                },
                leadingIcon = { Icon(painterResource(R.drawable.ic_psychology), contentDescription = null) },
            )
            HorizontalDivider()
            DropdownMenuItem(
                text = { Text(stringResource(R.string.buddy_page_weekly_summary)) },
                onClick = {
                    open = false
                    navigator.open(AppRoute.Logbook)
                },
                leadingIcon = { Icon(painterResource(R.drawable.ic_event_note), contentDescription = null) },
            )
        }
    }
}

@Composable
internal fun GlassesCount(status: BuddyStatus) {
    val earned = status.glasses.count { it.earned }.toString()
    val total = status.glasses.size.toString()
    val spoken = stringResource(R.string.buddy_page_count, earned, total)

    Text(
        "$earned/$total",
        Modifier.semantics { contentDescription = spoken },
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        style = MaterialTheme.typography.labelMedium,
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun GlassesSheet(
    status: BuddyStatus,
    look: BuddyLook,
    saveFailed: Boolean,
    onDismiss: () -> Unit,
    onWear: (BuddyGlasses) -> Unit,
) {
    val earned =
        status.glasses
            .filter { it.earned }
            .map { BuddyGlasses.of(it.glasses.value) }
            .toSet()

    ModalBottomSheet(onDismissRequest = onDismiss, sheetState = rememberExpandedBottomSheetState()) {
        Column(
            Modifier.padding(horizontal = 24.dp).padding(bottom = 24.dp).navigationBarsPadding(),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Text(stringResource(R.string.buddy_glasses), Modifier.semantics { heading() }, style = MaterialTheme.typography.titleLarge)
            Text(
                stringResource(R.string.buddy_page_glasses_description),
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                style = MaterialTheme.typography.bodyMedium,
            )
            if (saveFailed) SaveFailed()
            BuddyGlassesPicker(look = look, earned = earned, selected = look.glasses, onSelect = onWear)
        }
    }
}

@Composable
private fun SaveFailed() {
    Text(
        stringResource(R.string.buddy_page_save_failed),
        Modifier.semantics { liveRegion = LiveRegionMode.Polite },
        color = MaterialTheme.colorScheme.error,
        style = MaterialTheme.typography.bodyMedium,
    )
}

private val FACE_SIZE = 32.dp

/** Main's `gap-2.5` in its identity row: face to name, and name to the day's line. */
private val IDENTITY_GAP = 10.dp
internal val BUDDY_COLUMN_WIDTH = 720.dp
