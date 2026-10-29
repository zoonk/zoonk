package com.zoonk.android.feature.goalcontent

import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.ListItem
import androidx.compose.material3.ListItemDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.LayoutCoordinates
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.compose.viewModel
import com.zoonk.android.R
import com.zoonk.android.app.AppContainer
import com.zoonk.android.data.ApiError
import com.zoonk.android.data.LoadState
import com.zoonk.android.data.collectShown
import com.zoonk.android.data.value
import com.zoonk.android.feature.feedback.FeedbackTarget
import com.zoonk.android.feature.feedback.ReportProblemMenu
import com.zoonk.android.feature.mindmaps.ChapterMindMapCard
import com.zoonk.android.feature.tutor.AskTutor
import com.zoonk.android.feature.tutor.AskTutorAppearance
import com.zoonk.android.feature.tutor.TutorScope
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.navigation.AppTab
import com.zoonk.android.navigation.RoutePlaceholder
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
import com.zoonk.android.ui.components.NotFoundMessage
import com.zoonk.android.ui.components.SectionHeader
import com.zoonk.android.ui.components.SectionLabel
import com.zoonk.android.ui.components.TestOutRow
import com.zoonk.android.ui.components.TestOutScope
import com.zoonk.android.ui.components.markSize
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatMinutes
import com.zoonk.android.ui.format.formatNumber
import com.zoonk.android.ui.scaffold.PageScaffold
import com.zoonk.android.ui.theme.zoonk
import com.zoonk.api.models.ChapterLesson
import com.zoonk.api.models.ChapterMindMap
import com.zoonk.api.models.FeedbackSubmissionContext
import com.zoonk.api.models.GoalChapter
import com.zoonk.api.models.LearnerSummaryGoal
import com.zoonk.api.models.MapSkill
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.util.UUID

@Composable
fun ChapterScreen(
    route: AppRoute.Chapter,
    app: AppContainer,
    navigator: AppNavigator,
) {
    val chapterId = runCatching { UUID.fromString(route.chapterId) }.getOrNull()

    WithPlanGoal(app.learnerSummary.summary, navigator) { goal ->
        when {
            chapterId == null -> {
                PageScaffold(onBack = { navigator.back() }) {
                    NotFoundMessage(onGoHome = { navigator.showRoot(AppTab.Today) }, Modifier.padding(it))
                }
            }

            // A language's chapters are its units: drawn here too, as main does, so a link never redirects.
            goal.kind == LearnerSummaryGoal.Kind.LANGUAGE -> {
                RoutePlaceholder(AppRoute.LanguageUnit(route.chapterId), app, navigator)
            }

            else -> {
                val key = ChapterKey(goal.id, chapterId)
                ChapterContent(
                    key = key,
                    store = app.goalContent,
                    navigator = navigator,
                    menu = {
                        ReportProblemMenu(
                            app,
                            FeedbackTarget(
                                screen = "chapter",
                                contentKind = FeedbackSubmissionContext.ContentKind.CHAPTER,
                                contentId = chapterId,
                            ),
                        )
                    },
                    ask = { AskTutor(TutorScope.Chapter(route.chapterId), app, navigator, appearance = it) },
                    mindMap = {
                        val map by app.mindMaps.chapter[key].collectShown()
                        map.value?.let { MindMapSlot(it) { ChapterMindMapCard(it, key, app, navigator) } }
                    },
                )
            }
        }
    }
}

/** The chapter's mind map, and its card where the page shows it. */
internal class MindMapSlot(
    val map: ChapterMindMap,
    val card: @Composable () -> Unit,
)

@Composable
internal fun ChapterContent(
    key: ChapterKey,
    store: GoalContentStore,
    navigator: AppNavigator,
    menu: @Composable () -> Unit = {},
    ask: (@Composable (AskTutorAppearance) -> Unit)? = null,
    mindMap: @Composable () -> MindMapSlot? = { null },
) {
    val resource = store.chapter[key]
    val state by resource.collectShown()
    val scope = rememberCoroutineScope()
    val back: () -> Unit = { navigator.back() }

    when (val shown = state) {
        is LoadState.Loaded -> {
            val practice = viewModel(key = "chapter-${key.goalId}-${key.chapterId}") { ChapterViewModel(store, key) }
            val practiceState by practice.state.collectAsStateWithLifecycle()
            val opened = (practiceState.outcome as? PracticeOutcome.Opened)?.route

            LaunchedEffect(opened) {
                if (opened != null) {
                    practice.consumeOpened()
                    navigator.open(opened)
                }
            }

            ChapterPage(
                chapter = shown.value,
                practice = practiceState,
                menu = menu,
                ask = ask,
                mindMap = mindMap(),
                actions =
                    ChapterActions(
                        back = back,
                        openLesson = { navigator.open(AppRoute.Lesson(it.toString())) },
                        testOut = { navigator.open(AppRoute.TestOut(key.chapterId.toString())) },
                        practice = practice::practice,
                    ),
            )
        }

        is LoadState.Failed -> {
            PageScaffold(onBack = back) { padding ->
                if (shown.error == ApiError.NotFound) {
                    NotFoundMessage(onGoHome = { navigator.showRoot(AppTab.Today) }, Modifier.padding(padding))
                } else {
                    LoadFailedMessage(onRetry = { scope.launch { resource.refresh() } }, modifier = Modifier.padding(padding))
                }
            }
        }

        LoadState.Empty -> {
            PageScaffold(onBack = back) { NotFoundMessage(onGoHome = { navigator.showRoot(AppTab.Today) }, Modifier.padding(it)) }
        }

        LoadState.Idle, LoadState.Loading -> {
            PageScaffold(onBack = back) { PageLoading(it) }
        }
    }
}

internal data class ChapterActions(
    val back: () -> Unit,
    val openLesson: (UUID) -> Unit,
    val testOut: () -> Unit,
    val practice: () -> Unit,
)

internal data class PracticeState(
    val running: Boolean = false,
    val outcome: PracticeOutcome? = null,
)

internal class ChapterViewModel(
    private val store: GoalContentStore,
    private val key: ChapterKey,
) : ViewModel() {
    private val practiceState = MutableStateFlow(PracticeState())
    val state: StateFlow<PracticeState> = practiceState.asStateFlow()

    fun practice() {
        if (practiceState.value.running) return
        practiceState.value = PracticeState(running = true)
        viewModelScope.launch { practiceState.value = PracticeState(outcome = store.practice(key)) }
    }

    fun consumeOpened() {
        practiceState.update { it.copy(outcome = null) }
    }
}

@Composable
internal fun ChapterPage(
    chapter: GoalChapter,
    practice: PracticeState,
    actions: ChapterActions,
    menu: @Composable () -> Unit = {},
    ask: (@Composable (AskTutorAppearance) -> Unit)? = null,
    mindMap: MindMapSlot? = null,
) {
    val reference = mindMap?.takeIf { it.map.status != ChapterMindMap.Status.UNAVAILABLE }
    val lessons = remember(chapter.lessons) { chapter.lessons.map { it.listed() } }

    DetailPage(
        title = chapter.chapter.title,
        onBack = actions.back,
        hero = { ChapterHero(chapter, actions, it) },
        ask = ask,
        menu = menu,
        aside = {
            ChapterProgress(lessons)
            ChapterPractice(chapter, practice, actions)
            ChapterReference(chapter, reference)
        },
    ) { asideBeside ->
        if (lessons.isNotEmpty()) {
            item(key = "lessons", contentType = "lessons") {
                LessonList(lessons, upNext = true, onOpen = actions.openLesson, modifier = Modifier.padding(top = SECTION_GAP))
            }
        }

        if (!asideBeside) {
            item(
                key = "practice",
                contentType = "practice",
            ) { ChapterPractice(chapter, practice, actions, Modifier.padding(top = SECTION_GAP)) }
            item(key = "reference", contentType = "reference") { ChapterReference(chapter, reference, Modifier.padding(top = SECTION_GAP)) }
        }
    }
}

private fun ChapterLesson.listed() =
    ListedLesson(
        id = lessonId,
        title = title,
        minutes = minutes.toInt(),
        done = state == ChapterLesson.State.DONE,
        next = state == ChapterLesson.State.NEXT,
        plusRequired = plusRequired,
    )

@Composable
private fun ChapterHero(
    chapter: GoalChapter,
    actions: ChapterActions,
    onTitlePlaced: (LayoutCoordinates) -> Unit,
) {
    val locale = currentLocale()
    val lessons = chapter.lessons
    val done = lessons.count { it.state == ChapterLesson.State.DONE }
    val next = lessons.firstOrNull { it.state == ChapterLesson.State.NEXT }
    val number = formatNumber(chapter.chapter.position.toDouble(), locale)
    val subject = chapter.chapter.subject
    val minutes = lessons.sumOf { it.minutes }.toInt()
    val facts =
        if (lessons.isEmpty()) {
            null
        } else {
            listOfNotNull(
                pluralStringResource(R.plurals.goalcontent_lesson_count, lessons.size, lessons.size),
                minutes.takeIf { it > 0 }?.let { formatMinutes(it, locale) },
                percentDone(done.toDouble() / lessons.size),
            ).joinToString(" · ")
        }

    val action: (@Composable (Modifier) -> Unit)? =
        next?.let { { modifier -> ContinueButton(started = done > 0, onClick = { actions.openLesson(it.lessonId) }, modifier) } }

    DetailHero(action) {
        Text(
            text =
                if (subject == null) {
                    stringResource(R.string.goalcontent_chapter_number, number)
                } else {
                    stringResource(R.string.goalcontent_subject_chapter, subject.name, number)
                },
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            style = MaterialTheme.typography.labelLarge,
        )
        Text(
            text = chapter.chapter.title,
            modifier =
                Modifier.onGloballyPositioned(onTitlePlaced).semantics {
                    heading()
                },
            style = MaterialTheme.typography.titleLarge,
        )
        if (facts != null) Text(text = facts, color = MaterialTheme.colorScheme.onSurfaceVariant, style = factsStyle())
    }
}

@Composable
private fun ChapterProgress(lessons: List<ListedLesson>) {
    if (lessons.isEmpty()) return

    val locale = currentLocale()

    AsideSection(
        title = stringResource(R.string.goalcontent_progress),
        detail =
            stringResource(
                R.string.goalcontent_count_of,
                formatNumber(lessons.count { it.done }.toDouble(), locale),
                formatNumber(lessons.size.toDouble(), locale),
            ),
    ) { LessonProgress(lessons, Modifier.padding(horizontal = PAGE_PADDING)) }
}

@Composable
private fun ChapterPractice(
    chapter: GoalChapter,
    practice: PracticeState,
    actions: ChapterActions,
    modifier: Modifier = Modifier,
) {
    val canTestOut = chapter.testOut.available
    val mistakes = chapter.mistakes.open > 0
    if (!canTestOut && !mistakes) return

    Column(modifier, verticalArrangement = Arrangement.spacedBy(8.dp)) {
        SectionHeader(stringResource(R.string.goalcontent_practice), Modifier.padding(horizontal = LIST_ITEM_INSET))
        Column {
            if (canTestOut) TestOutRow(TestOutScope.Chapter, onOpen = actions.testOut, plusRequired = chapter.testOut.plusRequired)
            if (mistakes) {
                if (canTestOut) HorizontalDivider()
                PracticeChapterRow(practice, onPractice = actions.practice)
            }
        }
    }
}

@Composable
private fun PracticeChapterRow(
    practice: PracticeState,
    onPractice: () -> Unit,
) {
    ListItem(
        headlineContent = { Text(stringResource(R.string.goalcontent_practice_chapter)) },
        modifier = Modifier.clickable(enabled = !practice.running, onClick = onPractice),
        leadingContent = { KindDotLeading(LearnKind.Practice) },
        colors =
            ListItemDefaults.colors(
                containerColor = Color.Transparent,
                headlineColor = if (practice.running) MaterialTheme.colorScheme.onSurfaceVariant else MaterialTheme.colorScheme.onSurface,
            ),
    )
    practiceMessage(practice.outcome)?.let {
        Text(
            text = it,
            modifier =
                Modifier.padding(horizontal = LIST_ITEM_INSET).padding(bottom = 12.dp).semantics {
                    liveRegion = LiveRegionMode.Polite
                },
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            style = MaterialTheme.typography.bodyMedium,
        )
    }
}

@Composable
private fun practiceMessage(outcome: PracticeOutcome?): String? =
    when (outcome) {
        PracticeOutcome.DailyCap -> stringResource(R.string.goalcontent_practice_daily_cap)
        PracticeOutcome.NothingToPractice -> stringResource(R.string.goalcontent_practice_nothing)
        PracticeOutcome.Failed -> stringResource(R.string.goalcontent_practice_failed)
        is PracticeOutcome.Opened, null -> null
    }

/** What the chapter leaves for reference once its lessons are done: its skills and their summaries. */
@Composable
private fun ChapterReference(
    chapter: GoalChapter,
    mindMap: MindMapSlot?,
    modifier: Modifier = Modifier,
) {
    val hasSummary = chapter.skills.isNotEmpty() || chapter.summaries.isNotEmpty()
    if (mindMap == null && !hasSummary) return

    var expanded by rememberSaveable { mutableStateOf(false) }

    Column(modifier) {
        SectionHeader(
            stringResource(R.string.goalcontent_for_reference),
            Modifier.padding(horizontal = PAGE_PADDING).padding(bottom = 12.dp),
        )
        mindMap?.card?.invoke()
        if (!hasSummary) return@Column
        if (mindMap != null) Spacer(Modifier.height(12.dp))
        DisclosureRow(
            stringResource(R.string.goalcontent_chapter_summary),
            expanded = expanded,
            onExpandedChange = { expanded = it },
            leading = { Icon(painterResource(R.drawable.ic_checklist), contentDescription = null) },
        ) {
            Column(verticalArrangement = Arrangement.spacedBy(20.dp)) {
                if (chapter.skills.isNotEmpty()) {
                    Column {
                        SectionLabel(stringResource(R.string.goalcontent_skills), Modifier.padding(bottom = 4.dp))
                        chapter.skills.forEach { SkillRow(it) }
                    }
                }
                LessonSummaries(chapter.summaries.map { LessonSummary(it.title, it.ideas) })
            }
        }
    }
}

@Composable
private fun SkillRow(skill: MapSkill) {
    Row(
        modifier = Modifier.fillMaxWidth().heightIn(min = 44.dp).padding(vertical = 8.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Box(Modifier.size(markSize()), contentAlignment = Alignment.Center) { SkillDot(skill.state) }
        Text(skill.name, modifier = Modifier.weight(1f), style = MaterialTheme.typography.bodyMedium)
        Text(
            text = if (skill.fading) stringResource(R.string.goalcontent_to_review) else skillStateLabel(skill.state),
            color = if (skill.fading) MaterialTheme.zoonk.warningText else MaterialTheme.colorScheme.onSurfaceVariant,
            style = MaterialTheme.typography.bodySmall,
        )
    }
}

/** Mastered blue, solid in ink, learning a blue ring (on its way), new faint: the words say the same. */
@Composable
private fun SkillDot(state: MapSkill.State) {
    val modifier = Modifier.size(8.dp)
    val tertiary = MaterialTheme.colorScheme.tertiary
    when (state) {
        MapSkill.State.MASTERED -> FilledDot(tertiary, modifier)
        MapSkill.State.SOLID -> FilledDot(MaterialTheme.colorScheme.onSurface, modifier)
        MapSkill.State.LEARNING -> Box(modifier.border(1.5.dp, tertiary, CircleShape))
        MapSkill.State.NEW -> FilledDot(MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = NEW_ALPHA), modifier)
    }
}

@Composable
private fun skillStateLabel(state: MapSkill.State) =
    stringResource(
        when (state) {
            MapSkill.State.LEARNING -> R.string.goalcontent_skill_learning
            MapSkill.State.SOLID -> R.string.goalcontent_skill_solid
            MapSkill.State.MASTERED -> R.string.goalcontent_skill_mastered
            MapSkill.State.NEW -> R.string.goalcontent_new
        },
    )

private const val NEW_ALPHA = 0.4f
