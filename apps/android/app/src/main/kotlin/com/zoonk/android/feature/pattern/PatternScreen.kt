package com.zoonk.android.feature.pattern

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.createSavedStateHandle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.zoonk.android.R
import com.zoonk.android.app.AppContainer
import com.zoonk.android.data.ApiError
import com.zoonk.android.data.LoadState
import com.zoonk.android.data.collectShown
import com.zoonk.android.feature.ceremonies.MomentAfterCeremony
import com.zoonk.android.feature.player.LessonTitle
import com.zoonk.android.feature.practice.BusyButton
import com.zoonk.android.feature.practice.RunFinished
import com.zoonk.android.feature.practice.RunFrame
import com.zoonk.android.feature.practice.RunIntro
import com.zoonk.android.feature.practice.RunLoadFailed
import com.zoonk.android.feature.practice.RunLoading
import com.zoonk.android.feature.practice.RunMeter
import com.zoonk.android.feature.practice.RunNotFound
import com.zoonk.android.feature.practice.RunPage
import com.zoonk.android.feature.practice.SaveErrorText
import com.zoonk.android.feature.practice.runAccount
import com.zoonk.android.feature.questions.Answer
import com.zoonk.android.feature.questions.ChoiceCheck
import com.zoonk.android.feature.questions.ChoiceQuestion
import com.zoonk.android.feature.questions.ItemText
import com.zoonk.android.feature.questions.QuestionTitle
import com.zoonk.android.feature.questions.verdict
import com.zoonk.android.feature.session.DayMoment
import com.zoonk.android.feature.session.ReachedFacts
import com.zoonk.android.feature.session.missionMomentFacts
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.ui.components.DiffKind
import com.zoonk.android.ui.components.DiffLine
import com.zoonk.android.ui.components.DiffLines
import com.zoonk.android.ui.components.Eyebrow
import com.zoonk.android.ui.components.FeedbackPanel
import com.zoonk.android.ui.components.FeedbackVerdict
import com.zoonk.android.ui.components.MomentReadouts
import com.zoonk.android.ui.components.MomentScore
import com.zoonk.android.ui.components.OutlinedButton
import com.zoonk.android.ui.components.SectionHeader
import com.zoonk.android.ui.components.SectionLabel
import com.zoonk.android.ui.components.TaskActionBar
import com.zoonk.android.ui.components.TaskActions
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatMinutes
import com.zoonk.android.ui.scaffold.TaskScaffold
import com.zoonk.android.ui.scaffold.taskAsideBeside
import com.zoonk.api.models.MistakePattern
import com.zoonk.api.models.MistakePatternContrastInner
import com.zoonk.api.models.MistakePatternExamplesInner
import com.zoonk.api.models.MistakePatternPracticeResult
import kotlinx.coroutines.launch
import java.util.UUID

private const val DRILL_MINUTES = 3

@Composable
fun PatternScreen(
    route: AppRoute.Pattern,
    app: AppContainer,
    navigator: AppNavigator,
) {
    val patternId = remember(route.patternId) { runCatching { UUID.fromString(route.patternId) }.getOrNull() }
    if (patternId == null) {
        RunNotFound(navigator::closeTask)
        return
    }
    val viewModel =
        viewModel(key = "pattern:$patternId:${runAccount(app)}") { PatternViewModel(patternId, app.patterns, createSavedStateHandle()) }
    val state by viewModel.state.collectAsStateWithLifecycle()
    val closed by viewModel.closed.collectAsStateWithLifecycle()

    LaunchedEffect(closed) { if (closed) navigator.closeTask() }
    BackHandler(onBack = viewModel::leave)

    when (val drill = state) {
        null -> PatternRead(viewModel, onClose = viewModel::leave)
        else -> PatternContent(drill, viewModel, app)
    }
}

/** Until the pattern is read; then the drill keeps it while its save refreshes the read. */
@Composable
private fun PatternRead(
    viewModel: PatternViewModel,
    onClose: () -> Unit,
) {
    val loaded by viewModel.pattern.collectShown()
    val scope = rememberCoroutineScope()

    when (val read = loaded) {
        is LoadState.Loaded -> {
            LaunchedEffect(read.value) { viewModel.begin(read.value) }
            RunLoading(onClose)
        }

        is LoadState.Failed -> {
            if (read.error == ApiError.NotFound) {
                RunNotFound(onClose)
            } else {
                RunLoadFailed(onClose, onRetry = { scope.launch { viewModel.pattern.refresh() } })
            }
        }

        else -> {
            RunLoading(onClose)
        }
    }
}

@Composable
internal fun PatternContent(
    drill: PatternDrill,
    viewModel: PatternViewModel,
    app: AppContainer,
) {
    val step = drill.step
    val onClose = viewModel::leave
    when {
        drill.isTypos -> TyposPattern(drill.pattern, onClose)
        step is DrillStep.Result -> PatternResult(step.result, app, onClose)
        step is DrillStep.Question -> PatternQuestion(drill, step.index, viewModel, app, onClose)
        else -> PatternIntroPage(drill.pattern, onStart = viewModel::start, onClose = onClose)
    }
}

@Composable
private fun TyposPattern(
    pattern: MistakePattern,
    onClose: () -> Unit,
) {
    TaskScaffold(
        onClose = onClose,
        title = { LessonTitle(stringResource(R.string.pattern_title)) },
        bottomBar = {
            TaskActionBar {
                TaskActions { width -> Button(onClick = onClose, modifier = width) { Text(stringResource(R.string.pattern_done)) } }
            }
        },
    ) { padding ->
        RunPage(Modifier.padding(padding)) {
            RunIntro(title = stringResource(R.string.pattern_just_typos), detail = stringResource(R.string.pattern_typos_detail))
            if (pattern.rule.isNotBlank()) Text(pattern.rule, style = MaterialTheme.typography.bodyLarge)
        }
    }
}

@Composable
private fun PatternIntroPage(
    pattern: MistakePattern,
    onStart: () -> Unit,
    onClose: () -> Unit,
) {
    val time = formatMinutes(DRILL_MINUTES, currentLocale())

    TaskScaffold(
        onClose = onClose,
        title = { LessonTitle(stringResource(R.string.pattern_title)) },
        bottomBar = {
            TaskActionBar {
                TaskActions { width ->
                    Button(onClick = onStart, modifier = width) { Text(stringResource(R.string.pattern_practice, time)) }
                }
            }
        },
    ) { padding ->
        RunPage(Modifier.padding(padding)) {
            val count = pattern.occurrences.toInt()
            val seen =
                if (count ==
                    0
                ) {
                    stringResource(R.string.pattern_seen)
                } else {
                    pluralStringResource(R.plurals.pattern_seen_times, count, count)
                }
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Eyebrow(stringResource(R.string.pattern_noticed))
                Text(pattern.title, Modifier.semantics { heading() }, style = MaterialTheme.typography.headlineSmall)
                Text(seen, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodyLarge)
            }
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                pattern.examples.firstOrNull()?.let { ExampleLines(it) }
                Text(pattern.rule, style = MaterialTheme.typography.bodyLarge)
            }
            ContrastRows(pattern.contrast)
            AlsoCameUp(pattern.examples.drop(1))
        }
    }
}

@Composable
private fun PatternQuestion(
    drill: PatternDrill,
    index: Int,
    viewModel: PatternViewModel,
    app: AppContainer,
    onClose: () -> Unit,
) {
    val pattern = drill.pattern
    val question = pattern.drill[index]
    val checked = drill.answer
    var ruleOpen by rememberSaveable { mutableStateOf(false) }

    RunFrame(
        title = pattern.title,
        question = null,
        app = app,
        onClose = onClose,
        mainAction =
            when {
                checked != null -> viewModel::next
                drill.picked != null -> viewModel::check
                else -> null
            },
        report = null,
        // Main's pattern drill counts a checked answer as done before Continue; a study block doesn't.
        progress = { RunMeter(index, pattern.drill.size, drill.segments, done = if (checked == null) index else index + 1) },
        actions = {
            if (drill.failed && !drill.saving) SaveErrorText(viewModel::retry)
            TaskActions { width ->
                if (!taskAsideBeside()) {
                    OutlinedButton(onClick = { ruleOpen = true }) {
                        Icon(
                            painterResource(R.drawable.ic_menu_book),
                            contentDescription = null,
                            modifier = Modifier.padding(end = 8.dp).size(18.dp),
                        )
                        Text(stringResource(R.string.pattern_see_rule))
                    }
                }
                if (checked != null) {
                    val last = index + 1 == pattern.drill.size
                    BusyButton(
                        stringResource(if (last) R.string.pattern_see_how_you_did else R.string.practice_continue),
                        busy = drill.saving,
                        enabled = true,
                        modifier = width,
                        onClick = viewModel::next,
                    )
                } else {
                    Button(onClick = viewModel::check, enabled = drill.picked != null, modifier = width) {
                        Text(stringResource(R.string.practice_check))
                    }
                }
            }
        },
        aside = {
            SectionLabel(stringResource(R.string.pattern_rule))
            RuleDetails(pattern)
        },
    ) { _, asideShown ->
        key(index) {
            QuestionTitle(question.sentence, graded = checked != null)
            ChoiceQuestion(
                options = question.options,
                select = null,
                check =
                    checked?.let {
                        ChoiceCheck(
                            correct =
                                listOfNotNull(
                                    question.options.indexOfFirst { option -> option.trim() == question.answer.trim() }.takeIf {
                                        it >=
                                            0
                                    },
                                ),
                            picked = listOf(question.options.indexOf(it)),
                        )
                    },
                enabled = checked == null,
                onAnswer = { viewModel.pick((it as? Answer.Choice)?.index) },
            )
            checked?.let { PatternFeedback(right = it.trim() == question.answer.trim(), explanation = question.feedback) }
        }
        if (ruleOpen && !asideShown) RuleSheet(pattern) { ruleOpen = false }
    }
}

@Composable
private fun PatternFeedback(
    right: Boolean,
    explanation: String,
) {
    val verdict = verdict(right)
    FeedbackPanel(label = stringResource(R.string.questions_feedback_label)) {
        FeedbackVerdict(verdict.label, verdict.tone)
        if (explanation.isNotBlank()) ItemText(explanation, style = MaterialTheme.typography.bodyMedium)
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun RuleSheet(
    pattern: MistakePattern,
    onDismiss: () -> Unit,
) {
    ModalBottomSheet(onDismissRequest = onDismiss) {
        Column(
            Modifier.verticalScroll(rememberScrollState()).padding(start = 24.dp, end = 24.dp, bottom = 32.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            Text(pattern.title, Modifier.semantics { heading() }, style = MaterialTheme.typography.titleLarge)
            RuleDetails(pattern)
        }
    }
}

@Composable
private fun RuleDetails(pattern: MistakePattern) {
    ContrastRows(pattern.contrast)
    Text(pattern.rule, style = MaterialTheme.typography.bodyMedium)
    pattern.examples.firstOrNull()?.let { example ->
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            SectionHeader(stringResource(R.string.pattern_where_you_slipped))
            ExampleLines(example)
        }
    }
}

@Composable
private fun ExampleLines(example: MistakePatternExamplesInner) {
    DiffLines(
        lines = listOf(DiffLine(DiffKind.Removed, example.answer), DiffLine(DiffKind.Added, example.correctAnswer)),
        added = stringResource(R.string.pattern_correct_version),
        removed = stringResource(R.string.pattern_you_said),
    )
}

@Composable
private fun ContrastRows(contrast: List<MistakePatternContrastInner>) {
    if (contrast.isEmpty()) return
    val quiet = MaterialTheme.colorScheme.onSurfaceVariant

    Column {
        contrast.forEachIndexed { index, row ->
            if (index > 0) HorizontalDivider()
            Row(
                Modifier.fillMaxWidth().semantics(mergeDescendants = true) {}.padding(vertical = 10.dp),
                horizontalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                Text(contrastLabel(row.label, quiet), Modifier.weight(1f).alignByBaseline(), style = MaterialTheme.typography.bodyMedium)
                Text(
                    row.example,
                    Modifier.weight(1f).alignByBaseline(),
                    color = quiet,
                    textAlign = TextAlign.End,
                    style = MaterialTheme.typography.bodyMedium,
                )
            }
        }
    }
}

private fun contrastLabel(
    label: String,
    quiet: Color,
) = buildAnnotatedString {
    val parts = label.split(" + ")
    withStyle(SpanStyle(fontWeight = FontWeight.SemiBold)) { append(parts.first()) }
    if (parts.size > 1) withStyle(SpanStyle(color = quiet)) { append(" + " + parts.drop(1).joinToString(" + ")) }
}

@Composable
private fun AlsoCameUp(examples: List<MistakePatternExamplesInner>) {
    if (examples.isEmpty()) return
    val quiet = MaterialTheme.colorScheme.onSurfaceVariant
    val style = MaterialTheme.typography.bodyMedium
    val glyph = with(LocalDensity.current) { style.fontSize.toDp() }

    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        SectionHeader(stringResource(R.string.pattern_also_came_up))
        examples.forEach { example ->
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Icon(
                    painterResource(if (example.format.startsWith("spoken")) R.drawable.ic_mic else R.drawable.ic_edit),
                    contentDescription = null,
                    modifier = Modifier.padding(top = 2.dp).size(glyph),
                    tint = quiet,
                )
                Text(stringResource(R.string.pattern_quoted, example.answer), color = quiet, style = style)
            }
        }
    }
}

@Composable
private fun PatternResult(
    result: MistakePatternPracticeResult,
    app: AppContainer,
    onClose: () -> Unit,
) {
    MomentAfterCeremony(app, result.ceremony) { buddy ->
        RunFinished(
            title = stringResource(R.string.practice_done_title),
            action = stringResource(R.string.pattern_done),
            saving = false,
            onClose = onClose,
            detail = stringResource(if (result.correct == result.total) R.string.pattern_got_it else R.string.pattern_keep_going),
        ) {
            MomentReadouts(brainPower = result.brainPower, score = MomentScore(result.total.toInt(), result.correct.toInt()))
            DayMoment(
                missions = result.missionMoment?.missionMomentFacts(),
                reached = ReachedFacts(result.reached.level, result.reached.energy),
                ceremony = result.ceremony?.kind,
                buddy = buddy.look,
                buddyName = buddy.name,
            )
        }
    }
}
