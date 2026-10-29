package com.zoonk.android.feature.goalcontent

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyListScope
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.LayoutCoordinates
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.heading
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
import com.zoonk.android.data.MutationResult
import com.zoonk.android.data.Resource
import com.zoonk.android.data.collectShown
import com.zoonk.android.data.value
import com.zoonk.android.feature.feedback.FeedbackTarget
import com.zoonk.android.feature.feedback.ReportProblemMenu
import com.zoonk.android.feature.plan.PlanOp
import com.zoonk.android.feature.plan.PlanStore
import com.zoonk.android.feature.tutor.AskTutor
import com.zoonk.android.feature.tutor.AskTutorAppearance
import com.zoonk.android.feature.tutor.TutorScope
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.ui.components.LoadFailedMessage
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatPercent
import com.zoonk.android.ui.scaffold.PageScaffold
import com.zoonk.api.models.ExamDocument
import com.zoonk.api.models.Syllabus
import com.zoonk.api.models.SyllabusChapter
import com.zoonk.api.models.SyllabusSubject
import com.zoonk.api.models.WrittenPractice
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.time.LocalDate
import java.util.UUID
import kotlin.math.roundToInt

@Composable
fun SubjectScreen(
    route: AppRoute.Subject,
    app: AppContainer,
    navigator: AppNavigator,
) {
    WithPlanGoal(app.learnerSummary.summary, navigator) { goal ->
        SubjectContent(
            goalId = goal.id,
            subjectKey = route.subjectKey,
            syllabus = app.plans.syllabus[goal.id],
            plans = app.plans,
            navigator = navigator,
            menu = { ReportProblemMenu(app, FeedbackTarget(screen = "subject")) },
            ask = { AskTutor(TutorScope.Subject(goal.id.toString(), route.subjectKey), app, navigator, appearance = it) },
            mindMapChapters = {
                val maps by app.mindMaps.list[goal.id].collectShown()
                maps.value
                    ?.chapters
                    ?.mapTo(mutableSetOf()) { it.chapterId }
                    .orEmpty()
            },
        )
    }
}

@Composable
internal fun SubjectContent(
    goalId: UUID,
    subjectKey: String,
    syllabus: Resource<Syllabus>,
    plans: PlanStore,
    navigator: AppNavigator,
    menu: @Composable () -> Unit = {},
    ask: (@Composable (AskTutorAppearance) -> Unit)? = null,
    mindMapChapters: @Composable () -> Set<UUID> = { emptySet() },
) {
    val back: () -> Unit = { navigator.back() }
    val state by syllabus.collectShown()
    val withMindMaps = mindMapChapters()
    val scope = rememberCoroutineScope()

    when (val shown = state) {
        is LoadState.Loaded -> {
            val subject = shown.value.subjects.firstOrNull { it.key == subjectKey }
            if (subject == null) {
                PageScaffold(onBack = back) { PageNotFound(navigator, it) }
            } else {
                val writes = viewModel(key = "subject-$goalId") { SubjectViewModel(plans, syllabus, goalId) }
                SubjectPage(
                    syllabus = shown.value,
                    subject = subject,
                    writes = writes.state.collectAsStateWithLifecycle().value,
                    menu = menu,
                    ask = ask,
                    actions =
                        SubjectActions(
                            back = back,
                            openChapter = { navigator.open(AppRoute.Chapter(it.toString())) },
                            adjustPlan = { navigator.open(AppRoute.Plan()) },
                            restore = writes::restore,
                            setCadence = writes::setCadence,
                            openMindMaps =
                                { navigator.open(AppRoute.MindMaps(subject = subject.key)) }.takeIf {
                                    subject.chapters.any { it.chapterId in withMindMaps }
                                },
                        ),
                )
            }
        }

        is LoadState.Failed -> {
            PageScaffold(onBack = back) { padding ->
                if (shown.error == ApiError.NotFound) {
                    PageNotFound(navigator, padding)
                } else {
                    LoadFailedMessage(onRetry = { scope.launch { syllabus.refresh() } }, modifier = Modifier.padding(padding))
                }
            }
        }

        LoadState.Empty -> {
            PageScaffold(onBack = back) { PageNotFound(navigator, it) }
        }

        LoadState.Idle, LoadState.Loading -> {
            PageScaffold(onBack = back) { PageLoading(it) }
        }
    }
}

/** What the page's taps do; [openFarTopic] shows a far topic's lessons, written on the learner's tap. */
internal data class SubjectActions(
    val back: () -> Unit,
    val openChapter: (UUID) -> Unit,
    val adjustPlan: () -> Unit,
    val restore: (List<String>) -> Unit,
    val setCadence: (WrittenPractice.Cadence) -> Unit,
    val openFarTopic: ((SyllabusChapter) -> Unit)? = null,
    val openMindMaps: (() -> Unit)? = null,
)

internal data class SubjectWrites(
    val restoring: Boolean = false,
    val restoreFailed: Boolean = false,
    val tappedCadence: WrittenPractice.Cadence? = null,
    val cadenceFailed: Boolean = false,
)

/** The plan changes a subject's page makes, shown until the syllabus read after them lands. */
internal class SubjectViewModel(
    private val plans: PlanStore,
    private val syllabus: Resource<Syllabus>,
    private val goalId: UUID,
) : ViewModel() {
    private val writes = MutableStateFlow(SubjectWrites())
    val state: StateFlow<SubjectWrites> = writes.asStateFlow()

    fun restore(areas: List<String>) {
        if (writes.value.restoring) return
        writes.update { it.copy(restoring = true, restoreFailed = false) }
        viewModelScope.launch {
            val result = change(PlanOp.RestoreAreas(areas))
            writes.update { it.copy(restoring = false, restoreFailed = result is MutationResult.Failed) }
        }
    }

    fun setCadence(cadence: WrittenPractice.Cadence) {
        if (writes.value.tappedCadence != null) return
        writes.update { it.copy(tappedCadence = cadence, cadenceFailed = false) }
        viewModelScope.launch {
            val result = change(PlanOp.WrittenCadence(cadence.value))
            writes.update { it.copy(tappedCadence = null, cadenceFailed = result is MutationResult.Failed) }
        }
    }

    private suspend fun change(operation: PlanOp): MutationResult<*> {
        val result = plans.change(goalId, listOf(operation))
        if (result is MutationResult.Done) syllabus.refresh()
        return result
    }
}

@Composable
internal fun SubjectPage(
    syllabus: Syllabus,
    subject: SyllabusSubject,
    writes: SubjectWrites,
    actions: SubjectActions,
    today: LocalDate = LocalDate.now(),
    menu: @Composable () -> Unit = {},
    ask: (@Composable (AskTutorAppearance) -> Unit)? = null,
) {
    DetailPage(
        title = subject.name,
        onBack = actions.back,
        hero = { SubjectHero(syllabus, subject, actions, it) },
        aside = { SubjectAside(syllabus, subject, today, actions.openMindMaps, ask) },
        ask = ask,
        askInAside = true,
        menu = menu,
    ) { asideBeside ->
        if (!asideBeside && (subject.notPlannedReason == null || subject.preparation != null)) {
            item(key = "coverage", contentType = "coverage") {
                SubjectCoverage(subject, labelled = true, modifier = Modifier.padding(top = 20.dp))
            }
        }

        item(key = "not-planned", contentType = "notice") { NotPlannedNotice(subject, writes, actions) }
        item(key = "written", contentType = "written") { SubjectWrittenPractice(syllabus, subject, writes, actions) }

        subjectChapters(subject, today, actions)

        if (subject.topics.isNotEmpty()) subjectTopics(syllabus, subject, actions)

        subjectMatrix(subject.matrix)

        val openMindMaps = actions.openMindMaps
        if (!asideBeside && openMindMaps != null) {
            item(key = "also", contentType = "also") {
                AsideSection(stringResource(R.string.goalcontent_also), Modifier.padding(top = SECTION_GAP)) { MindMapsRow(openMindMaps) }
            }
        }
    }
}

@Composable
private fun SubjectHero(
    syllabus: Syllabus,
    subject: SyllabusSubject,
    actions: SubjectActions,
    onTitlePlaced: (LayoutCoordinates) -> Unit,
) {
    val next = subject.nextChapterId
    val action: (@Composable (Modifier) -> Unit)? =
        next?.let { { modifier -> ContinueButton(started = subject.lessonsDone > 0, onClick = { actions.openChapter(it) }, modifier) } }

    DetailHero(action) {
        Text(
            text = subjectEyebrow(syllabus, subject),
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            style = MaterialTheme.typography.labelLarge,
        )
        Text(
            text = subject.name,
            modifier =
                Modifier.onGloballyPositioned(onTitlePlaced).semantics {
                    heading()
                },
            style = MaterialTheme.typography.titleLarge,
        )

        subjectFacts(subject)?.let { Text(text = it, color = MaterialTheme.colorScheme.onSurfaceVariant, style = factsStyle()) }
        knownLine(subject)?.let {
            Text(text = it, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodyMedium)
        }
    }
}

@Composable
internal fun factsStyle() = MaterialTheme.typography.bodyMedium.copy(fontFeatureSettings = "tnum")

@Composable
private fun subjectEyebrow(
    syllabus: Syllabus,
    subject: SyllabusSubject,
): String {
    val kind =
        when {
            subject.group != null -> subject.group
            subject.source == SyllabusSubject.Source.NOTICE && syllabus.fromMaterial -> stringResource(R.string.goalcontent_from_material)
            subject.source == SyllabusSubject.Source.NOTICE -> stringResource(R.string.goalcontent_subject)
            syllabus.kind != Syllabus.Kind.NOTICE -> stringResource(R.string.goalcontent_module)
            else -> beyondGroupName(syllabus)
        }
    val questions = subject.questions
    val share = subject.share
    val weight =
        when {
            questions != null && questions > 0 -> {
                pluralStringResource(R.plurals.goalcontent_question_count, questions.toInt(), questions.toInt())
            }

            share != null -> {
                stringResource(R.string.goalcontent_share_of_exam, formatPercent(share, currentLocale()))
            }

            else -> {
                null
            }
        }
    return listOfNotNull(kind, weight).joinToString(" · ")
}

/** The group a plan adds outside the learner's material or the exam's own documents. */
@Composable
internal fun beyondGroupName(syllabus: Syllabus): String =
    stringResource(
        when {
            syllabus.fromMaterial -> R.string.goalcontent_also_in_plan
            syllabus.examDocument == ExamDocument.NOTICE -> R.string.goalcontent_beyond_notice
            else -> R.string.goalcontent_beyond_guide
        },
    )

@Composable
private fun subjectFacts(subject: SyllabusSubject): String? {
    val inLessons = subject.notPlannedReason == null && subject.preparation == null
    val facts =
        listOfNotNull(
            subject.topics.size
                .takeIf { it > 0 }
                ?.let { pluralStringResource(R.plurals.goalcontent_topic_count, it, it) },
            subject.chapters.size
                .takeIf { it > 0 }
                ?.let { pluralStringResource(R.plurals.goalcontent_chapter_count, it, it) },
            if (inLessons) percentDone(subject.bar.share) else null,
        )
    return facts.takeIf { it.isNotEmpty() }?.joinToString(" · ")
}

@Composable
internal fun percentDone(share: Double): String =
    stringResource(R.string.goalcontent_percent_done, (share.coerceIn(0.0, 1.0) * PERCENT).roundToInt())

@Composable
internal fun knownLine(subject: SyllabusSubject): String? {
    val topicsKnown = subject.topicsKnown
    return when {
        topicsKnown != null && subject.topics.isNotEmpty() -> {
            topicsKnown.toInt().takeIf { it > 0 }?.let { pluralStringResource(R.plurals.goalcontent_topics_known_skipped, it, it) }
        }

        subject.lessonsKnown > 0 -> {
            pluralStringResource(R.plurals.goalcontent_lessons_known_skipped, subject.lessonsKnown.toInt(), subject.lessonsKnown.toInt())
        }

        else -> {
            null
        }
    }
}

internal fun LazyListScope.sectionTitle(
    key: String,
    title: @Composable () -> String,
    detail: @Composable () -> String? = { null },
) {
    item(key = key, contentType = "section-title") {
        SectionTitle(title(), Modifier.padding(top = SECTION_GAP, bottom = 4.dp), detail = detail())
    }
}

private const val PERCENT = 100
