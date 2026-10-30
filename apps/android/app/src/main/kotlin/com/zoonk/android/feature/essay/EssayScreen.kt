package com.zoonk.android.feature.essay

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.LocalTextStyle
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.VerticalDivider
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.paneTitle
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LifecycleEventEffect
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.zoonk.android.R
import com.zoonk.android.app.AppContainer
import com.zoonk.android.data.ApiError
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.LoadState
import com.zoonk.android.data.SessionState
import com.zoonk.android.data.collectShown
import com.zoonk.android.feature.mock.runner.StepDetail
import com.zoonk.android.feature.mock.runner.StepTitle
import com.zoonk.android.feature.player.leaveTaskFor
import com.zoonk.android.feature.practice.BusyButton
import com.zoonk.android.feature.practice.RunLoadFailed
import com.zoonk.android.feature.practice.RunLoading
import com.zoonk.android.feature.practice.RunNotFound
import com.zoonk.android.feature.practice.RunPage
import com.zoonk.android.feature.practice.SaveErrorText
import com.zoonk.android.feature.practice.runColumn
import com.zoonk.android.feature.questions.ItemText
import com.zoonk.android.feature.questions.NoteRow
import com.zoonk.android.feature.questions.QuestionTitle
import com.zoonk.android.feature.questions.isLongText
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.ui.components.LocalStepHeading
import com.zoonk.android.ui.components.OutlinedButton
import com.zoonk.android.ui.components.SectionHeader
import com.zoonk.android.ui.components.StepDots
import com.zoonk.android.ui.components.StepPagerActions
import com.zoonk.android.ui.components.TaskActionBar
import com.zoonk.android.ui.components.TaskActions
import com.zoonk.android.ui.components.rememberMoveFocus
import com.zoonk.android.ui.components.stepHeading
import com.zoonk.android.ui.scaffold.PageWithSupportingPane
import com.zoonk.android.ui.scaffold.TaskExitConfirmation
import com.zoonk.android.ui.scaffold.TaskScaffold
import com.zoonk.android.ui.scaffold.detailPagePadding
import com.zoonk.android.ui.scaffold.supportingPaneBeside
import com.zoonk.android.ui.theme.withTabularFigures
import com.zoonk.api.models.Essay
import com.zoonk.api.models.EssayGrade
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import java.util.UUID
import kotlin.time.Duration.Companion.seconds

@Composable
fun EssayScreen(
    route: AppRoute.Essay,
    app: AppContainer,
    navigator: AppNavigator,
) {
    val session by app.sessions.state.collectAsStateWithLifecycle()
    val signedIn = (session as? SessionState.SignedIn)?.session
    val close = navigator::closeTask
    val blockId = remember(route.blockId) { runCatching { UUID.fromString(route.blockId) }.getOrNull() }

    if (blockId == null) {
        RunNotFound(close)
        return
    }
    if (signedIn == null) {
        RunLoading(close)
        return
    }

    val scope = rememberCoroutineScope()
    val loaded by app.essays.essays[blockId].collectShown()
    when (val read = loaded) {
        is LoadState.Loaded -> {
            EssayLoaded(read.value, signedIn, app, navigator)
        }

        is LoadState.Failed -> {
            if (read.error == ApiError.NotFound) {
                RunNotFound(close)
            } else {
                RunLoadFailed(close, onRetry = { scope.launch { app.essays.essays[blockId].refresh() } })
            }
        }

        else -> {
            RunLoading(close)
        }
    }
}

@Composable
private fun EssayLoaded(
    essay: Essay,
    signedIn: AuthenticatedSession,
    app: AppContainer,
    navigator: AppNavigator,
) {
    val viewModel =
        viewModel(key = "essay:${essay.blockId}:${signedIn.localId}") {
            EssayViewModel(essay.blockId, essay.sessionId, app.essays, app.essays.unsentText(signedIn, essay.blockId), app.studyOpener)
        }
    val ui by viewModel.ui.collectAsStateWithLifecycle()
    val move by viewModel.move.collectAsStateWithLifecycle()

    LaunchedEffect(essay) { viewModel.arrive(essay) }
    LaunchedEffect(move.leaving) { move.leaving?.let(navigator::leaveTaskFor) }
    LifecycleEventEffect(Lifecycle.Event.ON_STOP) { viewModel.onStop() }

    val grade = ui.grade
    val finishing = ui.finishing || move.busy
    val finishFailed = ui.finishFailed || move.failed != null
    when {
        ui.drafts == null -> {
            RunLoading(navigator::closeTask)
        }

        ui.mode == EssayMode.Grade && grade != null -> {
            EssayGradeSteps(essay, grade, ui.finished, ui.switched, finishing, finishFailed, viewModel, navigator)
        }

        else -> {
            EssayWrite(essay, ui, finishing, finishFailed, viewModel, navigator)
        }
    }
}

@Composable
internal fun EssayWrite(
    essay: Essay,
    ui: EssayUi,
    finishing: Boolean,
    finishFailed: Boolean,
    viewModel: EssayViewModel,
    navigator: AppNavigator,
) {
    val rubric = EssayRubric.of(essay.rubric.value)
    val texts = essay.context?.takeIf { isLongText(it) }
    val lastGrade = ui.grade?.takeUnless { it.zeroReason == EssayGrade.ZeroReason.TOO_SHORT }
    val rewriting = ui.drafts.orEmpty().isNotEmpty()
    val box = remember { FocusRequester() }
    val moveFocus = rememberMoveFocus()

    LaunchedEffect(Unit) { if (ui.switched) moveFocus(box) }

    TaskScaffold(
        onClose = navigator::closeTask,
        title = { EssayTitle(promptLabel(rubric)) },
        exitConfirmation =
            if (ui.unsent) {
                TaskExitConfirmation(
                    title = stringResource(R.string.essay_leave_title),
                    description = stringResource(R.string.essay_leave_description),
                    confirm = stringResource(R.string.task_leave),
                    cancel = stringResource(R.string.essay_keep_writing),
                )
            } else {
                null
            },
        bottomBar = {
            TaskActionBar {
                StatusLine(ui.send, ui.gradesLeft)
                if (finishFailed && !finishing) SaveErrorText(viewModel::finish)
                TaskActions { width ->
                    if (rewriting) {
                        OutlinedButton(
                            onClick = viewModel::finish,
                            enabled = !finishing,
                        ) { Text(stringResource(R.string.essay_skip_rewrite)) }
                    }
                    val pending = ui.send == EssaySend.Pending
                    BusyButton(
                        stringResource(
                            when {
                                pending -> R.string.essay_grading_button
                                rewriting -> R.string.essay_grade_rewrite
                                else -> R.string.essay_send
                            },
                        ),
                        busy = pending,
                        enabled = ui.canSend && !finishing,
                        modifier = width,
                        onClick = viewModel::send,
                    )
                }
            }
        },
    ) { padding ->
        if (texts == null && lastGrade == null) {
            EssayWriteColumn(essay, ui, rubric, inlineTexts = null, fill = false, box, viewModel, Modifier.padding(padding))
        } else {
            PageWithSupportingPane(
                supportingPane = { EssayAside(texts, lastGrade, rubric) },
                modifier = Modifier.padding(padding),
            ) { beside -> EssayWriteColumn(essay, ui, rubric, inlineTexts = texts.takeUnless { beside }, fill = beside, box, viewModel) }
        }
    }
}

/** Beside the texts on a tall enough window, the box takes the column's rest, as main's on wide screens. */
@Composable
private fun EssayWriteColumn(
    essay: Essay,
    ui: EssayUi,
    rubric: EssayRubric,
    inlineTexts: String?,
    fill: Boolean,
    box: FocusRequester,
    viewModel: EssayViewModel,
    modifier: Modifier = Modifier,
) {
    val above: @Composable ColumnScope.() -> Unit = {
        inlineTexts?.let {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                SectionHeader(textsLabel(rubric))
                QuotedText(it)
            }
        }
        Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
            essay.context?.takeUnless { isLongText(it) }?.let { QuotedText(it) }
            QuestionTitle(essay.question)
        }
        ui.grade?.let { RewriteGuide(it, viewModel::seeGrade) }
    }

    BoxWithConstraints(modifier) {
        if (fill && maxHeight >= FILL_HEIGHT) {
            Column(Modifier.fillMaxSize().padding(vertical = 24.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                Column(Modifier.runColumn().weight(1f), verticalArrangement = Arrangement.spacedBy(24.dp)) {
                    above()
                    EssayBox(ui, rubric, box, viewModel::write, Modifier.weight(1f).heightIn(min = BOX_MIN_HEIGHT))
                }
            }
        } else {
            RunPage(Modifier) {
                above()
                EssayBox(ui, rubric, box, viewModel::write, Modifier.heightIn(min = BOX_HEIGHT))
            }
        }
    }
}

@Composable
private fun EssayTitle(title: String) {
    Text(title, maxLines = 2, overflow = TextOverflow.Ellipsis, textAlign = TextAlign.Center, style = MaterialTheme.typography.titleSmall)
}

@Composable
private fun QuotedText(
    text: String,
    modifier: Modifier = Modifier,
) {
    Row(modifier.height(IntrinsicSize.Min), horizontalArrangement = Arrangement.spacedBy(16.dp)) {
        VerticalDivider(Modifier.fillMaxHeight(), thickness = 2.dp)
        ItemText(text, Modifier.weight(1f), style = MaterialTheme.typography.bodyMedium)
    }
}

/** A too-short grade still names a criterion to work on, with nothing to say about it, so length is what it brings up. */
@Composable
private fun RewriteGuide(
    grade: EssayGrade,
    onSeeGrade: () -> Unit,
) {
    val nextStep = grade.nextStep
    val criterion = grade.criteria.firstOrNull { it.id == nextStep?.criterionId }
    val tooShort = grade.zeroReason == EssayGrade.ZeroReason.TOO_SHORT
    val lead =
        when {
            tooShort -> stringResource(R.string.essay_too_short)
            criterion != null -> stringResource(R.string.essay_next_step_named, criterionName(criterion))
            else -> null
        }
    val detail =
        when {
            tooShort -> stringResource(R.string.essay_too_short_detail)
            nextStep != null -> nextStep.text
            else -> stringResource(R.string.essay_full_marks)
        }

    NoteRow(R.drawable.ic_lightbulb) {
        Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(
                buildAnnotatedString {
                    lead?.let {
                        withStyle(SpanStyle(color = MaterialTheme.colorScheme.onSurface, fontWeight = FontWeight.SemiBold)) { append(it) }
                        append(" ")
                    }
                    append(detail)
                },
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                style = MaterialTheme.typography.bodyMedium,
            )
            TextButton(onClick = onSeeGrade) { Text(stringResource(R.string.essay_see_grade)) }
        }
    }
}

@Composable
private fun EssayBox(
    ui: EssayUi,
    rubric: EssayRubric,
    focus: FocusRequester,
    onWrite: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    val label = if (ui.drafts.orEmpty().isNotEmpty()) stringResource(R.string.essay_rewrite_label) else writingName(rubric)

    OutlinedTextField(
        value = ui.text,
        onValueChange = onWrite,
        modifier = modifier.fillMaxWidth().focusRequester(focus),
        label = { Text(label) },
        supportingText = {
            if (ui.words >
                0
            ) {
                Text(
                    pluralStringResource(R.plurals.essay_words, ui.words, ui.words),
                    style = LocalTextStyle.current.withTabularFigures(),
                )
            }
        },
        textStyle = MaterialTheme.typography.bodyLarge,
        keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Sentences),
    )
}

@Composable
private fun StatusLine(
    send: EssaySend,
    gradesLeft: Int,
) {
    var slow by remember(send) { mutableStateOf(false) }
    LaunchedEffect(send) {
        if (send == EssaySend.Pending) {
            delay(SLOW_GRADING)
            slow = true
        }
    }
    val failed = send == EssaySend.Failed
    val line =
        when {
            failed -> R.string.essay_send_failed
            send == EssaySend.LimitReached || gradesLeft == 0 -> R.string.essay_limit_reached
            send == EssaySend.Pending -> if (slow) R.string.essay_grading_slow else R.string.essay_grading
            else -> return
        }
    Text(
        stringResource(line),
        Modifier.semantics { liveRegion = if (failed) LiveRegionMode.Assertive else LiveRegionMode.Polite },
        color = if (failed) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.onSurfaceVariant,
        style = MaterialTheme.typography.bodyMedium,
    )
}

@Composable
private fun EssayAside(
    texts: String?,
    lastGrade: EssayGrade?,
    rubric: EssayRubric,
) {
    val label = if (texts != null) textsLabel(rubric) else stringResource(R.string.essay_last_grade)

    Row {
        VerticalDivider()
        Column(
            Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(detailPagePadding())
                .semantics { paneTitle = label },
            verticalArrangement = Arrangement.spacedBy(28.dp),
        ) {
            texts?.let {
                Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    SectionHeader(textsLabel(rubric))
                    ItemText(it, style = MaterialTheme.typography.bodyMedium)
                }
            }
            lastGrade?.let {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    SectionHeader(stringResource(R.string.essay_last_grade))
                    CriteriaRows(it, rubric)
                }
            }
        }
    }
}

@Composable
internal fun EssayGradeSteps(
    essay: Essay,
    grade: EssayGrade,
    finished: Boolean,
    announce: Boolean,
    finishing: Boolean,
    finishFailed: Boolean,
    viewModel: EssayViewModel,
    navigator: AppNavigator,
) {
    val rubric = EssayRubric.of(essay.rubric.value)
    val tooShort = grade.zeroReason == EssayGrade.ZeroReason.TOO_SHORT
    val count = if (tooShort) 1 else 2
    var index by rememberSaveable { mutableIntStateOf(0) }
    val shown = index.coerceIn(0, count - 1)
    var comments by rememberSaveable { mutableStateOf(false) }
    val heading = remember { FocusRequester() }
    val moveFocus = rememberMoveFocus()
    var announced by rememberSaveable { mutableIntStateOf(if (announce) NOT_YET else shown) }

    // Main's `focusStepTitle`: a new step takes TalkBack to its heading, and so does the grade once it's in or asked for.
    LaunchedEffect(shown) {
        if (shown != announced) {
            announced = shown
            moveFocus(heading)
        }
    }

    BoxWithConstraints {
        val beside = !tooShort && supportingPaneBeside(maxWidth)
        val step: @Composable (Modifier) -> Unit = { modifier ->
            CompositionLocalProvider(LocalStepHeading provides heading) {
                RunPage(modifier) {
                    when {
                        tooShort -> TooShort()
                        shown == 0 -> EssayGradeCard(grade, rubric)
                        else -> NextStep(grade)
                    }
                }
            }
        }

        TaskScaffold(
            onClose = navigator::closeTask,
            title = { StepDots(count, shown) },
            bottomBar = {
                TaskActionBar {
                    StepPagerActions(count, shown, onIndexChange = { index = it }) { main ->
                        OutlinedButton(onClick = viewModel::finish, enabled = !finishing) {
                            Text(stringResource(R.string.essay_skip_rewrite))
                        }
                        Button(
                            onClick = viewModel::rewrite,
                            enabled = !finished,
                            modifier = main,
                        ) { Text(stringResource(R.string.essay_rewrite)) }
                    }
                    if (shown == count - 1) {
                        if (finishFailed && !finishing) {
                            Text(
                                stringResource(R.string.essay_finish_failed),
                                Modifier.semantics { liveRegion = LiveRegionMode.Assertive },
                                color = MaterialTheme.colorScheme.error,
                                style = MaterialTheme.typography.bodyMedium,
                            )
                        }
                        if (!tooShort && !beside) {
                            TextButton(onClick = { comments = true }, modifier = Modifier.fillMaxWidth()) {
                                Text(stringResource(R.string.essay_see_comments), textAlign = TextAlign.Center)
                            }
                        }
                    }
                }
            },
        ) { padding ->
            if (tooShort) {
                step(Modifier.padding(padding))
            } else {
                PageWithSupportingPane(supportingPane = { CommentsAside(grade) }, modifier = Modifier.padding(padding)) { step(Modifier) }
            }
        }
    }

    if (comments) CommentsSheet(grade) { comments = false }
}

@Composable
private fun TooShort() {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        StepTitle(stringResource(R.string.essay_too_short), Modifier.stepHeading())
        StepDetail(stringResource(R.string.essay_too_short_detail))
    }
}

@Composable
private fun NextStep(grade: EssayGrade) {
    Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
        NextStepComment(grade)
    }
    ProposalElements(grade)
}

@Composable
private fun ProposalElements(grade: EssayGrade) {
    val elements = grade.enemInterventionElements ?: return
    val present =
        listOf(
            R.string.essay_element_agent to elements.agent,
            R.string.essay_element_action to elements.action,
            R.string.essay_element_means to elements.means,
            R.string.essay_element_effect to elements.effect,
            R.string.essay_element_detail to elements.detail,
        )
    if (present.all { it.second }) return
    val presentLabel = stringResource(R.string.essay_element_present)
    val missingLabel = stringResource(R.string.essay_element_missing)

    Column {
        SectionHeader(stringResource(R.string.essay_proposal_elements), Modifier.padding(bottom = 8.dp))
        present.forEachIndexed { index, (name, there) ->
            if (index > 0) HorizontalDivider()
            Row(
                Modifier.fillMaxWidth().heightIn(min = 48.dp).semantics(mergeDescendants = true) {
                    stateDescription = if (there) presentLabel else missingLabel
                },
                horizontalArrangement = Arrangement.spacedBy(12.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Icon(
                    painterResource(if (there) R.drawable.ic_check else R.drawable.ic_radio_button_unchecked),
                    contentDescription = null,
                    modifier = Modifier.size(18.dp),
                    tint = if (there) MaterialTheme.colorScheme.tertiary else MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Text(
                    stringResource(name),
                    color = if (there) MaterialTheme.colorScheme.onSurface else MaterialTheme.colorScheme.onSurfaceVariant,
                    style = MaterialTheme.typography.bodyMedium,
                )
            }
        }
    }
}

@Composable
private fun CommentsAside(grade: EssayGrade) {
    val label = stringResource(R.string.essay_comments)

    Row {
        VerticalDivider()
        Column(
            Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(detailPagePadding())
                .semantics { paneTitle = label },
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            SectionHeader(label)
            CriterionComments(grade)
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun CommentsSheet(
    grade: EssayGrade,
    onDismiss: () -> Unit,
) {
    ModalBottomSheet(onDismissRequest = onDismiss) {
        Column(
            Modifier.verticalScroll(rememberScrollState()).padding(start = 24.dp, end = 24.dp, bottom = 32.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            Text(stringResource(R.string.essay_comments), Modifier.semantics { heading() }, style = MaterialTheme.typography.titleLarge)
            CriterionComments(grade)
        }
    }
}

@Composable
private fun ColumnScope.CriterionComments(grade: EssayGrade) {
    grade.criteria.forEach { criterion ->
        Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(
                criterionName(criterion),
                Modifier.semantics { heading() },
                style = MaterialTheme.typography.bodyMedium,
                fontWeight = FontWeight.SemiBold,
            )
            criterion.quote?.let { quote ->
                Row(Modifier.height(IntrinsicSize.Min), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    VerticalDivider(Modifier.fillMaxHeight(), thickness = 2.dp)
                    Text(
                        quote,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        fontStyle = FontStyle.Italic,
                        style = MaterialTheme.typography.bodyMedium,
                    )
                }
            }
            Text(criterion.comment, style = MaterialTheme.typography.bodyMedium)
        }
    }
}

@Composable
private fun promptLabel(rubric: EssayRubric): String =
    stringResource(
        when (rubric) {
            EssayRubric.Ap -> R.string.essay_title_ap
            EssayRubric.Enem -> R.string.essay_title_enem
            EssayRubric.Oab, EssayRubric.Custom -> R.string.essay_title
        },
    )

@Composable
private fun textsLabel(rubric: EssayRubric): String =
    stringResource(
        when (rubric) {
            EssayRubric.Enem -> R.string.essay_motivating_texts
            EssayRubric.Oab -> R.string.essay_the_case
            EssayRubric.Ap, EssayRubric.Custom -> R.string.essay_supporting_texts
        },
    )

private val BOX_HEIGHT = 288.dp
private val BOX_MIN_HEIGHT = 144.dp
private val FILL_HEIGHT = 560.dp
private const val NOT_YET = -1
private val SLOW_GRADING = 20.seconds
