package com.zoonk.android.feature.language

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
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
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.paneTitle
import androidx.compose.ui.semantics.semantics
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
import com.zoonk.android.feature.conversation.PracticeConversation
import com.zoonk.android.feature.feedback.FeedbackTarget
import com.zoonk.android.feature.feedback.ReportProblemMenu
import com.zoonk.android.feature.questions.ItemText
import com.zoonk.android.feature.tutor.TutorAskButton
import com.zoonk.android.feature.tutor.TutorScope
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.ui.components.DisclosureRow
import com.zoonk.android.ui.components.KindDotLeading
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

/** Where a unit's page leads. */
internal class UnitActions(
    val open: (AppRoute) -> Unit,
    val start: suspend (CallRequest) -> CallStart,
)

/** Main's `/content/units/{chapterId}`: a language unit's lessons, practice and what to look back on. */
@Composable
fun LanguageUnitScreen(
    route: AppRoute.LanguageUnit,
    app: AppContainer,
    navigator: AppNavigator,
) {
    val chapterId = remember(route.chapterId) { runCatching { UUID.fromString(route.chapterId) }.getOrNull() }
    if (chapterId == null) {
        UnitFrame(navigator, title = null) { NotFoundMessage() }
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
    val goalId = unit?.goalId
    val plan = remember(goalId) { goalId?.let { app.plans.plan[it] } }
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
                    NotFoundMessage()
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

/**
 * The unit's hero, lessons and what it teaches, with its progress, practice and reference beside
 * them where there's room, else after them, as main's aside. [upNext] marks the next lesson when the
 * unit is the plan's current one.
 */
@Composable
internal fun UnitPage(
    unit: LanguageUnit,
    upNext: Boolean,
    actions: UnitActions,
    listState: LazyListState = rememberLazyListState(),
) {
    val lessons = remember(unit) { unit.lessons.map { it.listed() } }
    val compact = !currentWindowAdaptiveInfoV2().windowSizeClass.isWidthAtLeastBreakpoint(WindowSizeClass.WIDTH_DP_MEDIUM_LOWER_BOUND)
    val padding = PaddingValues(horizontal = if (compact) 16.dp else 24.dp, vertical = 24.dp)
    val aboutLabel = stringResource(R.string.language_unit_about)
    val openLesson = { id: UUID -> actions.open(AppRoute.Lesson(id.toString())) }

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
                    UnitPractice(unit, actions)
                    UnitReference(unit)
                }
            }
        },
    ) { asideBeside ->
        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.TopStart) {
            LazyColumn(
                state = listState,
                modifier = Modifier.widthIn(max = PAGE_WIDTH).fillMaxSize(),
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
                    item(key = "practice") { UnitPractice(unit, actions) }
                    if (hasReference(unit)) item(key = "reference") { UnitReference(unit) }
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

    Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
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
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        SectionHeader(stringResource(if (finished) R.string.language_unit_can_already else R.string.language_unit_objectives))
        objectives.take(SHOWN_OBJECTIVES).forEach { objective ->
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.Top) {
                CanDoMark(done = finished, modifier = Modifier.padding(top = 2.dp))
                Text(objective, style = MaterialTheme.typography.bodyLarge)
            }
        }
    }
}

@Composable
private fun UnitProgress(lessons: List<ListedLesson>) {
    val locale = currentLocale()
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
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
) {
    val chapterId = unit.unit.chapterId
    val rows =
        buildList<@Composable () -> Unit> {
            add { PracticeConversation(unit.conversation, chapterId, unit.goalId, actions.start, actions.open) }
            if (unit.canTestOut) add { TestOutRow(TestOutScope.Unit, onOpen = { actions.open(AppRoute.TestOut(chapterId.toString())) }) }
            if (unit.mistakes.isNotEmpty()) {
                add {
                    DisclosureRow(
                        stringResource(R.string.language_unit_mistakes),
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
        SectionHeader(stringResource(R.string.language_unit_practice))
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
                ItemText(mistake.question, style = MaterialTheme.typography.bodyMedium)
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
private fun UnitReference(unit: LanguageUnit) {
    if (!hasReference(unit)) return
    val locale = currentLocale()
    val rows =
        buildList<@Composable () -> Unit> {
            if (unit.grammarTips.isNotEmpty()) {
                add {
                    DisclosureRow(
                        stringResource(R.string.language_unit_grammar_tips),
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
                        leading = { Icon(painterResource(R.drawable.ic_checklist), contentDescription = null) },
                    ) { LessonSummaries(unit.summaries.map { LessonSummary(it.title, it.ideas) }) }
                }
            }
        }

    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        SectionHeader(stringResource(R.string.language_unit_reference))
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

private const val SEPARATOR = " · "
private const val SHOWN_OBJECTIVES = 3
private val PAGE_WIDTH = 720.dp
private val SECTION_GAP = 40.dp
