package com.zoonk.android.feature.language

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyListState
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.ListItem
import androidx.compose.material3.ListItemDefaults
import androidx.compose.material3.LocalContentColor
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.VerticalDivider
import androidx.compose.material3.adaptive.currentWindowAdaptiveInfoV2
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.listSaver
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.snapshots.SnapshotStateList
import androidx.compose.runtime.toMutableStateList
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.paneTitle
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.window.core.layout.WindowSizeClass
import com.zoonk.android.R
import com.zoonk.android.app.AppContainer
import com.zoonk.android.data.ApiError
import com.zoonk.android.data.LoadState
import com.zoonk.android.data.collectShown
import com.zoonk.android.data.value
import com.zoonk.android.feature.conversation.CallRequest
import com.zoonk.android.feature.conversation.CallStart
import com.zoonk.android.feature.conversation.PracticeCallState
import com.zoonk.android.feature.conversation.PracticeConversation
import com.zoonk.android.feature.conversation.rememberPracticeCallState
import com.zoonk.android.feature.feedback.FeedbackTarget
import com.zoonk.android.feature.feedback.ReportProblemMenu
import com.zoonk.android.feature.plan.planGoal
import com.zoonk.android.feature.questions.ItemText
import com.zoonk.android.feature.tutor.TutorAskButton
import com.zoonk.android.feature.tutor.TutorScope
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.navigation.AppTab
import com.zoonk.android.ui.components.DisclosureRow
import com.zoonk.android.ui.components.KindDotLeading
import com.zoonk.android.ui.components.LIST_ITEM_INSET
import com.zoonk.android.ui.components.LearnKind
import com.zoonk.android.ui.components.LessonList
import com.zoonk.android.ui.components.LessonProgress
import com.zoonk.android.ui.components.LessonSummaries
import com.zoonk.android.ui.components.LessonSummary
import com.zoonk.android.ui.components.ListedLesson
import com.zoonk.android.ui.components.LoadFailedMessage
import com.zoonk.android.ui.components.MistakeAnswer
import com.zoonk.android.ui.components.NotFoundMessage
import com.zoonk.android.ui.components.SectionHeader
import com.zoonk.android.ui.components.TestOutRow
import com.zoonk.android.ui.components.TestOutScope
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatMinutes
import com.zoonk.android.ui.format.formatNumber
import com.zoonk.android.ui.format.formatPercent
import com.zoonk.android.ui.richtext.RichText
import com.zoonk.android.ui.scaffold.PageScaffold
import com.zoonk.android.ui.scaffold.PageWithSupportingPane
import com.zoonk.api.models.FeedbackSubmissionContext
import com.zoonk.api.models.LanguageUnit
import com.zoonk.api.models.LanguageUnitLessonsInner
import com.zoonk.api.models.LanguageUnitMistakesInner
import com.zoonk.api.models.LanguageUnitPattern
import com.zoonk.api.models.PlanPhaseChaptersInner
import kotlinx.coroutines.launch
import java.util.UUID

internal class UnitActions(
    val open: (AppRoute) -> Unit,
    val start: suspend (CallRequest) -> CallStart,
)

@Composable
fun LanguageUnitScreen(
    route: AppRoute.LanguageUnit,
    app: AppContainer,
    navigator: AppNavigator,
) {
    val chapterId = remember(route.chapterId) { runCatching { UUID.fromString(route.chapterId) }.getOrNull() }
    if (chapterId == null) {
        UnitFrame(navigator, title = null) { NotFoundMessage(onGoHome = { navigator.showRoot(AppTab.Today) }) }
        return
    }
    UnitEntry(chapterId, app, navigator)
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun UnitEntry(
    chapterId: UUID,
    app: AppContainer,
    navigator: AppNavigator,
) {
    val resource = remember(chapterId) { app.languageUnits.unit(chapterId) }
    val load by resource.collectShown()
    val isRefreshing by resource.isRefreshing.collectAsStateWithLifecycle()
    val scope = rememberCoroutineScope()
    val listState = rememberLazyListState()
    val heroScrolledAway by remember(listState) { derivedStateOf { listState.firstVisibleItemIndex > 0 } }
    val unit = load.value
    val actions = remember(navigator) { UnitActions(open = navigator::open, start = app.conversations::start) }
    // Main reads the selected goal's plan, so a unit of another goal opened from a link marks nothing.
    val summary by app.learnerSummary.summary.collectShown()
    val planGoalId = summary.value?.planGoal?.id
    val plan = remember(planGoalId) { planGoalId?.let { app.plans.plan[it] } }
    val planRead = plan?.collectShown()?.value?.value
    val upNext =
        planRead
            ?.plan
            ?.phases
            .orEmpty()
            .flatMap { it.chapters }
            .any { it.chapterId == chapterId && it.state == PlanPhaseChaptersInner.State.CURRENT }

    UnitFrame(
        navigator = navigator,
        title = unit?.unit?.title?.takeIf { heroScrolledAway },
        actions = {
            if (unit != null) {
                TutorAskButton(TutorScope.Chapter(chapterId.toString()), app, navigator, worded = false)
                ReportProblemMenu(app, FeedbackTarget("unit", FeedbackSubmissionContext.ContentKind.CHAPTER, chapterId))
            }
        },
    ) {
        PullToRefreshBox(
            isRefreshing = isRefreshing,
            onRefresh = { scope.launch { resource.refresh() } },
            modifier = Modifier.fillMaxSize(),
        ) {
            val current = load
            when {
                unit != null -> {
                    UnitPage(unit, upNext, actions, listState)
                }

                current is LoadState.Failed && current.error != ApiError.NotFound -> {
                    LoadFailedMessage(
                        onRetry = { scope.launch { resource.refresh() } },
                    )
                }

                current is LoadState.Failed || current is LoadState.Empty -> {
                    NotFoundMessage(onGoHome = { navigator.showRoot(AppTab.Today) })
                }

                else -> {
                    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { CircularProgressIndicator() }
                }
            }
        }
    }
}

@Composable
private fun UnitFrame(
    navigator: AppNavigator,
    title: String?,
    actions: @Composable () -> Unit = {},
    content: @Composable () -> Unit,
) {
    PageScaffold(
        onBack = { navigator.back() },
        title = { title?.let { Text(it, maxLines = 1, overflow = TextOverflow.Ellipsis) } },
        actions = { actions() },
    ) { padding ->
        Box(Modifier.fillMaxSize().padding(padding)) { content() }
    }
}

/** [upNext]: the unit is the selected plan's current one, so its next lesson is marked. */
@Composable
internal fun UnitPage(
    unit: LanguageUnit,
    upNext: Boolean,
    actions: UnitActions,
    listState: LazyListState = rememberLazyListState(),
) {
    val lessons = remember(unit) { unit.lessons.map { it.listed() } }
    val compact = !currentWindowAdaptiveInfoV2().windowSizeClass.isWidthAtLeastBreakpoint(WindowSizeClass.WIDTH_DP_MEDIUM_LOWER_BOUND)
    val padding = PaddingValues(horizontal = (if (compact) 16.dp else 24.dp) - LIST_ITEM_INSET, vertical = 24.dp)
    val aboutLabel = stringResource(R.string.language_unit_about)
    val openLesson = { id: UUID -> actions.open(AppRoute.Lesson(id.toString())) }
    // Practice and reference move between the aside and the page as the window changes, so what's open lives here.
    val practiceCall = rememberPracticeCallState(unit.conversation.defaultMinutes)
    val expanded = rememberSaveable(saver = EXPANDED_SAVER) { mutableStateListOf() }

    PageWithSupportingPane(
        supportingPane = {
            Row {
                VerticalDivider()
                Column(
                    Modifier
                        .fillMaxSize()
                        .verticalScroll(rememberScrollState())
                        .padding(padding)
                        .semantics { paneTitle = aboutLabel },
                    verticalArrangement = Arrangement.spacedBy(SECTION_GAP),
                ) {
                    if (lessons.isNotEmpty()) UnitProgress(lessons)
                    UnitPractice(unit, actions, practiceCall, expanded)
                    UnitReference(unit, expanded)
                }
            }
        },
    ) { asideBeside ->
        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.TopStart) {
            LazyColumn(
                state = listState,
                modifier = Modifier.then(if (asideBeside) Modifier else Modifier.widthIn(max = PAGE_WIDTH)).fillMaxSize(),
                contentPadding = padding,
                verticalArrangement = Arrangement.spacedBy(SECTION_GAP),
            ) {
                item(key = "hero") { UnitHero(unit, lessons, fullWidthAction = compact, onOpen = openLesson) }
                if (lessons.isNotEmpty()) item(key = "lessons") { LessonList(lessons, upNext, onOpen = openLesson) }
                if (unit.unit.objectives.isNotEmpty()) {
                    item(key = "objectives") {
                        UnitObjectives(
                            unit.unit.objectives,
                            finished =
                                lessons.isNotEmpty() && lessons.all { it.done },
                        )
                    }
                }
                if (!asideBeside) {
                    item(key = "practice") { UnitPractice(unit, actions, practiceCall, expanded) }
                    if (hasReference(unit)) item(key = "reference") { UnitReference(unit, expanded) }
                }
            }
        }
    }
}

@Composable
private fun UnitHero(
    unit: LanguageUnit,
    lessons: List<ListedLesson>,
    fullWidthAction: Boolean,
    onOpen: (UUID) -> Unit,
) {
    val locale = currentLocale()
    val info = unit.unit
    val done = lessons.count { it.done }
    val next = lessons.firstOrNull { it.next }
    val eyebrow =
        info.position?.let { stringResource(R.string.language_unit_eyebrow, formatNumber(it.toDouble(), locale), info.levelRange) }
            ?: info.levelRange
    val facts =
        if (lessons.isEmpty()) {
            null
        } else {
            listOfNotNull(
                pluralStringResource(R.plurals.language_unit_lessons, lessons.size, lessons.size),
                lessons.sumOf { it.minutes }.takeIf { it > 0 }?.let { formatMinutes(it, locale) },
                stringResource(R.string.language_unit_done_share, formatPercent(done.toDouble() / lessons.size, locale)),
            ).joinToString(SEPARATOR)
        }

    Column(Modifier.padding(horizontal = LIST_ITEM_INSET), verticalArrangement = Arrangement.spacedBy(16.dp)) {
        Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(eyebrow, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.labelLarge)
            Text(info.title, Modifier.semantics { heading() }, style = MaterialTheme.typography.headlineMedium)
            facts?.let { Text(it, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodyMedium) }
        }
        next?.let { lesson ->
            Button(onClick = { onOpen(lesson.id) }, modifier = if (fullWidthAction) Modifier.fillMaxWidth() else Modifier) {
                Text(stringResource(if (done > 0) R.string.language_unit_continue else R.string.language_unit_start))
            }
        }
    }
}

@Composable
private fun UnitObjectives(
    objectives: List<String>,
    finished: Boolean,
) {
    Column {
        SectionHeader(
            stringResource(if (finished) R.string.language_unit_can_already else R.string.language_unit_objectives),
            Modifier.padding(horizontal = LIST_ITEM_INSET),
        )
        objectives.take(SHOWN_OBJECTIVES).forEach { objective ->
            ListItem(
                headlineContent = { Text(objective) },
                leadingContent = { Box(Modifier.size(MARK_SLOT), contentAlignment = Alignment.Center) { CanDoMark(done = finished) } },
                colors = ListItemDefaults.colors(containerColor = Color.Transparent),
            )
        }
    }
}

@Composable
private fun UnitProgress(lessons: List<ListedLesson>) {
    val locale = currentLocale()
    Column(Modifier.padding(horizontal = LIST_ITEM_INSET), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        SectionHeader(
            stringResource(R.string.language_unit_progress),
            detail =
                stringResource(
                    R.string.lessons_done_count,
                    formatNumber(lessons.count { it.done }.toDouble(), locale),
                    formatNumber(lessons.size.toDouble(), locale),
                ),
        )
        LessonProgress(lessons)
    }
}

@Composable
private fun UnitPractice(
    unit: LanguageUnit,
    actions: UnitActions,
    practiceCall: PracticeCallState,
    expanded: SnapshotStateList<String>,
) {
    val chapterId = unit.unit.chapterId
    val rows =
        buildList<@Composable () -> Unit> {
            add { PracticeConversation(unit.conversation, chapterId, unit.goalId, actions.start, actions.open, state = practiceCall) }
            if (unit.canTestOut) add { TestOutRow(TestOutScope.Unit, onOpen = { actions.open(AppRoute.TestOut(chapterId.toString())) }) }
            if (unit.mistakes.isNotEmpty()) {
                add {
                    DisclosureRow(
                        stringResource(R.string.language_unit_mistakes),
                        expanded = "mistakes" in expanded,
                        onExpandedChange = { expanded.show("mistakes", it) },
                        leading = { KindDotLeading(LearnKind.Mistakes) },
                        count = unit.mistakes.size,
                    ) { UnitMistakes(unit.mistakes) }
                }
            }
            unit.pattern?.let { pattern ->
                add {
                    PatternRow(
                        typos = pattern.kind == LanguageUnitPattern.Kind.TYPOS,
                        title = pattern.title,
                        onOpen = { actions.open(AppRoute.Pattern(pattern.id.toString())) },
                    )
                }
            }
            unit.pronunciation?.let { due ->
                add {
                    PronunciationRow(
                        count = due.count.toInt(),
                        words = due.words,
                        onOpen = { actions.open(AppRoute.Pronunciation(unit.goalId?.toString())) },
                    )
                }
            }
        }

    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        SectionHeader(stringResource(R.string.language_unit_practice), Modifier.padding(horizontal = LIST_ITEM_INSET))
        Column {
            rows.forEachIndexed { index, row ->
                if (index > 0) HorizontalDivider()
                row()
            }
        }
    }
}

@Composable
private fun UnitMistakes(mistakes: List<LanguageUnitMistakesInner>) {
    Column {
        mistakes.forEachIndexed { index, mistake ->
            if (index > 0) HorizontalDivider()
            Column(Modifier.padding(vertical = 12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(
                    skillLabel(mistake.skill),
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    style = MaterialTheme.typography.labelMedium,
                )
                ItemText(mistake.question, style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.Medium))
                mistake.answer?.let { MistakeAnswer(it, right = false) }
                mistake.correctAnswer?.let { MistakeAnswer(it, right = true) }
                mistake.explanation?.let {
                    CompositionLocalProvider(LocalContentColor provides MaterialTheme.colorScheme.onSurfaceVariant) {
                        ItemText(it, style = MaterialTheme.typography.bodyMedium)
                    }
                }
            }
        }
    }
}

@Composable
private fun skillLabel(skill: LanguageUnitMistakesInner.Skill): String =
    stringResource(
        when (skill) {
            LanguageUnitMistakesInner.Skill.LISTENING -> R.string.language_skill_listening
            LanguageUnitMistakesInner.Skill.SPEAKING -> R.string.language_skill_speaking
            LanguageUnitMistakesInner.Skill.WORDS -> R.string.language_skill_words
            LanguageUnitMistakesInner.Skill.WRITING -> R.string.language_skill_writing
        },
    )

private fun hasReference(unit: LanguageUnit) = unit.grammarTips.isNotEmpty() || unit.words.count > 0 || unit.summaries.isNotEmpty()

@Composable
private fun UnitReference(
    unit: LanguageUnit,
    expanded: SnapshotStateList<String>,
) {
    if (!hasReference(unit)) return
    val locale = currentLocale()
    val rows =
        buildList<@Composable () -> Unit> {
            if (unit.grammarTips.isNotEmpty()) {
                add {
                    DisclosureRow(
                        stringResource(R.string.language_unit_grammar_tips),
                        expanded = "tips" in expanded,
                        onExpandedChange = { expanded.show("tips", it) },
                        leading = { Icon(painterResource(R.drawable.ic_menu_book), contentDescription = null) },
                        count = unit.grammarTips.size,
                    ) {
                        Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
                            unit.grammarTips.forEach { tip ->
                                Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                                    Text(tip.title, Modifier.semantics { heading() }, style = MaterialTheme.typography.titleSmall)
                                    CompositionLocalProvider(LocalContentColor provides MaterialTheme.colorScheme.onSurfaceVariant) {
                                        RichText(tip.text, style = MaterialTheme.typography.bodyMedium)
                                    }
                                }
                            }
                        }
                    }
                }
            }
            if (unit.words.count > 0) {
                add {
                    DisclosureRow(
                        stringResource(R.string.language_unit_words),
                        expanded = "words" in expanded,
                        onExpandedChange = { expanded.show("words", it) },
                        leading = { Icon(painterResource(R.drawable.ic_translate), contentDescription = null) },
                        count = unit.words.count.toInt(),
                    ) {
                        val sample = unit.words.sample.joinToString(SEPARATOR)
                        val more = unit.words.count - unit.words.sample.size
                        Text(
                            if (more >
                                0
                            ) {
                                stringResource(R.string.language_unit_words_more, sample, formatNumber(more.toDouble(), locale))
                            } else {
                                sample
                            },
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            style = MaterialTheme.typography.bodyMedium,
                        )
                    }
                }
            }
            if (unit.summaries.isNotEmpty()) {
                add {
                    DisclosureRow(
                        stringResource(R.string.language_unit_summary),
                        expanded = "summary" in expanded,
                        onExpandedChange = { expanded.show("summary", it) },
                        leading = { Icon(painterResource(R.drawable.ic_checklist), contentDescription = null) },
                    ) { LessonSummaries(unit.summaries.map { LessonSummary(it.title, it.ideas) }) }
                }
            }
        }

    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        SectionHeader(stringResource(R.string.language_unit_reference), Modifier.padding(horizontal = LIST_ITEM_INSET))
        Column {
            rows.forEachIndexed { index, row ->
                if (index > 0) HorizontalDivider()
                row()
            }
        }
    }
}

private fun LanguageUnitLessonsInner.listed() =
    ListedLesson(
        id = lessonId,
        title = title,
        minutes = minutes.toInt(),
        done = done,
        next = state == LanguageUnitLessonsInner.State.NEXT,
    )

private fun SnapshotStateList<String>.show(
    section: String,
    open: Boolean,
) {
    if (open) add(section) else remove(section)
}

private val EXPANDED_SAVER = listSaver<SnapshotStateList<String>, String>(save = { it.toList() }, restore = { it.toMutableStateList() })

private const val SEPARATOR = " · "
private val MARK_SLOT = 24.dp
private const val SHOWN_OBJECTIVES = 3
private val PAGE_WIDTH = 720.dp
private val SECTION_GAP = 40.dp
