package com.zoonk.android.feature.explain

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
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
import androidx.compose.ui.draw.clip
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.zoonk.android.R
import com.zoonk.android.app.AppContainer
import com.zoonk.android.data.GenerationKind
import com.zoonk.android.data.GenerationRun
import com.zoonk.android.data.LiveGenerationSource
import com.zoonk.android.data.LoadState
import com.zoonk.android.data.SessionState
import com.zoonk.android.data.collectShown
import com.zoonk.android.feature.player.LessonColumn
import com.zoonk.android.feature.player.LessonEndSlot
import com.zoonk.android.feature.player.LessonPlayerExits
import com.zoonk.android.feature.player.LessonReadouts
import com.zoonk.android.feature.player.PlayingLesson
import com.zoonk.android.feature.player.engine.CompletionStatus
import com.zoonk.android.feature.player.engine.LessonPlayerState
import com.zoonk.android.feature.player.model.LessonLoad
import com.zoonk.android.feature.player.model.toPlayableLesson
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.navigation.AppTab
import com.zoonk.android.ui.components.GenerationWait
import com.zoonk.android.ui.components.OutlinedButton
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatDuration
import com.zoonk.android.ui.format.formatNumber
import com.zoonk.android.ui.scaffold.TaskScaffold
import com.zoonk.api.models.Explanation
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlin.time.Duration.Companion.seconds

private const val QUICK_EXPLANATION_SECONDS = 300L
private const val OUTLINE_PLACEHOLDERS = 5

/** The first screen usually shows within about 20 seconds. */
private val SLOW = 45.seconds

/** The written explanation can lag the run's end by a moment, so it's read again until it shows. */
private val READ_AGAIN = 2.seconds

/**
 * `/explain/{goalId}` (main's `ExplainClient`): a quick explanation's outline while it's written,
 * then its lesson, which ends with what the learner now knows and where to go further.
 */
@Composable
fun ExplainScreen(
    route: AppRoute.Explain,
    app: AppContainer,
    navigator: AppNavigator,
) {
    val resource = remember(route.goalId) { app.explain.explanation(route.goalId) }
    val load by resource.collectShown()
    val scope = rememberCoroutineScope()

    when (val state = load) {
        LoadState.Idle, LoadState.Loading -> {
            TaskScaffold(onClose = navigator::closeTask) { padding ->
                Box(Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.Center) { CircularProgressIndicator() }
            }
        }

        is LoadState.Failed, LoadState.Empty -> {
            TaskScaffold(onClose = navigator::closeTask) { padding ->
                Column(
                    Modifier.fillMaxSize().padding(padding).padding(24.dp),
                    verticalArrangement = Arrangement.spacedBy(16.dp, Alignment.CenterVertically),
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    Text(stringResource(R.string.explain_load_failed), style = MaterialTheme.typography.titleMedium)
                    Button(onClick = { scope.launch { resource.refresh() } }) { Text(stringResource(R.string.explain_try_again)) }
                }
            }
        }

        is LoadState.Loaded -> {
            ExplanationView(route, state.value, app, navigator, readAgain = { resource.refresh() })
        }
    }
}

@Composable
private fun ExplanationView(
    route: AppRoute.Explain,
    explanation: Explanation,
    app: AppContainer,
    navigator: AppNavigator,
    readAgain: suspend () -> Unit,
) {
    val viewModel =
        viewModel(key = "explain:${route.goalId}") {
            ExplainViewModel(route.goalId, app.explain, app.cache, app.sessions, { LiveGenerationSource(app.api, it) })
        }
    val session by app.sessions.state.collectAsStateWithLifecycle()
    // A learner who waited sees the finished outline first; one opening a written explanation reads it at once.
    val readsAtOnce = rememberSaveable { explanation.lesson != null }
    var started by rememberSaveable { mutableStateOf(false) }
    val lesson = explanation.lesson

    LaunchedEffect(explanation, (session as? SessionState.SignedIn)?.session) { viewModel.show(explanation) }

    if (lesson != null && (readsAtOnce || started)) {
        val playable = remember(lesson) { lesson.toPlayableLesson() }
        val exits = remember(navigator) { explainExits(navigator) }

        PlayingLesson(
            route = AppRoute.Lesson(playable.id),
            app = app,
            load = LessonLoad.Ready(playable),
            navigator = navigator,
            exits = exits,
            endSlot =
                LessonEndSlot(
                    body = { state -> ExplainEnding(explanation, state, navigator, readAgain) },
                    done = { finish(explanation, navigator) },
                ),
        )
    } else {
        ExplainWaiting(explanation, viewModel, navigator, readAgain, onStart = { started = true })
    }
}

private fun explainExits(navigator: AppNavigator) =
    object : LessonPlayerExits {
        override fun close() = navigator.closeTask()

        override fun open(route: AppRoute) = navigator.open(route)

        override fun replace(route: AppRoute) {
            navigator.closeTask()
            navigator.open(route)
        }
    }

/** Main's: a learner with a plan goes back to Today; one without starts a goal. */
private fun finish(
    explanation: Explanation,
    navigator: AppNavigator,
) {
    navigator.closeTask()
    if (explanation.hasStudyGoal) navigator.showRoot(AppTab.Today) else navigator.open(AppRoute.StartGoal())
}

/** Only fills the words in: reading them waits for the learner's tap there. */
private fun startGoal(
    words: String,
    navigator: AppNavigator,
) {
    navigator.closeTask()
    navigator.open(AppRoute.StartGoal(goal = words))
}

@Composable
internal fun ExplainWaiting(
    explanation: Explanation,
    viewModel: ExplainViewModel,
    navigator: AppNavigator,
    readAgain: suspend () -> Unit,
    onStart: () -> Unit,
) {
    val run by viewModel.run.collectAsStateWithLifecycle()
    val ready = explanation.lesson != null
    val failed = run.status == GenerationRun.Status.Failed

    LaunchedEffect(run.status == GenerationRun.Status.Ready && !ready) {
        if (run.status == GenerationRun.Status.Ready && !ready) {
            while (true) {
                readAgain()
                delay(READ_AGAIN)
            }
        }
    }
    LaunchedEffect(ready) { if (ready) viewModel.recordWait() }

    TaskScaffold(
        onClose = navigator::closeTask,
        bottomBar =
            if (ready) {
                {
                    LessonColumn(Modifier.padding(vertical = 12.dp)) {
                        Button(onClick = onStart, modifier = Modifier.fillMaxWidth()) { Text(stringResource(R.string.explain_see)) }
                    }
                }
            } else {
                null
            },
    ) { padding ->
        Column(Modifier.fillMaxSize().padding(padding).verticalScroll(rememberScrollState())) {
            LessonColumn(Modifier.padding(vertical = 24.dp)) {
                ExplainHeading(explanation.title, subtitle = stringResource(R.string.explain_no_plan))
                if (!ready) GenerationWait(GenerationKind.Explanation, run, onRetry = viewModel::retry)
                Outline(explanation.outline)
                DeeperRow(explanation, navigator)
                if (!ready && !failed) SlowWait(explanation, viewModel)
            }
        }
    }
}

@Composable
private fun quickExplanationLabel() = stringResource(R.string.explain_quick, formatDuration(QUICK_EXPLANATION_SECONDS, currentLocale()))

@Composable
private fun ExplainHeading(
    title: String,
    subtitle: String? = null,
    eyebrow: @Composable () -> Unit = {
        Text(quickExplanationLabel(), color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.labelLarge)
    },
) {
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        eyebrow()
        Text(title, modifier = Modifier.semantics { heading() }, style = MaterialTheme.typography.headlineSmall)
        subtitle?.let { Text(it, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodyMedium) }
    }
}

/** Main's `Outline`: what's coming, numbered, with placeholders until the run names the screens. */
@Composable
private fun Outline(titles: List<String>) {
    val locale = currentLocale()

    Column {
        Text(
            stringResource(R.string.explain_coming),
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            style = MaterialTheme.typography.labelLarge,
        )
        val rows = titles.ifEmpty { List(OUTLINE_PLACEHOLDERS) { null } }
        rows.forEachIndexed { index, title ->
            if (index > 0) HorizontalDivider()
            Row(
                Modifier.fillMaxWidth().heightIn(min = 48.dp),
                horizontalArrangement = Arrangement.spacedBy(12.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    formatNumber((index + 1).toDouble(), locale),
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    style = MaterialTheme.typography.labelMedium,
                )
                if (title == null) {
                    Box(
                        Modifier
                            .height(14.dp)
                            .width((80 + index * 24).dp)
                            .background(MaterialTheme.colorScheme.surfaceContainerHigh, MaterialTheme.shapes.small),
                    )
                } else {
                    Text(title, style = MaterialTheme.typography.bodyMedium)
                }
            }
        }
        HorizontalDivider()
        Row(
            Modifier.fillMaxWidth().heightIn(min = 48.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Icon(
                painterResource(R.drawable.ic_help),
                contentDescription = null,
                modifier = Modifier.size(18.dp),
                tint = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Text(
                stringResource(R.string.explain_one_question),
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                style = MaterialTheme.typography.bodyMedium,
            )
        }
    }
}

/** Main's `DeeperStart`: the course it belongs to, or a goal for the whole subject. */
@Composable
private fun DeeperRow(
    explanation: Explanation,
    navigator: AppNavigator,
) {
    val course = explanation.goFurther.course
    val goal = stringResource(R.string.explain_deeper_goal, topicOf(explanation.title))

    GoFurtherRow(
        icon = R.drawable.ic_school,
        title = stringResource(R.string.explain_deeper),
        description =
            if (course !=
                null
            ) {
                stringResource(R.string.explain_deeper_course, course.title)
            } else {
                stringResource(R.string.explain_deeper_subject)
            },
    ) {
        if (course != null) {
            navigator.closeTask()
            navigator.open(AppRoute.CourseStart(course.id.toString()))
        } else {
            startGoal(goal, navigator)
        }
    }
}

/** Main's `toTopic`: the title as a topic mid-sentence, keeping an acronym's capitals. */
internal fun topicOf(title: String): String {
    val topic = title.trim().trimEnd('?', '!', '.')
    val acronym = topic.take(2).let { it.length == 2 && it.all(Char::isUpperCase) }
    return if (acronym) topic else topic.replaceFirstChar { it.lowercase() }
}

@Composable
private fun GoFurtherRow(
    icon: Int,
    title: String,
    description: String,
    onClick: () -> Unit,
) {
    ListItem(
        headlineContent = { Text(title) },
        supportingContent = { Text(description) },
        leadingContent = { Icon(painterResource(icon), contentDescription = null) },
        colors = ListItemDefaults.colors(containerColor = MaterialTheme.colorScheme.surfaceContainerHigh),
        modifier =
            Modifier
                .padding(vertical = 2.dp)
                .clip(MaterialTheme.shapes.medium)
                .clickable(onClick = onClick),
    )
}

/** Main's `SlowWait`: after a while, a way to ask again; once asked, it says the explanation is still coming. */
@Composable
private fun SlowWait(
    explanation: Explanation,
    viewModel: ExplainViewModel,
) {
    var slow by remember { mutableStateOf(false) }
    var retrying by remember { mutableStateOf(false) }
    var joined by rememberSaveable { mutableStateOf(false) }
    val scope = rememberCoroutineScope()

    LaunchedEffect(Unit) {
        delay(SLOW)
        slow = true
    }

    if (!slow) return

    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text(
            stringResource(if (joined || retrying) R.string.explain_still_writing else R.string.explain_slow),
            modifier = Modifier.semantics { liveRegion = LiveRegionMode.Polite },
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            style = MaterialTheme.typography.bodyMedium,
        )
        if (!joined) {
            OutlinedButton(
                onClick = {
                    retrying = true
                    scope.launch {
                        joined = viewModel.retrySlow(explanation)
                        retrying = false
                    }
                },
                enabled = !retrying,
            ) { Text(stringResource(R.string.explain_try_again)) }
        }
    }
}

/** Main's `ExplainEnding`: what the learner now knows, the explanation in a few sentences, and where to go further. */
@Composable
internal fun ExplainEnding(
    explanation: Explanation,
    state: LessonPlayerState,
    navigator: AppNavigator,
    readAgain: suspend () -> Unit,
) {
    val saving = state.completion?.status == CompletionStatus.Saving
    val locale = currentLocale()

    // The course to go further is linked a few seconds after the explanation can be read.
    LaunchedEffect(Unit) { if (explanation.goFurther.course == null) readAgain() }

    LessonColumn(Modifier.padding(vertical = 24.dp)) {
        ExplainHeading(explanation.title) {
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    painterResource(R.drawable.ic_check),
                    contentDescription = null,
                    modifier = Modifier.size(18.dp),
                    tint = MaterialTheme.colorScheme.tertiary,
                )
                Text(
                    stringResource(R.string.explain_now_you_know),
                    color = MaterialTheme.colorScheme.tertiary,
                    style = MaterialTheme.typography.labelLarge,
                )
            }
        }

        if (saving) {
            Text(stringResource(R.string.player_saving_progress), color = MaterialTheme.colorScheme.onSurfaceVariant)
        } else {
            LessonReadouts(state, withReview = false)
        }

        if (explanation.recap.isNotEmpty()) {
            Column {
                Text(
                    pluralStringResource(
                        R.plurals.explain_recap,
                        explanation.recap.size,
                        formatNumber(explanation.recap.size.toDouble(), locale),
                    ),
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    style = MaterialTheme.typography.labelLarge,
                )
                explanation.recap.forEachIndexed { index, sentence ->
                    if (index > 0) HorizontalDivider()
                    Row(Modifier.padding(vertical = 12.dp), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        Text(
                            formatNumber((index + 1).toDouble(), locale),
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            style = MaterialTheme.typography.labelMedium,
                        )
                        Text(sentence, style = MaterialTheme.typography.bodyMedium)
                    }
                }
            }
        }

        if (!saving) {
            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text(
                    stringResource(R.string.explain_go_further),
                    modifier = Modifier.semantics { heading() },
                    style = MaterialTheme.typography.titleMedium,
                )
                DeeperRow(explanation, navigator)
                explanation.goFurther.questions.forEach { question ->
                    GoFurtherRow(R.drawable.ic_help, question, quickExplanationLabel()) { startGoal(question, navigator) }
                }
            }
        }
    }
}
