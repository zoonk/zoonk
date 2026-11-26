package com.zoonk.android.feature.goalcontent

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyListScope
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
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
import com.zoonk.android.data.MutationResult
import com.zoonk.android.data.Resource
import com.zoonk.android.data.Visit
import com.zoonk.android.data.collectShown
import com.zoonk.android.data.value
import com.zoonk.android.feature.feedback.FeedbackTarget
import com.zoonk.android.feature.feedback.ReportProblemMenu
import com.zoonk.android.feature.feedback.rememberReportProblem
import com.zoonk.android.feature.plan.FarTopic
import com.zoonk.android.feature.plan.FarTopicSheet
import com.zoonk.android.feature.plan.FarTopicViewModel
import com.zoonk.android.feature.plan.PlanOp
import com.zoonk.android.feature.plan.PlanStore
import com.zoonk.android.feature.plan.optionalStudyLabel
import com.zoonk.android.feature.tutor.AskTutor
import com.zoonk.android.feature.tutor.AskTutorAppearance
import com.zoonk.android.feature.tutor.TutorScope
import com.zoonk.android.feature.writing.ChooseOnToday
import com.zoonk.android.feature.writing.gradingReturnsLine
import com.zoonk.android.feature.writing.toName
import com.zoonk.android.feature.writing.writingTaskName
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.navigation.AppTab
import com.zoonk.android.ui.VisitOf
import com.zoonk.android.ui.components.Button
import com.zoonk.android.ui.components.ButtonSize
import com.zoonk.android.ui.components.Facts
import com.zoonk.android.ui.components.LoadFailedMessage
import com.zoonk.android.ui.components.NotFoundMessage
import com.zoonk.android.ui.components.PageLoading
import com.zoonk.android.ui.components.SectionHeader
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatMinutes
import com.zoonk.android.ui.format.formatPercent
import com.zoonk.android.ui.scaffold.PageScaffold
import com.zoonk.android.ui.scaffold.ResourceScaffold
import com.zoonk.android.ui.scaffold.pageTitle
import com.zoonk.android.ui.theme.zoonkType
import com.zoonk.api.models.LearnerSummaryGoal
import com.zoonk.api.models.Syllabus
import com.zoonk.api.models.SyllabusChapter
import com.zoonk.api.models.SyllabusSubject
import com.zoonk.api.models.WrittenPractice
import com.zoonk.api.models.WrittenPracticeSubjectsInner
import com.zoonk.api.models.WrittenPracticeSubjectsInnerAvailability
import com.zoonk.api.models.WrittenPracticeSubjectsInnerWriteActionsInner
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.datetime.toJavaLocalDate
import java.time.LocalDate
import java.util.UUID
import kotlin.math.roundToInt
import com.zoonk.api.models.WrittenPracticeSubjectsInnerWriteActionsInnerAvailability as WriteAvailability

@Composable
fun SubjectScreen(
    route: AppRoute.Subject,
    app: AppContainer,
    navigator: AppNavigator,
) {
    WithPlanGoal(app.learnerSummary.summary, navigator) { goal ->
        val report = rememberReportProblem(app, FeedbackTarget(screen = "subject"))
        val summary by app.learnerSummary.summary.collectShown()

        SubjectContent(
            goalId = goal.id,
            subjectKey = route.subjectKey,
            syllabus = app.plans.syllabus[goal.id],
            plans = app.plans,
            navigator = navigator,
            menu = { ReportProblemMenu(report) },
            ask = {
                AskTutor(
                    TutorScope.Subject(goal.id.toString(), route.subjectKey, module = goal.kind != LearnerSummaryGoal.Kind.EXAM),
                    app,
                    navigator,
                    appearance = it,
                )
            },
            mindMaps = summary.value?.places?.mindMaps == true,
            writeNow = rememberWriteNow(app, goal.id, navigator),
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
    menu: (@Composable () -> Unit)? = null,
    ask: (@Composable (AskTutorAppearance) -> Unit)? = null,
    mindMaps: Boolean = false,
    writeNow: WriteNow? = null,
) {
    val back: () -> Unit = { navigator.back() }
    val state by syllabus.collectShown()
    val scope = rememberCoroutineScope()

    ResourceScaffold(
        state,
        onBack = back,
        onRetry = { scope.launch { syllabus.refresh() } },
        onGoHome = { navigator.showRoot(AppTab.Today) },
    ) { value ->
        val subject = value.subjects.firstOrNull { it.key == subjectKey }
        if (subject == null) {
            PageScaffold(onBack = back) { NotFoundMessage(onGoHome = { navigator.showRoot(AppTab.Today) }, Modifier.padding(it)) }
        } else {
            val writes = viewModel(key = "subject-$goalId") { SubjectViewModel(plans, syllabus, goalId) }
            VisitOf(writes.visit)
            val farTopics = viewModel(key = "far-topics-$goalId") { FarTopicViewModel(plans, goalId) }
            SubjectPage(
                syllabus = value,
                subject = subject,
                writes = writes.state,
                menu = menu,
                ask = ask,
                actions =
                    SubjectActions(
                        back = back,
                        openChapter = { navigator.open(AppRoute.Chapter(it.toString())) },
                        adjustPlan = { navigator.open(AppRoute.Plan()) },
                        restore = writes::restore,
                        setCadence = writes::setCadence,
                        openFarTopic = { chapter ->
                            chapter.skillId?.let {
                                farTopics.open(
                                    FarTopic(it, chapter.title, chapter.plannedLessons, chapter.nextDate),
                                )
                            }
                        },
                        openMindMaps = { navigator.open(AppRoute.MindMaps(subject = subject.key)) }.takeIf { mindMaps },
                        openAnswer = { navigator.open(AppRoute.WritingAnswer(it.toString())) },
                        openEssay = { navigator.open(AppRoute.Essay(it.toString())) },
                        writeNow = writeNow,
                        openToday = { navigator.showRoot(AppTab.Today) },
                    ),
            )
            FarTopicSheet(farTopics, navigator) { navigator.open(AppRoute.Chapter(it.toString())) }
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
    val openAnswer: (UUID) -> Unit = {},
    /** An unfinished written task the learner asked for. */
    val openEssay: (UUID) -> Unit = {},
    /** A written part's main action: writing, since its lessons are a small part of its time. */
    val writeNow: WriteNow? = null,
    /** Today asks the exam's open choices, which a written task can wait for. */
    val openToday: () -> Unit = {},
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
    /** The subject's visit: a change that didn't save says so only on it. */
    val visit = Visit()

    private var restoring by mutableStateOf(false)
    private var tappedCadence by mutableStateOf<WrittenPractice.Cadence?>(null)
    private val restoreFailure = visit.outcome<Unit>()
    private val cadenceFailure = visit.outcome<Unit>()

    /** What's saving, and what didn't save on this visit. */
    val state get() = SubjectWrites(restoring, restoreFailure.value != null, tappedCadence, cadenceFailure.value != null)

    fun restore(areas: List<String>) {
        if (restoring) return
        restoring = true
        restoreFailure.clear()
        val started = visit.number
        viewModelScope.launch {
            if (change(PlanOp.RestoreAreas(areas)) is MutationResult.Failed) restoreFailure.send(started, Unit)
            restoring = false
        }
    }

    fun setCadence(cadence: WrittenPractice.Cadence) {
        if (tappedCadence != null) return
        tappedCadence = cadence
        cadenceFailure.clear()
        val started = visit.number
        viewModelScope.launch {
            if (change(PlanOp.WrittenCadence(cadence.value)) is MutationResult.Failed) cadenceFailure.send(started, Unit)
            tappedCadence = null
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
    menu: (@Composable () -> Unit)? = null,
    ask: (@Composable (AskTutorAppearance) -> Unit)? = null,
) {
    val written = writtenSubject(syllabus.writtenPractice, subject)
    val writeNow = actions.writeNow.takeIf { written != null }
    DetailPage(
        title = subject.shortName,
        onBack = actions.back,
        hero = { SubjectHero(syllabus, subject, written) },
        aside = { SubjectAside(syllabus, subject, today, written) },
        ask = ask,
        menu = menu,
        action =
            if (writeNow != null && written != null) {
                { modifier -> WriteButton(writeNow, written, actions.openEssay, actions.openToday, modifier) }
            } else {
                subject.nextChapterId?.let { next ->
                    { modifier -> ContinueButton(started = subject.lessonsDone > 0, onClick = { actions.openChapter(next) }, modifier) }
                }
            },
    ) { asideBeside ->
        // A written part's headline is where it stands in points or levels: lessons are a small part of its time.
        if (!asideBeside && written == null && (subject.notPlannedReason == null || subject.preparation != null)) {
            item(key = "coverage", contentType = "coverage") {
                SubjectCoverage(subject, labelled = true, modifier = Modifier.padding(top = 20.dp))
            }
        }

        item(key = "not-planned", contentType = "notice") { NotPlannedNotice(subject, module = !syllabus.isExam, writes, actions) }
        subjectCovers(subject.covers)
        written?.let { subjectWritten(it, actions.openAnswer, standing = !asideBeside) }

        subjectChapters(subject, today, actions)

        item(key = "written", contentType = "written") { SubjectWrittenPractice(syllabus, subject, writes, actions) }

        if (subject.topics.isNotEmpty()) subjectTopics(syllabus, subject, actions)

        subjectMatrix(subject.matrix)
    }
}

@Composable
private fun SubjectHero(
    syllabus: Syllabus,
    subject: SyllabusSubject,
    written: WrittenPracticeSubjectsInner?,
) {
    DetailHero {
        Text(
            text = subject.shortName,
            modifier = Modifier.pageTitle(),
            style = MaterialTheme.typography.headlineMedium,
        )

        (if (written != null) writtenFacts(written) else subjectLead(syllabus, subject) + subjectFacts(subject))
            .takeIf { it.isNotEmpty() }
            ?.let { Facts(it) }
        listOfNotNull(knownLine(subject), alsoInLine(syllabus.sharedExams, subject.sharedWith)).forEach {
            Text(text = it, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodyMedium)
        }
    }
}

/** A written test's own facts, as its notice states them: "2 questions · 3 hr 30 min · 50% of the score". */
@Composable
private fun writtenFacts(written: WrittenPracticeSubjectsInner): List<String> {
    val locale = currentLocale()
    val questions = written.questions?.toInt()
    return listOfNotNull(
        questions?.let { pluralStringResource(R.plurals.goalcontent_written_questions, it, it) },
        written.minutes?.let { formatMinutes(it.toInt(), locale) },
        written.share?.let { stringResource(R.string.goalcontent_written_share, formatPercent(it, locale)) },
    )
}

@Composable
internal fun factsStyle() = MaterialTheme.zoonkType.data

/** What used to sit over the name leads its facts: its area, where it comes from when that's news, and its weight. */
@Composable
private fun subjectLead(
    syllabus: Syllabus,
    subject: SyllabusSubject,
): List<String> {
    val kind =
        when {
            subject.isExtra -> optionalStudyLabel(syllabus.hasNotice == true, syllabus.examDocument)
            subject.group != null -> subject.group
            subject.source == SyllabusSubject.Source.NOTICE && syllabus.fromMaterial -> stringResource(R.string.goalcontent_from_material)
            else -> null
        }
    val questions = subject.questions
    val share = subject.share
    // Details names the questions; the exam's share shows only where there are none.
    val weight =
        if ((questions == null || questions <= 0) && share != null) {
            stringResource(R.string.goalcontent_share_of_exam, formatPercent(share, currentLocale()))
        } else {
            null
        }
    return listOfNotNull(kind, weight)
}

@Composable
private fun subjectFacts(subject: SyllabusSubject): List<String> {
    val inLessons = subject.notPlannedReason == null && subject.preparation == null
    // Topics and chapters count themselves over their lists.
    return listOfNotNull(if (inLessons) percentDone(subject.bar.share) else null)
}

/** How much is done, as a whole percent; nothing until there is some, since "0% done" says nothing. */
@Composable
private fun percentDone(share: Double): String? =
    (share.coerceIn(0.0, 1.0) * PERCENT).roundToInt().takeIf { it > 0 }?.let { stringResource(R.string.goalcontent_percent_done, it) }

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

/** A write action's state, whichever variant the server sent. */
private val WrittenPracticeSubjectsInnerWriteActionsInner.status: String
    get() =
        when (val availability = availability) {
            is WriteAvailability.StudyBlockWritingAvailabilityOneOfValue -> availability.value.status.value
            is WriteAvailability.StudyBlockWritingAvailabilityOneOf1Value -> availability.value.status.value
            is WriteAvailability.WrittenPracticeSubjectsInnerAvailabilityValue -> availability.value.status.value
        }

private val WrittenPracticeSubjectsInnerWriteActionsInner.choiceGroups: List<String>
    get() =
        (availability as? WriteAvailability.WrittenPracticeSubjectsInnerAvailabilityValue)
            ?.value
            ?.choiceGroups
            .orEmpty()

/** The exam choices some of the part's tasks wait for, and whether every task does, so there's nothing to write until they're made. */
private data class PendingChoice(
    val all: Boolean,
    val groups: List<String>,
    /** The one task that waits when others don't. */
    val task: WrittenPracticeSubjectsInnerWriteActionsInner?,
)

private fun pendingChoice(written: WrittenPracticeSubjectsInner): PendingChoice? {
    val actions = written.writeActions.orEmpty()
    if (actions.isEmpty()) {
        return written.availability
            ?.takeIf { it.status == WrittenPracticeSubjectsInnerAvailability.Status.NEEDS_CHOICE }
            ?.let { PendingChoice(all = true, it.choiceGroups, task = null) }
    }
    val waiting = actions.filter { it.status == NEEDS_CHOICE }
    val groups = waiting.flatMap { it.choiceGroups }.distinct()
    if (groups.isEmpty()) return null
    return PendingChoice(all = waiting.size == actions.size, groups, waiting.singleOrNull())
}

/** When every task's grading is used up for today, the first day one returns. */
private fun returnsOn(actions: List<WrittenPracticeSubjectsInnerWriteActionsInner>): LocalDate? {
    val days =
        actions.map {
            (it.availability as? WriteAvailability.StudyBlockWritingAvailabilityOneOf1Value)
                ?.value
                ?.returnsOn
        }
    if (days.isEmpty() || days.any { it == null }) return null
    return days.filterNotNull().minOf { it.toJavaLocalDate() }
}

/**
 * A written part's main action is writing: an unfinished task opens where it was left, a task
 * waiting for an exam choice leads to Today, where it's made, and once the day's grading is used for
 * every task the bar says when it returns instead of offering a tap that would be refused.
 */
@Composable
private fun WriteButton(
    writeNow: WriteNow,
    written: WrittenPracticeSubjectsInner,
    openEssay: (UUID) -> Unit,
    openToday: () -> Unit,
    modifier: Modifier,
) {
    val actions = written.writeActions.orEmpty()
    val unfinished = actions.firstOrNull { it.status == CONTINUE }?.blockId

    if (unfinished != null) {
        Button(onClick = { openEssay(unfinished) }, modifier = modifier, size = ButtonSize.Large) {
            Text(stringResource(R.string.essay_continue))
        }
        return
    }
    val choice = pendingChoice(written)
    if (choice?.all == true) {
        Button(onClick = openToday, modifier = modifier, size = ButtonSize.Large) { Text(stringResource(R.string.essay_choose_on_today)) }
        return
    }
    val returns = returnsOn(actions)
    if (returns != null) {
        Row(
            modifier.heightIn(min = 48.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterHorizontally),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Icon(painterResource(R.drawable.ic_schedule), null, Modifier.size(16.dp), tint = MaterialTheme.colorScheme.onSurfaceVariant)
            Text(
                gradingReturnsLine(returns),
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                style = MaterialTheme.typography.bodyMedium,
            )
        }
        return
    }
    // The bar's modifier sizes the action within the bar, so it goes on the outermost piece.
    Column(modifier, verticalArrangement = Arrangement.spacedBy(8.dp)) {
        choice?.let { pending ->
            val task =
                pending.task?.let { only ->
                    writingTaskName(
                        only.writingTask?.toName(),
                        written.points.tasks
                            .firstOrNull { it.key == only.taskKey }
                            ?.name ?: only.taskKey,
                    )
                }
            ChooseOnToday(pending.groups, onChoose = openToday, task = task)
        }
        if (writeNow.failed) {
            Text(
                stringResource(R.string.essay_finish_failed),
                Modifier.semantics { liveRegion = LiveRegionMode.Assertive },
                color = MaterialTheme.colorScheme.error,
                style = MaterialTheme.typography.bodyMedium,
            )
        }
        Button(onClick = { writeNow.write(null) }, modifier = Modifier.fillMaxWidth(), busy = writeNow.busy, size = ButtonSize.Large) {
            Text(stringResource(R.string.essay_write))
        }
    }
}

internal fun LazyListScope.sectionTitle(
    key: String,
    title: @Composable () -> String,
    detail: @Composable () -> String? = { null },
    trailing: (@Composable () -> Unit)? = null,
) {
    item(key = key, contentType = "section-title") {
        val modifier = Modifier.padding(horizontal = PAGE_PADDING).padding(top = SECTION_GAP, bottom = 4.dp)
        if (trailing == null) {
            SectionHeader(title(), modifier, detail = detail())
        } else {
            SectionHeader(title(), modifier) {
                Row(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
                    detail()?.let { Text(it, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.zoonkType.data) }
                    trailing()
                }
            }
        }
    }
}

private const val PERCENT = 100
private const val CONTINUE = "continue"
private const val NEEDS_CHOICE = "needsChoice"
