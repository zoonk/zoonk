package com.zoonk.android.feature.buddy

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
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
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.IconButtonDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.layout.WindowInsetsRulers
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.zoonk.android.R
import com.zoonk.android.app.AppContainer
import com.zoonk.android.data.LoadState
import com.zoonk.android.data.collectShown
import com.zoonk.android.data.value
import com.zoonk.android.feature.session.MissionOpens
import com.zoonk.android.feature.settings.BuddyEditor
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
import com.zoonk.android.ui.characters.Buddy
import com.zoonk.android.ui.characters.BuddyAct
import com.zoonk.android.ui.characters.BuddyActor
import com.zoonk.android.ui.characters.BuddyActorState
import com.zoonk.android.ui.characters.BuddyEnergyState
import com.zoonk.android.ui.characters.BuddyGlasses
import com.zoonk.android.ui.characters.BuddyGlassesPicker
import com.zoonk.android.ui.characters.BuddyLook
import com.zoonk.android.ui.characters.buddyName
import com.zoonk.android.ui.characters.buddyStageName
import com.zoonk.android.ui.characters.rememberBuddyActorState
import com.zoonk.android.ui.components.LoadFailedMessage
import com.zoonk.android.ui.components.OutlinedButton
import com.zoonk.android.ui.scaffold.PageWithSupportingPane
import com.zoonk.android.ui.scaffold.TabRootScaffold
import com.zoonk.api.models.BuddyStatus
import com.zoonk.api.models.LearnerSummary
import com.zoonk.api.models.LearnerSummaryGoal
import kotlinx.coroutines.launch
import java.util.UUID

/** `/buddy`: the buddy and its day beside the goal's conversation, or its offer to start a goal. */
@Composable
fun BuddyScreen(
    route: AppRoute.Buddy,
    app: AppContainer,
    navigator: AppNavigator,
) {
    val status by app.buddy.status.collectShown()
    val summary by app.learnerSummary.summary.collectShown()
    val coroutines = rememberCoroutineScope()

    TabRootScaffold(app, navigator) { padding ->
        // The keyboard covers the navigation bar, which imePadding() would leave as a gap above it.
        Box(Modifier.fillMaxSize().padding(padding).fitInside(WindowInsetsRulers.Ime.current)) {
            val read = status
            val learner = summary.value
            when {
                read is LoadState.Loaded && learner != null -> {
                    val goalId = learner.tutoredGoalId
                    if (goalId == null) {
                        BuddyGoalStart(read.value, route.ask, app, navigator)
                    } else {
                        BuddyPage(read.value, goalId, route.ask, app, navigator)
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
                    CircularProgressIndicator(Modifier.align(Alignment.Center))
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

@Composable
internal fun BuddyPage(
    status: BuddyStatus,
    goalId: String,
    ask: String?,
    app: AppContainer,
    navigator: AppNavigator,
    access: TutorAccess = rememberTutorAccess(app),
) {
    val vm = viewModel { BuddyViewModel(app.buddy, app.learningProfile, app.today, app.studyOpener) }
    val look = status.look()
    val name = buddyName(look.kind, status.buddy.name)
    val face = rememberBuddyActorState()
    val tutor = rememberTutor(TutorScope.Plan(goalId), app)
    val mistakes by remember(goalId) { app.today.mistakes[UUID.fromString(goalId)] }.collectShown()
    var editing by rememberSaveable { mutableStateOf(false) }
    var wearing by rememberSaveable { mutableStateOf(false) }
    val coroutines = rememberCoroutineScope()
    // Only while awake: asleep it naps on, and glowing it's already beaming.
    val react: (BuddyAct) -> Unit = { act -> if (look.energyState == BuddyEnergyState.Awake) coroutines.launch { face.play(act) } }
    val composer = remember { FocusRequester() }
    val keyboard = LocalSoftwareKeyboardController.current
    var asking by remember { mutableStateOf(false) }
    // Asking the buddy happens in this page's own composer, so its mission puts the cursor there.
    val onMission: (MissionOpens) -> Unit = { opens -> if (opens == MissionOpens.Buddy) asking = true else vm.openMission(opens, goalId) }
    val hasMistake = mistakes.value?.let { it.ready + it.tomorrow > 0 } == true
    val earlier by app.earlierQuestions.questions.collectShown()

    LaunchedEffect(vm) { vm.routes.collect(navigator::open) }
    LaunchedEffect(asking) {
        if (!asking) return@LaunchedEffect
        composer.requestFocus()
        keyboard?.show()
        asking = false
    }
    LaunchedEffect(ask) { if (ask != null && tutor.draft.text.isEmpty()) tutor.draft.setTextAndPlaceCursorAtEnd(ask) }

    val page =
        TutorPage(
            greeting = stringResource(R.string.buddy_page_greeting, name),
            suggestions = suggestions(hasToday = status.today != null, hasMistake = hasMistake),
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
            seePlus = { navigator.open(AppRoute.Subscription) },
            open = navigator::open,
            startCall = app.conversations::start,
        )

    PageWithSupportingPane(
        supportingPane = { BuddyDayPane(status, look, name, onMission, onGlasses = { wearing = true }, navigator, app) },
    ) { beside ->
        Column(Modifier.fillMaxSize(), horizontalAlignment = Alignment.CenterHorizontally) {
            Column(Modifier.widthIn(max = BUDDY_COLUMN_WIDTH).weight(1f)) {
                BuddyHeader(
                    look,
                    face,
                    name,
                    status,
                    Modifier.padding(start = 16.dp, end = 4.dp, top = 8.dp),
                    line = if (beside) null else ({ BuddyTodayLine(status, look, name, onMission, navigator) }),
                    menu = {
                        BuddyMenu(
                            status,
                            name,
                            hasEarlier = earlier.value != null,
                            onEdit = { editing = true },
                            onGlasses = { wearing = true },
                            navigator,
                        )
                    },
                )
                if (vm.saveFailed && !editing) SaveFailed(Modifier.padding(horizontal = 16.dp))
                if (vm.openFailed) OpenFailed(Modifier.padding(horizontal = 16.dp))
                TutorPanel(tutor, access, TutorIdentity(name, look), routes, Modifier.weight(1f), page = page)
            }
        }
    }

    if (wearing) {
        GlassesSheet(status, look, saveFailed = vm.saveFailed, onDismiss = { wearing = false }) { glasses ->
            vm.save(look.kind, glasses, status.buddy.name)
        }
    }
    if (editing) {
        BuddyEditor(
            look = look,
            name = status.buddy.name.orEmpty(),
            isSaving = vm.isSaving,
            saveFailed = vm.saveFailed,
            onClose = {
                editing = false
                vm.dismissSaveFailure()
            },
            onSave = { kind, glasses, typed -> vm.save(kind, glasses, typed) { editing = false } },
        )
    }
}

@Composable
private fun suggestions(
    hasToday: Boolean,
    hasMistake: Boolean,
): List<TutorSuggestion> =
    listOf(
        TutorSuggestion(stringResource(if (hasToday) R.string.tutor_suggest_plan_today else R.string.buddy_page_suggest_plan_today)),
        TutorSuggestion(stringResource(R.string.buddy_page_suggest_lighter)),
        TutorSuggestion(stringResource(if (hasMistake) R.string.buddy_page_suggest_mistake else R.string.buddy_page_suggest_focus)),
    )

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
    Row(modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
        Box(Modifier.size(FACE_SIZE)) {
            if (face != null) BuddyActor(look, Modifier.size(FACE_SIZE), state = face) else BuddyStill(look)
        }
        // With large text the day's line moves under the name instead of squeezing it.
        FlowRow(
            Modifier.weight(1f),
            horizontalArrangement = Arrangement.SpaceBetween,
            itemVerticalAlignment = Alignment.CenterVertically,
        ) {
            Column {
                Text(name, Modifier.semantics { heading() }, style = MaterialTheme.typography.titleMedium)
                Text(
                    stringResource(R.string.buddy_page_line, buddyStageName(look.stage)),
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    style = MaterialTheme.typography.bodySmall,
                )
            }
            line?.invoke()
        }
        menu?.invoke()
    }
}

@Composable
private fun BuddyStill(look: BuddyLook) {
    Buddy(look, Modifier.size(FACE_SIZE))
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
    hasEarlier: Boolean,
    onEdit: () -> Unit,
    onGlasses: () -> Unit,
    navigator: AppNavigator,
) {
    var open by remember { mutableStateOf(false) }
    val more = stringResource(R.string.buddy_page_more, name)

    Box {
        IconButton(onClick = {
            open = true
        }, colors = IconButtonDefaults.iconButtonColors(contentColor = MaterialTheme.colorScheme.onSurfaceVariant)) {
            Icon(painterResource(R.drawable.ic_more_vert), contentDescription = more)
        }
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
            HorizontalDivider()
            DropdownMenuItem(
                text = { Text(stringResource(R.string.buddy_page_weekly_summary)) },
                onClick = {
                    open = false
                    navigator.open(AppRoute.Logbook)
                },
                leadingIcon = { Icon(painterResource(R.drawable.ic_event_note), contentDescription = null) },
            )
            if (hasEarlier) {
                DropdownMenuItem(
                    text = { Text(stringResource(R.string.buddy_page_earlier_questions)) },
                    onClick = {
                        open = false
                        navigator.open(AppRoute.EarlierQuestions)
                    },
                    leadingIcon = { Icon(painterResource(R.drawable.ic_history), contentDescription = null) },
                )
            }
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
private fun GlassesSheet(
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

    ModalBottomSheet(onDismissRequest = onDismiss, sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)) {
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
private fun SaveFailed(modifier: Modifier = Modifier) {
    Text(
        stringResource(R.string.buddy_page_save_failed),
        modifier.semantics { liveRegion = LiveRegionMode.Polite },
        color = MaterialTheme.colorScheme.error,
        style = MaterialTheme.typography.bodyMedium,
    )
}

@Composable
private fun OpenFailed(modifier: Modifier = Modifier) {
    Text(
        stringResource(R.string.buddy_page_open_failed),
        modifier.semantics { liveRegion = LiveRegionMode.Polite },
        color = MaterialTheme.colorScheme.error,
        style = MaterialTheme.typography.bodyMedium,
    )
}

private val FACE_SIZE = 32.dp
internal val BUDDY_COLUMN_WIDTH = 720.dp
