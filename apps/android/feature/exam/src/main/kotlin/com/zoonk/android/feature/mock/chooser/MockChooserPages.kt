package com.zoonk.android.feature.mock.chooser

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyListScope
import androidx.compose.foundation.lazy.LazyListState
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.input.key.KeyEvent
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.input.key.key
import androidx.compose.ui.input.key.onKeyEvent
import androidx.compose.ui.input.key.onPreviewKeyEvent
import androidx.compose.ui.input.key.type
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.zoonk.android.R
import com.zoonk.android.data.AnalyticsEvent
import com.zoonk.android.data.TrackShown
import com.zoonk.android.feature.mock.MockPreparingNote
import com.zoonk.android.feature.mock.MockSummaryRow
import com.zoonk.android.feature.plan.WhileShown
import com.zoonk.android.feature.subscription.GateWords
import com.zoonk.android.feature.writing.choiceLine
import com.zoonk.android.feature.writing.gradingReturnsLine
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.navigation.AppTab
import com.zoonk.android.ui.components.Button
import com.zoonk.android.ui.components.PageHeader
import com.zoonk.android.ui.components.SectionHeader
import com.zoonk.android.ui.components.TaskActions
import com.zoonk.android.ui.components.controlInk
import com.zoonk.android.ui.scaffold.BottomBar
import com.zoonk.android.ui.scaffold.DetailPage
import com.zoonk.android.ui.scaffold.rememberBarNoteRoom
import com.zoonk.android.ui.theme.balanced
import com.zoonk.android.ui.theme.zoonkType
import com.zoonk.api.models.MockOption
import com.zoonk.api.models.MockOptionSectionsInner
import com.zoonk.api.models.MockOptions
import com.zoonk.api.models.MockOptionsRequested
import kotlinx.coroutines.delay
import kotlin.time.Duration.Companion.seconds

@Composable
internal fun PracticeChooser(
    view: MockOptions,
    viewModel: MockChooserViewModel,
    navigator: AppNavigator,
    listState: LazyListState,
    replacementFocus: FocusRequester? = null,
    onStart: () -> Unit = {},
    readAgain: suspend () -> Unit = {},
) {
    val busy by viewModel.busy.collectAsStateWithLifecycle()
    val refusal by viewModel.refusal.collectAsStateWithLifecycle()
    val failed by viewModel.failed.collectAsStateWithLifecycle()
    // Nothing is picked as the page opens, so a first tap on Start can't begin an hours-long exam.
    var picked by rememberSaveable { mutableStateOf<String?>(null) }
    val options = view.options.filterNot { it.kind == MockOption.Kind.UNKNOWN_DEFAULT_OPEN_API }
    val option = options.firstOrNull { it.key == picked }
    val severalDays = options.count { it.kind == MockOption.Kind.FULL } > 1
    val open = view.access == MockOptions.Access.OPEN
    // An exam of several tests lists each test and all of them first, then the shorter, objective-only options.
    val tests = if (severalDays) 0 else examTests(options)
    val leads = { it: MockOption ->
        if (tests > 1) it.kind != MockOption.Kind.HALF && it.kind != MockOption.Kind.AREA else it.kind != MockOption.Kind.AREA
    }
    val examChoices = practiceChoices(options.filter(leads), severalDays, tests, refusal = refusal)
    val subjectChoices = practiceChoices(options.filterNot(leads), severalDays, tests, objectiveTitled = tests > 1, refusal = refusal)
    val blocked = option?.hasWrittenTest() == true && refusal is MockStartOutcome.GradesUsed
    val pickedChoice = option?.let { pendingChoice(it, refusal) }
    val examTitle =
        if (tests >
            1
        ) {
            pluralStringResource(R.plurals.mock_chooser_exam_tests, tests, tests)
        } else {
            stringResource(R.string.mock_chooser_the_exam)
        }
    val restTitle = stringResource(if (tests > 1) R.string.mock_chooser_objective_only else R.string.mock_chooser_one_subject)
    val signUp = refusal == MockStartOutcome.SignUpRequired
    val preparing =
        !blocked && pickedChoice == null && !signUp &&
            view.requested?.let { it.status == MockOptionsRequested.Status.PREPARING && it.shape == option?.shape } == true
    WhileShown(preparing) {
        while (true) {
            delay(READ_AGAIN)
            readAgain()
        }
    }

    // The bar's button becomes Subscribe once a Start met the lock, until a purchase opens the mocks.
    val triedLocked by viewModel.triedLocked.collectAsStateWithLifecycle()
    val gated = triedLocked && !open
    val mainAction = {
        when {
            gated -> {
                navigator.open(AppRoute.Subscription)
            }

            signUp -> {
                navigator.open(AppRoute.Login)
            }

            pickedChoice != null || preparing -> {
                navigator.showRoot(AppTab.Today)
            }

            option != null && !busy && !blocked -> {
                onStart()
                if (open) viewModel.start(option.shape) else viewModel.tryLocked()
            }
        }
    }
    val action: @Composable (Modifier) -> Unit = { modifier ->
        when {
            gated -> {
                Button(onClick = mainAction, modifier = modifier.focus(replacementFocus)) {
                    Text(stringResource(R.string.subscription_subscribe))
                }
            }

            signUp -> {
                Button(onClick = mainAction, modifier = modifier.focus(replacementFocus)) {
                    Text(stringResource(R.string.limit_create_account))
                }
            }

            pickedChoice != null -> {
                Button(onClick = mainAction, modifier = modifier.focus(replacementFocus)) {
                    Text(stringResource(R.string.essay_choose_on_today))
                }
            }

            preparing -> {
                Button(onClick = mainAction, modifier = modifier.focus(replacementFocus)) {
                    Text(stringResource(R.string.mock_preparing_keep_studying))
                }
            }

            else -> {
                Button(
                    busy = busy,
                    onClick = mainAction,
                    modifier = modifier.focus(replacementFocus),
                    enabled = option != null && !blocked,
                ) { Text(stringResource(R.string.mock_chooser_start)) }
            }
        }
    }

    ChooserPage(
        listState = listState,
        onEnter = mainAction,
        note =
            when {
                gated -> ({ MockGate() })

                signUp -> ({ GateWords(title = stringResource(R.string.limit_sign_up_required), line = null) })

                preparing -> (
                    {
                        key(picked) {
                            MockPreparingNote(
                                stringResource(R.string.mock_preparing_chooser_title),
                                viewModel.goalId.toString(),
                                "mockChooser",
                                viewModel.paperWait,
                                readAgain,
                            )
                        }
                    }
                )

                failed -> ({ StartFailed() })

                else -> null
            },
        bar = { TaskActions { main -> action(main) } },
        aside =
            view.lastMock?.let { last ->
                {
                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        SectionHeader(stringResource(R.string.mock_chooser_last_mock))
                        MockSummaryRow(
                            last,
                            onOpen = last.blockId?.let { { navigator.open(AppRoute.Mock(it.toString())) } },
                            stacked = true,
                        )
                    }
                }
            },
    ) { asideBeside ->
        item(key = "hero", contentType = "hero") {
            PageHeader(stringResource(R.string.mock_chooser_title), supporting = stringResource(R.string.mock_chooser_line))
        }
        // One pick across both lists, as on main: the subjects are a titled group of the same choice.
        item(key = "choices", contentType = "choices") {
            Column(verticalArrangement = Arrangement.spacedBy(24.dp)) {
                Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    if (subjectChoices.isNotEmpty() || tests > 1) SectionHeader(examTitle)
                    ChoiceRows(examChoices, picked, onEnter = mainAction) { picked = it }
                }
                if (subjectChoices.isNotEmpty()) {
                    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        SectionHeader(restTitle)
                        ChoiceRows(subjectChoices, picked, onEnter = mainAction) { picked = it }
                    }
                }
            }
        }
    }
}

/**
 * The page's column, with the picked mock beside it where there's room, as main's aside, over the
 * bottom bar that holds Start at every width, with what the last Start found as its [note].
 */
@Composable
private fun ChooserPage(
    listState: LazyListState,
    onEnter: () -> Unit,
    note: (@Composable () -> Unit)?,
    bar: @Composable ColumnScope.() -> Unit,
    aside: (@Composable ColumnScope.() -> Unit)?,
    content: LazyListScope.(asideBeside: Boolean) -> Unit,
) {
    // Main's screen Enter: a focused control that acts (the last mock, the bar's button, a notice's
    // action) keeps its own, and only an Enter none of them took starts; the picks hand theirs over.
    val noteRoom = rememberBarNoteRoom(listState)
    Column(Modifier.onKeyEvent { event -> enterTakes(event, onEnter) }) {
        DetailPage(
            aside = aside,
            asideLabel = stringResource(R.string.mock_chooser_last_mock),
            modifier = Modifier.weight(1f),
            listState = listState,
            noteRoom = noteRoom,
            content = content,
        )
        BottomBar(note = note, noteRoom = noteRoom, content = bar)
    }
}

/** The gate a free learner meets on Start, over the bar that now says Subscribe. */
@Composable
private fun MockGate() {
    TrackShown(AnalyticsEvent.SubscriptionGateShown)
    GateWords(title = stringResource(R.string.challenge_mock_gate), line = null)
}

/** Why the last Start failed, over the bar where Start was pressed (the bar's note reads it out). */
@Composable
private fun StartFailed() {
    Text(
        stringResource(R.string.mock_chooser_failed),
        color = MaterialTheme.colorScheme.error,
        style = MaterialTheme.typography.bodyMedium,
    )
}

private fun MockOption.hasWrittenTest(): Boolean =
    kind == MockOption.Kind.WRITTEN || written.isNotEmpty() || sections.orEmpty().any { it.kind == MockOptionSectionsInner.Kind.WRITTEN }

private fun pendingChoice(
    option: MockOption,
    refusal: MockStartOutcome?,
): List<String>? =
    option.availability?.choiceGroups
        ?: option.sections.orEmpty().firstNotNullOfOrNull { it.availability?.choiceGroups }
        ?: (refusal as? MockStartOutcome.NeedsChoice)?.choiceGroups?.takeIf { option.hasWrittenTest() }

@Composable
private fun rowLimit(
    option: MockOption,
    refusal: MockStartOutcome?,
): String? {
    val groups = pendingChoice(option, refusal)
    val used = refusal as? MockStartOutcome.GradesUsed
    return when {
        groups != null -> choiceLine(groups)
        used != null && option.hasWrittenTest() -> gradingReturnsLine(used.returnsOn)
        else -> null
    }
}

/** Enter runs [action] once per press, as main's screen keys do, and is spent whether held or not. */
private fun enterTakes(
    event: KeyEvent,
    action: () -> Unit,
): Boolean {
    if (event.key != Key.Enter && event.key != Key.NumPadEnter) return false
    if (event.type == KeyEventType.KeyDown && event.nativeKeyEvent.repeatCount == 0) action()
    return true
}

private fun Modifier.focus(requester: FocusRequester?): Modifier = requester?.let { focusRequester(it) } ?: this

internal data class RowChoice(
    val key: String,
    val label: String,
    val description: String?,
    val trailing: String,
    /** Why the choice can't be taken now, under its description. */
    val note: String? = null,
)

@Composable
private fun practiceChoices(
    options: List<MockOption>,
    severalDays: Boolean,
    tests: Int,
    /** The group's title already says its options hold objective questions only. */
    objectiveTitled: Boolean = false,
    refusal: MockStartOutcome?,
): List<RowChoice> =
    options.map {
        RowChoice(
            key = it.key,
            label = mockOptionName(it, severalDays, tests),
            description = if (objectiveTitled) null else mockOptionDetail(it, severalDays),
            trailing = mockOptionSize(it),
            note = rowLimit(it, refusal),
        )
    }

/** Main's `ChoiceRows`: one pick of a few, its size at the end, or under its words where the row is narrow. */
@Composable
private fun ChoiceRows(
    choices: List<RowChoice>,
    picked: String?,
    onEnter: () -> Unit,
    onPick: (String) -> Unit,
) {
    BoxWithConstraints {
        val stacked = maxWidth < STACK_BELOW
        // A pick is a radio, which main lets Enter pass to the screen's Start; the arrows move it.
        Column(Modifier.selectableGroup().onPreviewKeyEvent { event -> enterTakes(event, onEnter) }) {
            choices.forEachIndexed { index, choice ->
                if (index > 0) HorizontalDivider()
                ChoiceRow(choice, selected = choice.key == picked, stacked = stacked) { onPick(choice.key) }
            }
        }
    }
}

@Composable
private fun ChoiceRow(
    choice: RowChoice,
    selected: Boolean,
    stacked: Boolean,
    onClick: () -> Unit,
) {
    val labelStyle = MaterialTheme.typography.bodyLarge.balanced()
    // A one-line choice sits in the middle of its row's height; a longer one starts at the top.
    Box(
        Modifier
            .fillMaxWidth()
            .heightIn(min = 64.dp)
            .onFocusChanged { if (it.isFocused && !selected) onClick() }
            .selectable(selected = selected, role = Role.RadioButton, onClick = onClick)
            .padding(vertical = 12.dp),
        contentAlignment = Alignment.CenterStart,
    ) {
        ChoiceRowContent(choice, selected, stacked, labelStyle)
    }
}

@Composable
private fun ChoiceRowContent(
    choice: RowChoice,
    selected: Boolean,
    stacked: Boolean,
    labelStyle: TextStyle,
) {
    Row(
        Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(16.dp),
        verticalAlignment = Alignment.Top,
    ) {
        Column(Modifier.weight(1f).alignByBaseline(), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(choice.label, style = labelStyle)
            choice.description?.let {
                Text(
                    it,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    style = MaterialTheme.typography.bodyMedium,
                )
            }
            choice.note?.let {
                Text(
                    it,
                    Modifier.semantics { liveRegion = LiveRegionMode.Polite },
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    style = MaterialTheme.typography.bodyMedium,
                )
            }
            if (stacked) ChoiceSize(choice, MaterialTheme.typography.bodySmall)
        }
        if (!stacked) ChoiceSize(choice, MaterialTheme.typography.labelMedium, Modifier.alignByBaseline())
        // The radio stands at the row's end, beside the label's first line however many lines follow.
        Box(Modifier.height(with(LocalDensity.current) { labelStyle.lineHeight.toDp() }), contentAlignment = Alignment.Center) {
            RadioButton(selected = selected, onClick = null, modifier = Modifier.controlInk())
        }
    }
}

@Composable
private fun ChoiceSize(
    choice: RowChoice,
    style: TextStyle,
    modifier: Modifier = Modifier,
) {
    Text(
        choice.trailing,
        modifier = modifier,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        style = MaterialTheme.zoonkType.data.copy(fontSize = style.fontSize, lineHeight = style.lineHeight),
    )
}

private val STACK_BELOW = 480.dp

private val READ_AGAIN = 15.seconds
