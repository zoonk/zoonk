package com.zoonk.android.feature.mock.chooser

import androidx.compose.foundation.focusable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyListScope
import androidx.compose.foundation.lazy.LazyListState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.input.key.key
import androidx.compose.ui.input.key.onPreviewKeyEvent
import androidx.compose.ui.input.key.type
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.style.LineBreak
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.zoonk.android.R
import com.zoonk.android.data.AnalyticsEvent
import com.zoonk.android.data.GenerationKind
import com.zoonk.android.data.GenerationRun
import com.zoonk.android.data.TrackShown
import com.zoonk.android.feature.mock.MockSummaryRow
import com.zoonk.android.feature.subscription.GateWords
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.ui.components.AlertDialog
import com.zoonk.android.ui.components.Button
import com.zoonk.android.ui.components.GenerationWait
import com.zoonk.android.ui.components.LimitNotice
import com.zoonk.android.ui.components.LimitSubject
import com.zoonk.android.ui.components.PageHeader
import com.zoonk.android.ui.components.SectionHeader
import com.zoonk.android.ui.components.SectionLabel
import com.zoonk.android.ui.components.TextButton
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatNumber
import com.zoonk.android.ui.scaffold.BeforeFold
import com.zoonk.android.ui.scaffold.BottomBar
import com.zoonk.android.ui.scaffold.DETAIL_PAGE_WIDTH
import com.zoonk.android.ui.scaffold.DetailPage
import com.zoonk.android.ui.scaffold.pagePadding
import com.zoonk.android.ui.theme.withTabularFigures
import com.zoonk.api.models.AnytimeMock
import com.zoonk.api.models.MockOption
import com.zoonk.api.models.MockOptions

@Composable
internal fun PracticeChooser(
    view: MockOptions,
    viewModel: MockChooserViewModel,
    navigator: AppNavigator,
    listState: LazyListState,
    replacementFocus: FocusRequester? = null,
    onStart: () -> Unit = {},
) {
    val status by viewModel.status.collectAsStateWithLifecycle()
    val busy by viewModel.busy.collectAsStateWithLifecycle()
    // Nothing is picked as the page opens, so a first tap on Start can't begin an hours-long exam.
    var picked by rememberSaveable { mutableStateOf<String?>(null) }
    val option = view.options.firstOrNull { it.key == picked }
    val severalDays = view.options.count { it.kind == MockOption.Kind.FULL } > 1
    val open = view.access == MockOptions.Access.OPEN
    val short = status as? ChooserStatus.Short
    val shown = status.takeUnless { it is ChooserStatus.Short } ?: ChooserStatus.Choosing
    val examChoices = practiceChoices(view.options.filter { it.kind != MockOption.Kind.AREA }, severalDays)
    val subjectChoices = practiceChoices(view.options.filter { it.kind == MockOption.Kind.AREA }, severalDays)

    // The bar's button becomes Subscribe once a Start met the lock, until a purchase opens the mocks.
    val triedLocked by viewModel.triedLocked.collectAsStateWithLifecycle()
    val refusedOn by viewModel.refusedOn.collectAsStateWithLifecycle()
    val gated = triedLocked && (!open || refusedOn === view)
    val mainAction = {
        if (gated) {
            viewModel.leftForSubscription()
            navigator.open(AppRoute.Subscription)
        } else if (option != null && !busy) {
            onStart()
            if (open) viewModel.start(option.shape, option.key, view) else viewModel.tryLocked()
        }
    }
    val action: @Composable (Modifier) -> Unit = { modifier ->
        if (gated) {
            Button(onClick = mainAction, modifier = modifier.focus(replacementFocus)) {
                Text(stringResource(R.string.subscription_subscribe))
            }
        } else {
            Button(
                busy = busy,
                onClick = mainAction,
                modifier = modifier.focus(replacementFocus),
                enabled = option != null,
            ) { Text(stringResource(R.string.mock_chooser_start)) }
        }
    }

    ChooserPage(
        listState = listState,
        onEnter = mainAction,
        note =
            when {
                gated -> ({ MockGate() })
                shown is ChooserStatus.Refused -> ({ Refusal(shown, navigator) })
                shown is ChooserStatus.Failed -> ({ StartFailed(shown) })
                else -> null
            },
        bar = { action(Modifier.fillMaxWidth()) },
        aside = {
            // What a pick shows comes last, so picking moves nothing above it.
            view.lastMock?.let { last ->
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    SectionHeader(stringResource(R.string.mock_chooser_last_mock))
                    MockSummaryRow(last, onOpen = last.blockId?.let { { navigator.open(AppRoute.Mock(it.toString())) } }, stacked = true)
                }
            }
            option?.let {
                PickedMock(
                    title = mockOptionName(it, severalDays),
                    size = PickedSize(it.questions, it.minutes, it.estimatedMinutes),
                    namesTitle = stringResource(if (it.covers != null) R.string.mock_chooser_parts else R.string.mock_chooser_subjects),
                    names = it.covers ?: it.areas,
                    written = it.written,
                )
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
                    if (subjectChoices.isNotEmpty()) SectionHeader(stringResource(R.string.mock_chooser_the_exam))
                    ChoiceRows(examChoices, picked) { picked = it }
                }
                if (subjectChoices.isNotEmpty()) {
                    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        SectionHeader(stringResource(R.string.mock_chooser_one_subject))
                        ChoiceRows(subjectChoices, picked) { picked = it }
                    }
                }
            }
        }
    }

    short?.let { ShortDialog(it.outcome, onStart = viewModel::startShort, onPickAnother = viewModel::stayChoosing) }
}

/** A mock exam shorter than the one picked never starts unannounced: the learner agrees first. */
@Composable
private fun ShortDialog(
    short: MockStartOutcome.Short,
    onStart: () -> Unit,
    onPickAnother: () -> Unit,
) {
    val locale = currentLocale()
    val count = formatNumber(short.questions.toDouble(), locale)
    val total = formatNumber(short.examQuestions.toDouble(), locale)
    val time = minutesText(short.minutes)
    AlertDialog(
        onDismissRequest = onPickAnother,
        title = { Text(stringResource(R.string.mock_chooser_short_title)) },
        text = {
            Text(
                stringResource(
                    when (short.limit) {
                        AnytimeMock.Limit.DAY -> R.string.mock_chooser_short_day
                        AnytimeMock.Limit.MONTH -> R.string.mock_chooser_short_month
                        AnytimeMock.Limit.TOTAL, null -> R.string.mock_chooser_short_line
                    },
                    count,
                    total,
                    time,
                ),
            )
        },
        confirmButton = { TextButton(onClick = onStart) { Text(stringResource(R.string.mock_chooser_start)) } },
        dismissButton = { TextButton(onClick = onPickAnother) { Text(stringResource(R.string.mock_chooser_pick_another)) } },
    )
}

/** Main's `MockWriting`: the questions being written, after which the mock opens by itself. */
@Composable
internal fun MockWriting(
    run: GenerationRun,
    onRetry: () -> Unit,
    titleFocus: FocusRequester? = null,
) {
    BeforeFold { beforeFold ->
        Box(beforeFold.fillMaxSize().verticalScroll(rememberScrollState()), contentAlignment = Alignment.TopStart) {
            GenerationWait(
                kind = GenerationKind.MockQuestions,
                run = run,
                onRetry = onRetry,
                modifier = Modifier.widthIn(max = DETAIL_PAGE_WIDTH).padding(pagePadding()),
            ) {
                Text(
                    stringResource(R.string.mock_chooser_preparing),
                    (titleFocus?.let { Modifier.focusRequester(it).focusable() } ?: Modifier).semantics { heading() },
                    style = MaterialTheme.typography.headlineSmall,
                )
                Text(
                    stringResource(R.string.mock_chooser_preparing_detail),
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    style = MaterialTheme.typography.bodyLarge,
                )
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
    aside: @Composable ColumnScope.() -> Unit,
    content: LazyListScope.(asideBeside: Boolean) -> Unit,
) {
    Column(
        // Enter takes the page's main action, as main's Start does; the arrows move the pick.
        Modifier.onPreviewKeyEvent { event ->
            val enter = event.key == Key.Enter || event.key == Key.NumPadEnter
            if (enter && event.type == KeyEventType.KeyDown) onEnter()
            enter
        },
    ) {
        DetailPage(
            aside = aside,
            asideLabel = stringResource(R.string.mock_chooser_picked),
            modifier = Modifier.weight(1f),
            listState = listState,
            content = content,
        )
        BottomBar(note = note, content = bar)
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
private fun StartFailed(failed: ChooserStatus.Failed) {
    Text(
        stringResource(if (failed.notEnoughQuestions) R.string.mock_chooser_not_enough else R.string.mock_chooser_failed),
        color = MaterialTheme.colorScheme.error,
        style = MaterialTheme.typography.bodyMedium,
    )
}

private fun Modifier.focus(requester: FocusRequester?): Modifier = requester?.let { focusRequester(it) } ?: this

/** Fair use for new questions ran out: main's help limit notice with its way on. */
@Composable
private fun Refusal(
    status: ChooserStatus.Refused,
    navigator: AppNavigator,
) {
    LimitNotice(
        limit = status.limit,
        subject = LimitSubject.Help,
        onCreateAccount = { navigator.open(AppRoute.Login) },
        onSubscribe = { navigator.open(AppRoute.Subscription) },
        modifier = Modifier.semantics { liveRegion = LiveRegionMode.Polite },
    )
}

internal data class RowChoice(
    val key: String,
    val label: String,
    val description: String?,
    val trailing: String,
)

@Composable
private fun practiceChoices(
    options: List<MockOption>,
    severalDays: Boolean,
): List<RowChoice> =
    options.map {
        RowChoice(
            key = it.key,
            label = mockOptionName(it, severalDays),
            description = mockOptionDetail(it, severalDays),
            trailing = mockOptionSize(it),
        )
    }

/** Main's `ChoiceRows`: one pick of a few, its size at the end, or under its words where the row is narrow. */
@Composable
private fun ChoiceRows(
    choices: List<RowChoice>,
    picked: String?,
    onPick: (String) -> Unit,
) {
    BoxWithConstraints {
        val stacked = maxWidth < STACK_BELOW
        Column(Modifier.selectableGroup()) {
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
    val labelStyle = MaterialTheme.typography.bodyLarge.copy(lineBreak = LineBreak.Heading)
    Row(
        Modifier
            .fillMaxWidth()
            .heightIn(min = 64.dp)
            .onFocusChanged { if (it.isFocused && !selected) onClick() }
            .selectable(selected = selected, role = Role.RadioButton, onClick = onClick)
            .padding(vertical = 12.dp),
        horizontalArrangement = Arrangement.spacedBy(16.dp),
        verticalAlignment = Alignment.Top,
    ) {
        // The radio stands beside the label's first line, however many lines follow.
        Box(Modifier.height(with(LocalDensity.current) { labelStyle.lineHeight.toDp() }), contentAlignment = Alignment.Center) {
            RadioButton(selected = selected, onClick = null)
        }
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(choice.label, style = labelStyle)
            choice.description?.let {
                Text(
                    it,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    style = MaterialTheme.typography.bodyMedium,
                )
            }
            if (stacked) ChoiceSize(choice, MaterialTheme.typography.bodySmall)
        }
        if (!stacked) ChoiceSize(choice, MaterialTheme.typography.labelMedium)
    }
}

@Composable
private fun ChoiceSize(
    choice: RowChoice,
    style: TextStyle,
) {
    Text(
        choice.trailing,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        style = style.withTabularFigures(),
    )
}

internal data class PickedSize(
    val questions: Long,
    val minutes: Long,
    val estimatedMinutes: Long,
)

/** Main's `ChooserPicked`: the picked mock's size and what it asks, beside the options. */
@Composable
private fun PickedMock(
    title: String,
    size: PickedSize,
    namesTitle: String,
    names: List<String>,
    written: List<String> = emptyList(),
) {
    Column(verticalArrangement = Arrangement.spacedBy(24.dp)) {
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            SectionHeader(title)
            Column {
                PickedFact(stringResource(R.string.mock_chooser_questions), formatNumber(size.questions.toDouble(), currentLocale()))
                PickedFact(stringResource(R.string.mock_chooser_time_limit), minutesText(size.minutes))
                PickedFact(
                    stringResource(R.string.mock_chooser_usually_takes),
                    stringResource(R.string.mock_chooser_about, minutesText(size.estimatedMinutes)),
                )
            }
        }
        if (names.isNotEmpty() || written.isNotEmpty()) {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                SectionLabel(namesTitle)
                Column {
                    names.forEachIndexed { index, name ->
                        if (index > 0) HorizontalDivider()
                        PickedName(name, detail = null)
                    }
                    written.forEachIndexed { index, name ->
                        if (names.isNotEmpty() || index > 0) HorizontalDivider()
                        PickedName(name, detail = stringResource(R.string.mock_chooser_written_part))
                    }
                }
            }
        }
    }
}

@Composable
private fun PickedFact(
    label: String,
    value: String,
) {
    Row(
        Modifier
            .fillMaxWidth()
            .padding(vertical = 8.dp)
            .semantics(mergeDescendants = true) {},
        horizontalArrangement = Arrangement.spacedBy(16.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(label, Modifier.weight(1f), color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodyMedium)
        Text(value, style = MaterialTheme.typography.bodyMedium.withTabularFigures())
    }
}

@Composable
private fun PickedName(
    name: String,
    detail: String?,
) {
    Column(
        Modifier
            .fillMaxWidth()
            .heightIn(min = 48.dp)
            .padding(vertical = 12.dp)
            .semantics(mergeDescendants = true) {},
    ) {
        Text(name, style = MaterialTheme.typography.bodyLarge)
        detail?.let { Text(it, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodyMedium) }
    }
}

private val STACK_BELOW = 480.dp
