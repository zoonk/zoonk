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
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.style.LineBreak
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.zoonk.android.R
import com.zoonk.android.data.GenerationKind
import com.zoonk.android.data.GenerationRun
import com.zoonk.android.feature.mock.MockSummaryRow
import com.zoonk.android.feature.subscription.PlusNotice
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.ui.components.Button
import com.zoonk.android.ui.components.Eyebrow
import com.zoonk.android.ui.components.GenerationWait
import com.zoonk.android.ui.components.LimitNotice
import com.zoonk.android.ui.components.LimitSubject
import com.zoonk.android.ui.components.SectionHeader
import com.zoonk.android.ui.components.SectionLabel
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatNumber
import com.zoonk.android.ui.format.joinSentences
import com.zoonk.android.ui.scaffold.BeforeFold
import com.zoonk.android.ui.scaffold.DETAIL_PAGE_WIDTH
import com.zoonk.android.ui.scaffold.DetailPage
import com.zoonk.android.ui.scaffold.detailPagePadding
import com.zoonk.android.ui.scaffold.mainActionWidth
import com.zoonk.android.ui.scaffold.pageTitle
import com.zoonk.android.ui.theme.withTabularFigures
import com.zoonk.api.models.AnytimeMock
import com.zoonk.api.models.MockOption
import com.zoonk.api.models.MockOptions
import com.zoonk.api.models.MockOptionsPlacement

@Composable
internal fun chooserTitle(placement: Boolean): String =
    stringResource(if (placement) R.string.mock_chooser_placement_title else R.string.mock_chooser_title)

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
    var picked by rememberSaveable { mutableStateOf(view.options.firstOrNull()?.key) }
    val option = view.options.firstOrNull { it.key == picked }
    val severalDays = view.options.count { it.kind == MockOption.Kind.FULL } > 1
    val open = view.access == MockOptions.Access.OPEN
    val shown = status.takeUnless { it is ChooserStatus.Short && it.key != picked } ?: ChooserStatus.Choosing
    val examChoices = practiceChoices(view.options.filter { it.kind != MockOption.Kind.AREA }, severalDays)
    val subjectChoices = practiceChoices(view.options.filter { it.kind == MockOption.Kind.AREA }, severalDays)
    val notes: @Composable () -> Unit = {
        option?.let { MockNotes(view.examDocument, view.sizeSource, it.questions, it.minutes, it.leftOut) }
    }

    val start = {
        option?.let {
            onStart()
            viewModel.start(MockChoice.Practice(it.shape), it.key)
        }
    }
    val action: @Composable (Modifier) -> Unit = { modifier ->
        if (open) {
            Button(busy = busy, onClick = { start() }, modifier = modifier.focus(replacementFocus), enabled = option != null) {
                Text(if (shown is ChooserStatus.Short) startWith(shown.outcome) else stringResource(R.string.mock_chooser_start))
            }
        } else {
            SeePlusButton(navigator, modifier.focus(replacementFocus))
        }
    }

    ChooserPage(
        listState = listState,
        onEnter = { if (open) start() else navigator.open(AppRoute.Subscription) },
        bar = { StartBar(shown, navigator, action) },
        aside = {
            option?.let {
                PickedMock(
                    title = mockOptionName(it, severalDays),
                    size = PickedSize(it.questions, it.minutes, it.estimatedMinutes),
                    namesTitle = stringResource(if (it.covers != null) R.string.mock_chooser_parts else R.string.mock_chooser_subjects),
                    names = it.covers ?: it.areas,
                    written = it.written,
                )
            }
            notes()
            view.lastMock?.let { last ->
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    SectionHeader(stringResource(R.string.mock_chooser_last_mock))
                    MockSummaryRow(last, onOpen = last.blockId?.let { { navigator.open(AppRoute.Mock(it.toString())) } }, stacked = true)
                }
            }
        },
    ) { asideBeside ->
        item(key = "hero", contentType = "hero") {
            ChooserHero(
                eyebrow = view.examName,
                title = stringResource(R.string.mock_chooser_title),
                line = stringResource(if (open) R.string.mock_chooser_rule else R.string.mock_chooser_pick_free),
                status = if (asideBeside) ChooserStatus.Choosing else shown,
                action = action.takeUnless { asideBeside },
            )
        }
        if (!asideBeside) refusal(shown, navigator)
        // One pick across both lists, as on main: the subjects are a labeled group of the same choice.
        item(key = "choices", contentType = "choices") {
            Column(verticalArrangement = Arrangement.spacedBy(24.dp)) {
                ChoiceRows(examChoices, picked) { picked = it }
                if (subjectChoices.isNotEmpty()) {
                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        SectionLabel(stringResource(R.string.mock_chooser_one_subject))
                        ChoiceRows(subjectChoices, picked) { picked = it }
                    }
                }
            }
        }
        if (!open) {
            item(key = "plus", contentType = "plus") {
                PlusNotice(onSeePlus = null, description = stringResource(R.string.mock_chooser_plus))
            }
        }
        if (!asideBeside) item(key = "notes", contentType = "notes") { notes() }
    }
}

@Composable
internal fun PlacementChooser(
    view: MockOptions,
    viewModel: MockChooserViewModel,
    navigator: AppNavigator,
    listState: LazyListState,
    replacementFocus: FocusRequester? = null,
    onStart: () -> Unit = {},
) {
    val placement = view.placement ?: return
    val status by viewModel.status.collectAsStateWithLifecycle()
    val busy by viewModel.busy.collectAsStateWithLifecycle()
    var picked by rememberSaveable { mutableStateOf(recommendedKey(placement)) }
    val option = placement.options.firstOrNull { it.key == picked }
    val open = view.access == MockOptions.Access.OPEN
    val choices =
        placement.options.map {
            RowChoice(
                key = it.key,
                label = placementLength(it, recommended = it.key == recommendedKey(placement)),
                description = placementPrecision(it),
                trailing = stringResource(R.string.mock_chooser_placement_size, it.questions.toInt()),
                spokenTrailing =
                    pluralStringResource(
                        R.plurals.mock_chooser_placement_size_spoken,
                        it.questions.toInt(),
                        it.questions.toInt(),
                    ),
            )
        }

    val start = {
        option?.let {
            onStart()
            viewModel.start(MockChoice.Placement(it.length), it.key)
        }
    }
    val action: @Composable (Modifier) -> Unit = { modifier ->
        if (open) {
            Button(busy = busy, onClick = { start() }, modifier = modifier.focus(replacementFocus), enabled = option != null) {
                Text(stringResource(R.string.mock_chooser_placement_start))
            }
        } else {
            SeePlusButton(navigator, modifier.focus(replacementFocus))
        }
    }

    ChooserPage(
        listState = listState,
        onEnter = { if (open) start() else navigator.open(AppRoute.Subscription) },
        bar = { StartBar(status, navigator, action) },
        aside = {
            option?.let {
                PickedMock(
                    title = choices.first { choice -> choice.key == it.key }.label,
                    size = PickedSize(it.questions, it.minutes, it.estimatedMinutes),
                    namesTitle = stringResource(R.string.mock_chooser_subjects),
                    names = it.areas,
                )
            }
        },
    ) { asideBeside ->
        item(key = "hero", contentType = "hero") {
            ChooserHero(
                eyebrow = view.examName,
                title = stringResource(R.string.mock_chooser_placement_title),
                line = stringResource(R.string.mock_chooser_placement_detail),
                status = if (asideBeside) ChooserStatus.Choosing else status,
                action = action.takeUnless { asideBeside },
            )
        }
        if (!asideBeside) refusal(status, navigator)
        item(key = "lengths", contentType = "choices") { ChoiceRows(choices, picked) { picked = it } }
        item(key = "note", contentType = "note") {
            if (open) {
                Text(
                    stringResource(R.string.mock_chooser_placement_note),
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    style = MaterialTheme.typography.bodyMedium,
                )
            } else {
                PlusNotice(onSeePlus = null, description = stringResource(R.string.mock_chooser_placement_plus))
            }
        }
    }
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
                modifier = Modifier.widthIn(max = DETAIL_PAGE_WIDTH).padding(detailPagePadding()),
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
 * The page's column, with the picked mock beside it where there's room, as main's aside, and [bar]
 * pinned under the picked mock there, as on every open book: the start bar sits under what Start
 * starts.
 */
@Composable
private fun ChooserPage(
    listState: LazyListState,
    onEnter: () -> Unit,
    bar: @Composable () -> Unit,
    aside: @Composable ColumnScope.() -> Unit,
    content: LazyListScope.(asideBeside: Boolean) -> Unit,
) {
    DetailPage(
        aside = aside,
        asideBar = bar,
        asideLabel = stringResource(R.string.mock_chooser_picked),
        // Enter takes the page's main action, as main's Start does; the arrows move the pick.
        modifier =
            Modifier.onPreviewKeyEvent { event ->
                val enter = event.key == Key.Enter || event.key == Key.NumPadEnter
                if (enter && event.type == KeyEventType.KeyDown) onEnter()
                enter
            },
        listState = listState,
        content = content,
    )
}

@Composable
private fun ChooserHero(
    eyebrow: String,
    title: String,
    line: String,
    status: ChooserStatus,
    action: (@Composable (Modifier) -> Unit)?,
) {
    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Eyebrow(eyebrow)
        Text(title, Modifier.pageTitle(), style = MaterialTheme.typography.headlineMedium.copy(lineBreak = LineBreak.Heading))
        StatusLine(status, line)
        action?.let { Box(Modifier.padding(top = 12.dp).mainActionWidth()) { it(Modifier.mainActionWidth()) } }
    }
}

@Composable
private fun StartBar(
    status: ChooserStatus,
    navigator: AppNavigator,
    action: @Composable (Modifier) -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        if (status is ChooserStatus.Refused) Refusal(status, navigator) else StatusLine(status, line = null)
        action(Modifier.fillMaxWidth())
    }
}

/** What the last Start found, in place of the page's one line, as main's `role="status"` line. */
@Composable
private fun StatusLine(
    status: ChooserStatus,
    line: String?,
) {
    val failed = status as? ChooserStatus.Failed
    val text =
        when {
            status is ChooserStatus.Short -> {
                shortText(status.outcome)
            }

            failed != null -> {
                stringResource(
                    if (failed.notEnoughQuestions) R.string.mock_chooser_not_enough else R.string.mock_chooser_failed,
                )
            }

            else -> {
                line
            }
        } ?: return

    Text(
        text,
        Modifier.semantics { liveRegion = LiveRegionMode.Polite },
        color = if (failed != null) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.onSurfaceVariant,
        style = MaterialTheme.typography.bodyMedium,
    )
}

@Composable
private fun shortText(short: MockStartOutcome.Short): String {
    val ready =
        pluralStringResource(
            R.plurals.mock_chooser_short,
            short.questions.toInt(),
            short.questions.toInt(),
            formatNumber(short.examQuestions.toDouble(), currentLocale()),
            minutesText(short.minutes),
        )
    val more =
        stringResource(
            when (short.limit) {
                AnytimeMock.Limit.DAY -> R.string.mock_chooser_short_day
                AnytimeMock.Limit.MONTH -> R.string.mock_chooser_short_month
                AnytimeMock.Limit.TOTAL, null -> R.string.mock_chooser_short_none
            },
        )
    return joinSentences(ready, more)
}

@Composable
private fun startWith(short: MockStartOutcome.Short): String =
    pluralStringResource(R.plurals.mock_chooser_start_with, short.questions.toInt(), short.questions.toInt())

private fun Modifier.focus(requester: FocusRequester?): Modifier = requester?.let { focusRequester(it) } ?: this

@Composable
private fun SeePlusButton(
    navigator: AppNavigator,
    modifier: Modifier,
) {
    Button(onClick = { navigator.open(AppRoute.Subscription) }, modifier = modifier) {
        Text(stringResource(R.string.mock_chooser_see_plus))
    }
}

private fun LazyListScope.refusal(
    status: ChooserStatus,
    navigator: AppNavigator,
) {
    if (status !is ChooserStatus.Refused) return
    item(key = "refusal", contentType = "refusal") { Refusal(status, navigator) }
}

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
        onSeePlus = { navigator.open(AppRoute.Subscription) },
        modifier = Modifier.semantics { liveRegion = LiveRegionMode.Polite },
    )
}

internal data class RowChoice(
    val key: String,
    val label: String,
    val description: String?,
    val trailing: String,
    val spokenTrailing: String,
)

@Composable
private fun practiceChoices(
    options: List<MockOption>,
    severalDays: Boolean,
): List<RowChoice> =
    options.map {
        val time = minutesText(it.estimatedMinutes)
        RowChoice(
            key = it.key,
            label = mockOptionName(it, severalDays),
            description = mockOptionDetail(it, severalDays),
            trailing = stringResource(R.string.mock_chooser_option_size, it.questions.toInt(), time),
            spokenTrailing =
                pluralStringResource(
                    R.plurals.mock_chooser_option_size_spoken,
                    it.questions.toInt(),
                    it.questions.toInt(),
                    time,
                ),
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
        Modifier.semantics { contentDescription = choice.spokenTrailing },
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

private fun recommendedKey(placement: MockOptionsPlacement): String = "placement:${placement.recommended.value}"

private val STACK_BELOW = 480.dp
