package com.zoonk.android.feature.mistakes

import androidx.annotation.DrawableRes
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyListScope
import androidx.compose.foundation.lazy.LazyListState
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.material3.Button
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.PrimaryTabRow
import androidx.compose.material3.Tab
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.VerticalDivider
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.MutableState
import androidx.compose.runtime.SideEffect
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.paneTitle
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.app.AppContainer
import com.zoonk.android.data.LoadState
import com.zoonk.android.data.collectShown
import com.zoonk.android.data.recode
import com.zoonk.android.data.value
import com.zoonk.android.feature.language.PatternRow
import com.zoonk.android.feature.questions.ItemSetText
import com.zoonk.android.feature.questions.ItemSupport
import com.zoonk.android.feature.questions.ItemText
import com.zoonk.android.feature.questions.TrueFalseWords
import com.zoonk.android.feature.questions.plainItemLine
import com.zoonk.android.feature.questions.savedAnswerText
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.navigation.AppTab
import com.zoonk.android.ui.components.DisclosureRow
import com.zoonk.android.ui.components.DoneMark
import com.zoonk.android.ui.components.Facts
import com.zoonk.android.ui.components.LIST_ITEM_INSET
import com.zoonk.android.ui.components.ListRow
import com.zoonk.android.ui.components.LoadFailedMessage
import com.zoonk.android.ui.components.MistakeAnswer
import com.zoonk.android.ui.components.OutlinedButton
import com.zoonk.android.ui.components.PageLoading
import com.zoonk.android.ui.components.bleed
import com.zoonk.android.ui.format.DateStyle
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatDate
import com.zoonk.android.ui.richtext.RichText
import com.zoonk.android.ui.scaffold.PageScaffold
import com.zoonk.android.ui.scaffold.PageSpan
import com.zoonk.android.ui.scaffold.detailPagePadding
import com.zoonk.android.ui.scaffold.mainActionWidth
import com.zoonk.android.ui.scaffold.onPageSpan
import com.zoonk.android.ui.scaffold.spreadFold
import com.zoonk.android.ui.theme.withTabularFigures
import com.zoonk.api.models.GoalMistakePatternPattern
import com.zoonk.api.models.Mistake
import com.zoonk.api.models.MistakeCause
import com.zoonk.api.models.MistakeList
import com.zoonk.api.models.MistakeStatus
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import java.time.ZoneId
import java.util.UUID
import kotlin.time.Duration.Companion.milliseconds

@Composable
fun MistakesNotebookScreen(
    app: AppContainer,
    navigator: AppNavigator,
) {
    val summary by app.learnerSummary.summary.collectShown()
    val read = summary.value
    val goal = read?.let { it.goals.firstOrNull { goal -> goal.id == it.activeGoalId } }
    var titleAway by remember { mutableStateOf(false) }

    PageScaffold(
        onBack = { navigator.back() },
        title = { if (titleAway) Text(stringResource(R.string.mistakes_notebook_title), maxLines = 1, overflow = TextOverflow.Ellipsis) },
    ) { padding ->
        Box(Modifier.fillMaxSize().padding(padding)) {
            when {
                goal != null -> {
                    Notebook(goal.id, goal.title, app.mistakesNotebook, navigator, read.nextChangeAt, onHeroAway = { titleAway = it })
                }

                summary is LoadState.Failed -> {
                    val scope = rememberCoroutineScope()
                    LoadFailedMessage(onRetry = { scope.launch { app.learnerSummary.summary.refresh() } })
                }

                read != null -> {
                    LaunchedEffect(Unit) { navigator.showRoot(AppTab.Today) }
                }

                else -> {
                    PageLoading()
                }
            }
        }
    }
}

/**
 * The notebook's two lists, what's to fix and what's fixed. Tabs switch between them; an unfolded
 * book shows both, as the open iPhone Duo does: what's to fix under the notebook's hero on the page
 * before the fold and what's fixed on the page after it, each under its own title.
 */
@Composable
internal fun Notebook(
    goalId: UUID,
    goalTitle: String,
    store: MistakesNotebookStore,
    navigator: AppNavigator,
    nextChangeAt: Long? = null,
    onHeroAway: (Boolean) -> Unit = {},
) {
    var fixed by rememberSaveable { mutableStateOf(false) }
    // Each list keeps what's open in it and where it's scrolled, under the tabs or on its own page of a book.
    val toFix = rememberListMemory()
    val fixedOnes = rememberListMemory()
    var span by remember { mutableStateOf<PageSpan?>(null) }

    BoxWithConstraints(Modifier.onPageSpan { span = it }) {
        val fold = spreadFold(maxWidth, span)
        val wide = fold == null && maxWidth >= INBOX_WIDTH
        val first = if (fold == null && fixed) fixedOnes else toFix
        val heroAway by remember(first) { derivedStateOf { first.scroll.firstVisibleItemIndex > 0 } }

        LaunchedEffect(heroAway) { onHeroAway(heroAway) }

        // The first list keeps its place either way, so what's open in it stays as the book opens or closes.
        Row(Modifier.fillMaxSize()) {
            NotebookList(
                goalId = goalId,
                goalTitle = goalTitle,
                fixed = fixed && fold == null,
                store = store,
                navigator = navigator,
                memory = first,
                nextChangeAt = nextChangeAt,
                hero = true,
                onTab = if (fold == null) ({ fixed = it }) else null,
                wide = wide,
                modifier = if (fold == null) Modifier.weight(1f) else Modifier.width(fold.start),
            )
            if (fold != null) {
                NotebookList(
                    goalId = goalId,
                    goalTitle = goalTitle,
                    fixed = true,
                    store = store,
                    navigator = navigator,
                    memory = fixedOnes,
                    nextChangeAt = nextChangeAt,
                    hero = false,
                    onTab = null,
                    wide = false,
                    modifier = Modifier.weight(1f).padding(start = fold.end - fold.start),
                )
            }
        }
    }
}

/** One of the notebook's lists: what's to fix or what's fixed, under the tabs that switch them or under its own title. */
@Composable
private fun NotebookList(
    goalId: UUID,
    goalTitle: String,
    fixed: Boolean,
    store: MistakesNotebookStore,
    navigator: AppNavigator,
    memory: ListMemory,
    nextChangeAt: Long?,
    hero: Boolean,
    onTab: ((Boolean) -> Unit)?,
    wide: Boolean,
    modifier: Modifier,
) {
    val key = NotebookKey(goalId, fixed)
    val loaded by store.notebooks[key].collectShown()
    val pattern by store.patterns[goalId].collectShown()
    val scope = rememberCoroutineScope()
    var loadingMore by remember(key) { mutableStateOf(false) }
    var moreFailed by remember(key) { mutableStateOf(false) }
    var lastLoaded by remember(goalId) { mutableStateOf<MistakeList?>(null) }

    // What's ready to practice changes at the learner's day change, with no write to mark it.
    LaunchedEffect(nextChangeAt, key) {
        nextChangeAt ?: return@LaunchedEffect
        delay((nextChangeAt - System.currentTimeMillis()).coerceAtLeast(0).milliseconds)
        store.notebooks[key].invalidate()
    }

    val list = loaded.value
    SideEffect { if (list != null) lastLoaded = list }
    val head = list ?: lastLoaded
    if (head == null) {
        Box(modifier) {
            if (loaded is LoadState.Failed) {
                LoadFailedMessage(onRetry = { scope.launch { store.notebooks[key].refresh() } })
            } else {
                PageLoading()
            }
        }
        return
    }

    val page =
        NotebookPage(
            goalTitle = goalTitle,
            head = head,
            list = list,
            failed = loaded is LoadState.Failed,
            fixed = fixed,
            pattern = pattern.value?.pattern?.takeUnless { fixed },
            loadingMore = loadingMore,
            moreFailed = moreFailed,
        )
    val keys = page.groups.map { it.groupKey() }
    val selectedKey = memory.picked?.takeIf { it in keys } ?: keys.firstOrNull()
    val actions =
        NotebookActions(
            onTab = { onTab?.invoke(it) },
            onPick = { groupKey, open ->
                if (open) memory.picked = groupKey
                memory.collapsed = !open
            },
            onRetry = { scope.launch { store.notebooks[key].refresh() } },
            onPractice = { navigator.open(AppRoute.MistakePractice()) },
            onPattern = { navigator.open(AppRoute.Pattern(it.toString())) },
            onPracticeSkill = { navigator.open(AppRoute.MistakePractice(it.toString())) },
            onLesson = { navigator.open(AppRoute.Lesson(it.toString())) },
            onMore = {
                scope.launch {
                    loadingMore = true
                    moreFailed = !store.more(key)
                    loadingMore = false
                }
            },
        )

    val lead = NotebookLead(hero, tabs = onTab != null)
    Box(modifier) {
        if (wide && page.groups.isNotEmpty()) {
            WideNotebook(page, actions, lead, selectedKey, memory.scroll)
        } else {
            NarrowNotebook(page, actions, lead, selectedKey.takeUnless { memory.collapsed }, memory.scroll)
        }
    }
}

/** What's open in one of the notebook's lists and where it's scrolled. */
private class ListMemory(
    val scroll: LazyListState,
    picked: MutableState<String?>,
    collapsed: MutableState<Boolean>,
) {
    var picked by picked
    var collapsed by collapsed
}

@Composable
private fun rememberListMemory(): ListMemory {
    val scroll = rememberLazyListState()
    val picked = rememberSaveable { mutableStateOf<String?>(null) }
    val collapsed = rememberSaveable { mutableStateOf(false) }
    return remember(scroll) { ListMemory(scroll, picked, collapsed) }
}

private class NotebookPage(
    val goalTitle: String,
    /** The counts and availability: the same on both tabs, so a tab that's loading keeps showing them. */
    val head: MistakeList,
    val list: MistakeList?,
    val failed: Boolean,
    val fixed: Boolean,
    val pattern: GoalMistakePatternPattern?,
    val loadingMore: Boolean,
    val moreFailed: Boolean,
) {
    val groups: List<List<Mistake>> =
        list
            ?.`data`
            .orEmpty()
            .groupBy { it.skill?.id }
            .values
            .toList()
    val words: TrueFalseWords = head.trueFalseLabels.recode()
}

/** What leads a list: the notebook's [hero], then the [tabs] or the list's own title. */
private class NotebookLead(
    val hero: Boolean,
    val tabs: Boolean,
)

private class NotebookActions(
    val onTab: (Boolean) -> Unit,
    val onPick: (groupKey: String, open: Boolean) -> Unit,
    val onRetry: () -> Unit,
    val onPractice: () -> Unit,
    val onPattern: (UUID) -> Unit,
    val onPracticeSkill: (UUID) -> Unit,
    val onLesson: (UUID) -> Unit,
    val onMore: () -> Unit,
)

@Composable
private fun NarrowNotebook(
    page: NotebookPage,
    actions: NotebookActions,
    lead: NotebookLead,
    open: String?,
    listState: LazyListState,
) {
    LazyColumn(Modifier.fillMaxSize(), listState, detailPagePadding()) {
        notebookHead(page, actions, lead)
        notebookBody(page, actions) {
            Column(Modifier.bleed(LIST_ITEM_INSET)) {
                page.groups.forEachIndexed { index, group ->
                    if (index > 0) HorizontalDivider()
                    val groupKey = group.groupKey()
                    DisclosureRow(
                        title = group.skillName(),
                        expanded = open == groupKey,
                        onExpandedChange = { actions.onPick(groupKey, it) },
                        leading = group.fixedMark(),
                        count = group.size,
                    ) { Entries(group, page, actions) }
                }
            }
        }
        notebookMore(page, actions)
    }
}

@Composable
private fun WideNotebook(
    page: NotebookPage,
    actions: NotebookActions,
    lead: NotebookLead,
    selectedKey: String?,
    listState: LazyListState,
) {
    val padding = detailPagePadding()

    Row(Modifier.fillMaxSize()) {
        LazyColumn(
            Modifier.width(SKILLS_WIDTH).fillMaxSize(),
            listState,
            contentPadding = padding,
        ) {
            notebookHead(page, actions, lead)
            notebookBody(page, actions) {
                Column(Modifier.bleed(LIST_ITEM_INSET)) {
                    page.groups.forEachIndexed { index, group ->
                        if (index > 0) HorizontalDivider()
                        val groupKey = group.groupKey()
                        ListRow(
                            headline = { Text(group.skillName()) },
                            modifier = Modifier.semantics { selected = groupKey == selectedKey },
                            onClick = { actions.onPick(groupKey, true) },
                            highlighted = groupKey == selectedKey,
                            leading = group.fixedMark(),
                            meta = { Text(group.size.toString()) },
                        )
                    }
                }
            }
            notebookMore(page, actions)
        }
        VerticalDivider()
        page.groups.firstOrNull { it.groupKey() == selectedKey }?.let { group ->
            val name = group.skillName()
            LazyColumn(Modifier.weight(1f).fillMaxSize().semantics { paneTitle = name }, contentPadding = padding) {
                item { Box(Modifier.widthIn(max = ENTRIES_WIDTH)) { Entries(group, page, actions) } }
            }
        }
    }
}

private fun LazyListScope.notebookBody(
    page: NotebookPage,
    actions: NotebookActions,
    groups: @Composable () -> Unit,
) {
    item {
        Box(Modifier.padding(top = ITEM_GAP)) {
            when {
                page.list == null && page.failed -> {
                    LoadFailedMessage(onRetry = actions.onRetry)
                }

                page.list == null -> {
                    PageLoading(Modifier.padding(vertical = 24.dp))
                }

                page.groups.isEmpty() -> {
                    EmptyNotebook(page.fixed)
                }

                else -> {
                    groups()
                }
            }
        }
    }
}

private fun LazyListScope.notebookHead(
    page: NotebookPage,
    actions: NotebookActions,
    lead: NotebookLead,
) {
    // The same items with or without the hero, so a list's scroll keeps its place as the book opens or closes. Each
    // item brings its own gap: a list's spacing would also follow the hero's empty slot.
    item { if (lead.hero) Box(Modifier.padding(bottom = ITEM_GAP)) { NotebookHero(page, actions.onPractice) } }
    item { if (lead.tabs) NotebookTabs(page, actions.onTab) else NotebookListTitle(page) }
    page.pattern?.let { pattern ->
        item {
            PatternRow(
                typos = pattern.kind == GoalMistakePatternPattern.Kind.TYPOS,
                title = pattern.title,
                onOpen = { actions.onPattern(pattern.id) },
                modifier = Modifier.padding(top = ITEM_GAP).bleed(LIST_ITEM_INSET),
            )
        }
    }
}

private fun LazyListScope.notebookMore(
    page: NotebookPage,
    actions: NotebookActions,
) {
    if (page.list?.pagination?.nextCursor == null) return
    item {
        Column(Modifier.padding(top = ITEM_GAP), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            if (page.moreFailed) {
                Text(
                    stringResource(R.string.mistakes_more_failed),
                    Modifier.semantics { liveRegion = LiveRegionMode.Polite },
                    color = MaterialTheme.colorScheme.error,
                    style = MaterialTheme.typography.bodyMedium,
                )
            }
            OutlinedButton(onClick = actions.onMore, enabled = !page.loadingMore) { Text(stringResource(R.string.mistakes_show_more)) }
        }
    }
}

@Composable
private fun NotebookHero(
    page: NotebookPage,
    onPractice: () -> Unit,
) {
    val availability = page.head.availability
    val ready = availability.ready.toInt()
    val tomorrow = availability.tomorrow.toInt()
    val fixedCount =
        page.head.counts.fixed
            .toInt()

    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(page.goalTitle, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.labelLarge)
        Text(
            stringResource(R.string.mistakes_notebook_title),
            Modifier.semantics { heading() },
            style = MaterialTheme.typography.titleLarge,
        )
        Facts(
            listOfNotNull(
                pluralStringResource(R.plurals.mistakes_ready, ready, ready).takeIf { ready > 0 || tomorrow == 0 },
                pluralStringResource(R.plurals.mistakes_tomorrow, tomorrow, tomorrow).takeIf { tomorrow > 0 },
                pluralStringResource(R.plurals.mistakes_fixed_count, fixedCount, fixedCount),
            ),
        )
        if (ready == 0 && tomorrow > 0) {
            Text(
                stringResource(R.string.mistakes_come_back_tomorrow),
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                style = MaterialTheme.typography.bodyMedium,
            )
        }
        if (ready > 0) {
            Button(onClick = onPractice, modifier = Modifier.padding(top = 8.dp).mainActionWidth()) {
                Text(stringResource(R.string.mistakes_practice))
            }
        }
    }
}

@Composable
private fun NotebookTabs(
    page: NotebookPage,
    onTab: (Boolean) -> Unit,
) {
    val counts = page.head.counts

    PrimaryTabRow(selectedTabIndex = if (page.fixed) 1 else 0) {
        listOf(false to counts.open, true to counts.fixed).forEach { (fixed, count) ->
            Tab(
                selected = page.fixed == fixed,
                onClick = { onTab(fixed) },
                text = {
                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
                        Text(stringResource(if (fixed) R.string.mistakes_tab_fixed else R.string.mistakes_tab_open))
                        Text(count.toString(), style = MaterialTheme.typography.labelMedium.withTabularFigures())
                    }
                },
            )
        }
    }
}

@Composable
private fun NotebookListTitle(page: NotebookPage) {
    val counts = page.head.counts

    Row(
        Modifier.semantics(mergeDescendants = true) { heading() },
        horizontalArrangement = Arrangement.spacedBy(6.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            stringResource(if (page.fixed) R.string.mistakes_tab_fixed else R.string.mistakes_tab_open),
            style = MaterialTheme.typography.titleMedium,
        )
        Text(
            (if (page.fixed) counts.fixed else counts.open).toString(),
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            style = MaterialTheme.typography.labelMedium.withTabularFigures(),
        )
    }
}

@Composable
private fun EmptyNotebook(fixed: Boolean) {
    Text(
        stringResource(if (fixed) R.string.mistakes_empty_fixed else R.string.mistakes_empty_open),
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        style = MaterialTheme.typography.bodyMedium,
    )
}

private fun List<Mistake>.fixedMark(): (@Composable () -> Unit)? = if (first().status == MistakeStatus.FIXED) ({ DoneMark() }) else null

@Composable
private fun Entries(
    group: List<Mistake>,
    page: NotebookPage,
    actions: NotebookActions,
) {
    Column {
        group.forEachIndexed { index, mistake ->
            if (index > 0) HorizontalDivider()
            val setId = mistake.snapshot.set?.id
            MistakeEntry(
                mistake = mistake,
                words = page.words,
                continued =
                    setId != null && group
                        .getOrNull(index - 1)
                        ?.snapshot
                        ?.set
                        ?.id == setId,
                actions = actions,
                modifier = Modifier.padding(top = if (index == 0) 0.dp else 16.dp, bottom = 16.dp),
            )
        }
    }
}

@Composable
private fun MistakeEntry(
    mistake: Mistake,
    words: TrueFalseWords,
    continued: Boolean,
    actions: NotebookActions,
    modifier: Modifier = Modifier,
) {
    val snapshot = mistake.snapshot
    val fixed = mistake.status == MistakeStatus.FIXED
    val instant = mistake.fixedAt?.takeIf { fixed } ?: mistake.createdAt
    val date =
        java.time.Instant
            .ofEpochMilli(instant.toEpochMilliseconds())
            .atZone(ZoneId.systemDefault())
            .toLocalDate()
    val skillId = mistake.skill?.id?.takeIf { mistake.practiceAvailable }

    Column(modifier, verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
            CauseLabel(mistake.cause, fixed, Modifier.weight(1f))
            Text(
                formatDate(date, currentLocale(), DateStyle.Day),
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                style = MaterialTheme.typography.labelMedium.withTabularFigures(),
            )
        }
        snapshot.set?.let { ItemSetText(it.recode(), continued = continued) }
        ItemSupport(
            context = snapshot.context,
            image = snapshot.image?.recode(),
            visual = snapshot.visual?.recode(),
            contextStyle = MaterialTheme.typography.bodyMedium.copy(color = MaterialTheme.colorScheme.onSurfaceVariant),
        )
        RichText(snapshot.question, style = MaterialTheme.typography.bodyLarge.copy(fontWeight = FontWeight.Medium))
        snapshot.answer?.let { MistakeAnswer(plainItemLine(savedAnswerText(it, words)), right = false) }
        snapshot.correctAnswer?.let { MistakeAnswer(plainItemLine(savedAnswerText(it, words)), right = true) }
        snapshot.explanation?.let {
            ItemText(it, style = MaterialTheme.typography.bodyMedium.copy(color = MaterialTheme.colorScheme.onSurfaceVariant))
        }
        if (mistake.practiceAvailableTomorrow || skillId != null || mistake.lesson != null) {
            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), itemVerticalAlignment = Alignment.CenterVertically) {
                if (mistake.practiceAvailableTomorrow) {
                    Text(
                        stringResource(R.string.mistakes_practice_tomorrow),
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        style = MaterialTheme.typography.labelMedium,
                    )
                }
                skillId?.let {
                    OutlinedButton(
                        onClick = { actions.onPracticeSkill(it) },
                    ) { Text(stringResource(R.string.mistakes_practice_skill)) }
                }
                mistake.lesson?.let { lesson ->
                    TextButton(onClick = { actions.onLesson(lesson.id) }) { Text(stringResource(R.string.mistakes_open_lesson)) }
                }
            }
        }
    }
}

@Composable
private fun CauseLabel(
    cause: MistakeCause?,
    fixed: Boolean,
    modifier: Modifier = Modifier,
) {
    val label = causeLabel(cause)

    Row(modifier, horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
        Icon(
            painterResource(cause.icon),
            contentDescription = null,
            Modifier.size(
                with(LocalDensity.current) {
                    MaterialTheme.typography.labelMedium.lineHeight
                        .toDp()
                },
            ),
            tint = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Text(
            if (fixed) stringResource(R.string.mistakes_cause_fixed, label) else label,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            style = MaterialTheme.typography.labelMedium,
        )
    }
}

@Composable
internal fun causeLabel(cause: MistakeCause?): String =
    stringResource(
        when (cause) {
            MistakeCause.GAP -> R.string.mistakes_cause_gap
            MistakeCause.MISREAD -> R.string.mistakes_cause_misread
            MistakeCause.TRAP -> R.string.mistakes_cause_trap
            MistakeCause.TIME -> R.string.mistakes_cause_time
            MistakeCause.GUESS -> R.string.mistakes_cause_guess
            null -> R.string.mistakes_cause_unsorted
        },
    )

@get:DrawableRes
private val MistakeCause?.icon: Int
    get() =
        when (this) {
            MistakeCause.GAP -> R.drawable.ic_lightbulb
            MistakeCause.MISREAD -> R.drawable.ic_visibility
            MistakeCause.TRAP -> R.drawable.ic_warning
            MistakeCause.TIME -> R.drawable.ic_timer
            MistakeCause.GUESS -> R.drawable.ic_back_hand
            null -> R.drawable.ic_radio_button_partial
        }

@Composable
private fun List<Mistake>.skillName(): String = first().skill?.name ?: stringResource(R.string.mistakes_other_questions)

private fun List<Mistake>.groupKey(): String = first().skill?.id?.toString() ?: "none"

private val ITEM_GAP = 24.dp
private val INBOX_WIDTH = 840.dp
private val SKILLS_WIDTH = 400.dp
private val ENTRIES_WIDTH = 720.dp
