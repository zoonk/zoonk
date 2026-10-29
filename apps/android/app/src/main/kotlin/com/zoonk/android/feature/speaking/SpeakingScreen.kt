package com.zoonk.android.feature.speaking

import androidx.browser.customtabs.CustomTabsIntent
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyListScope
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.relocation.BringIntoViewRequester
import androidx.compose.foundation.relocation.bringIntoViewRequester
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.ListItem
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedCard
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
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.LinkAnnotation
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.TextLinkStyles
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.withLink
import androidx.compose.ui.unit.dp
import androidx.core.net.toUri
import androidx.lifecycle.viewmodel.compose.viewModel
import com.zoonk.android.R
import com.zoonk.android.app.AppContainer
import com.zoonk.android.data.GenerationFailure
import com.zoonk.android.data.GenerationKind
import com.zoonk.android.data.GenerationRun
import com.zoonk.android.data.LoadState
import com.zoonk.android.data.Resource
import com.zoonk.android.data.StepState
import com.zoonk.android.data.collectShown
import com.zoonk.android.data.value
import com.zoonk.android.feature.conversation.CallLimitMessage
import com.zoonk.android.feature.conversation.CallRequest
import com.zoonk.android.feature.conversation.CallStart
import com.zoonk.android.feature.conversation.CallStartModel
import com.zoonk.android.feature.conversation.OpenStartedCall
import com.zoonk.android.feature.conversation.criterionGloss
import com.zoonk.android.feature.conversation.inLanguage
import com.zoonk.android.feature.conversation.spokenList
import com.zoonk.android.feature.conversation.taskMinutes
import com.zoonk.android.feature.conversation.taskRoleLabel
import com.zoonk.android.feature.subscription.PlusMark
import com.zoonk.android.feature.subscription.PlusNotice
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.ui.components.GenerationWait
import com.zoonk.android.ui.components.KindDot
import com.zoonk.android.ui.components.LearnKind
import com.zoonk.android.ui.components.LimitPeriod
import com.zoonk.android.ui.components.ListRow
import com.zoonk.android.ui.components.ListRowChevron
import com.zoonk.android.ui.components.ListRowLeading
import com.zoonk.android.ui.components.LoadFailedMessage
import com.zoonk.android.ui.components.OutlinedButton
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatDuration
import com.zoonk.android.ui.scaffold.PageScaffold
import com.zoonk.android.ui.scaffold.PageWithSupportingPane
import com.zoonk.api.models.SpeakingPaper
import com.zoonk.api.models.SpeakingPaperTask
import kotlinx.coroutines.launch
import java.util.UUID
import kotlin.math.roundToLong

/** Where a paper's screens lead. */
internal class SpeakingActions(
    val start: suspend (CallRequest) -> CallStart,
    val open: (AppRoute) -> Unit,
    val openWeb: (String) -> Unit,
)

/** `/speaking`: the active goal's exam speaking paper, each task practiced on a call. */
@Composable
fun SpeakingScreen(
    route: AppRoute.Speaking,
    app: AppContainer,
    navigator: AppNavigator,
) {
    val context = LocalContext.current
    val summary by app.learnerSummary.summary.collectShown()
    val goalId = summary.value?.activeGoalId
    val actions =
        remember(navigator) {
            SpeakingActions(
                start = app.conversations::start,
                open = navigator::open,
                openWeb = { CustomTabsIntent.Builder().build().launchUrl(context, it.toUri()) },
            )
        }

    PageScaffold(onBack = { navigator.back() }, title = { Text(stringResource(R.string.speaking_title)) }) { padding ->
        Box(Modifier.padding(padding)) {
            if (goalId == null) {
                Loading()
            } else {
                SpeakingContent(app.speaking.paper(goalId), goalId, route.task, actions)
            }
        }
    }
}

@Composable
private fun Loading() {
    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { CircularProgressIndicator() }
}

@Composable
internal fun SpeakingContent(
    paper: Resource<SpeakingRead>,
    goalId: UUID,
    openTask: String?,
    actions: SpeakingActions,
) {
    val load by paper.collectShown()
    val scope = rememberCoroutineScope()
    when (val state = load) {
        LoadState.Idle, LoadState.Loading -> {
            Loading()
        }

        is LoadState.Failed -> {
            LoadFailedMessage(onRetry = { scope.launch { paper.refresh() } })
        }

        LoadState.Empty -> {
            LoadFailedMessage(onRetry = { scope.launch { paper.refresh() } })
        }

        is LoadState.Loaded -> {
            when (val read = state.value) {
                // Main sends a goal that isn't a language's to its exam page, where its speaking is.
                SpeakingRead.NotLanguage -> LaunchedEffect(Unit) { actions.open(AppRoute.Exam) }

                is SpeakingRead.Paper -> Paper(read.paper, goalId, openTask, actions)
            }
        }
    }
}

@Composable
private fun Paper(
    paper: SpeakingPaper,
    goalId: UUID,
    openTask: String?,
    actions: SpeakingActions,
) {
    val hero: @Composable () -> Unit = { PaperHero(paper) }
    PageWithSupportingPane(supportingPane = { Column(Modifier.padding(24.dp)) { hero() } }) { beside ->
        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            horizontalAlignment = Alignment.CenterHorizontally,
            contentPadding = PaddingValues(bottom = 24.dp),
        ) {
            if (!beside) item(key = "hero") { Box(Modifier.pageItem().padding(top = 8.dp, bottom = 24.dp)) { hero() } }
            item(key = "paper") {
                SpeakingPaperSection(
                    paper = paper,
                    goalId = goalId,
                    openTask = openTask,
                    start = actions.start,
                    open = actions.open,
                    openWeb = actions.openWeb,
                    modifier = Modifier.pageItem(),
                    title = stringResource(R.string.speaking_tasks),
                )
            }
        }
    }
}

@Composable
private fun PaperHero(paper: SpeakingPaper) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(
            stringResource(R.string.speaking_eyebrow),
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            style = MaterialTheme.typography.labelLarge,
        )
        Text(paper.title, Modifier.semantics { heading() }, style = MaterialTheme.typography.headlineMedium)
        Text(
            pluralStringResource(
                R.plurals.speaking_facts,
                paper.tasks.size,
                paper.tasks.size,
                taskMinutes(paper.minutes.min, paper.minutes.max),
            ),
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            style = MaterialTheme.typography.bodyLarge,
        )
        Text(
            stringResource(R.string.speaking_official, paper.title),
            Modifier.padding(top = 8.dp),
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            style = MaterialTheme.typography.bodyMedium,
        )
    }
}

private fun Modifier.pageItem(): Modifier = widthIn(max = PAGE_WIDTH).fillMaxWidth().padding(horizontal = 16.dp)

private val PAGE_WIDTH = 720.dp

/**
 * Main's `SpeakingPaperSection`, for the speaking page and the exam page: the paper's tasks, each
 * opening to its criteria and its Start, with the card written on the learner's tap. [title] null
 * names it Speaking with the paper's title beside it; [from] is the conversation route's `from`.
 * The task [openTask] names starts open and scrolled into view.
 */
@Composable
fun SpeakingPaperSection(
    paper: SpeakingPaper,
    goalId: UUID,
    openTask: String?,
    start: suspend (CallRequest) -> CallStart,
    open: (AppRoute) -> Unit,
    openWeb: (String) -> Unit,
    modifier: Modifier = Modifier,
    title: String? = null,
    from: String? = null,
) {
    val locked = paper.access == SpeakingPaper.Access.PLUS_REQUIRED
    val paused = paper.access == SpeakingPaper.Access.CALLS_PAUSED
    val model = viewModel(key = "speaking-start:$goalId") { CallStartModel(start) }
    var started by rememberSaveable { mutableStateOf<String?>(null) }
    val busy = model.state == CallStartModel.State.Starting || model.state == CallStartModel.State.Writing
    val openCall = { id: UUID -> open(AppRoute.Conversation(id.toString(), from = from)) }
    val startTask = { key: String ->
        started = key
        model.start(CallRequest.ExamSpeaking(goalId, key))
    }
    val actions = SpeakingActions(start, open, openWeb)
    OpenStartedCall(model, openCall)

    Column(modifier) {
        Column(Modifier.padding(bottom = 8.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    title ?: stringResource(R.string.speaking_section),
                    Modifier.weight(1f).semantics {
                        heading()
                    },
                    style = MaterialTheme.typography.titleMedium,
                )
                if (title ==
                    null
                ) {
                    Text(paper.title, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.labelLarge)
                }
            }
            if (locked) PlusNotice(onSeePlus = { open(AppRoute.Subscription) }, description = stringResource(R.string.speaking_plus))
            if (paused) CallsPaused()
        }
        paper.tasks.forEachIndexed { index, task ->
            if (index > 0) HorizontalDivider()
            TaskRow(
                task = task,
                index = index,
                paper = paper,
                openAtFirst = task.key == openTask,
                locked = locked || paused,
                busy = busy,
                starting = model.state == CallStartModel.State.Starting && started == task.key,
                onStart = { startTask(task.key) },
                onLastResult = openCall,
            )
        }
        StartState(model, retry = { started?.let(startTask) }, actions = actions)
        val partner = paper.tasks.any { it.role == SpeakingPaperTask.Role.PARTNER }
        val footer = stringResource(if (partner) R.string.speaking_footer_partner else R.string.speaking_footer)
        val official = stringResource(R.string.speaking_official_format)
        Text(
            buildAnnotatedString {
                append(footer)
                append(" ")
                withLink(
                    LinkAnnotation.Clickable(
                        tag = "official-format",
                        styles = TextLinkStyles(SpanStyle(fontWeight = FontWeight.Medium, textDecoration = TextDecoration.Underline)),
                    ) { openWeb(paper.source) },
                ) { append(official) }
            },
            Modifier.padding(top = 16.dp),
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            style = MaterialTheme.typography.bodySmall,
        )
    }
}

/** Main's paused-calls notice, the same for everyone. */
@Composable
internal fun CallsPaused(modifier: Modifier = Modifier) {
    OutlinedCard(modifier.fillMaxWidth()) {
        Row(Modifier.padding(16.dp), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            Icon(painterResource(R.drawable.ic_call_end), contentDescription = null, tint = MaterialTheme.colorScheme.onSurfaceVariant)
            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text(stringResource(R.string.conversation_paused_title), style = MaterialTheme.typography.titleSmall)
                Text(
                    stringResource(R.string.conversation_paused),
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    style = MaterialTheme.typography.bodyMedium,
                )
            }
        }
    }
}

@Composable
private fun StartState(
    model: CallStartModel,
    retry: () -> Unit,
    actions: SpeakingActions,
) {
    val limit = model.limit
    when {
        model.state == CallStartModel.State.Writing || model.state == CallStartModel.State.WriteFailed -> {
            val failed = model.state == CallStartModel.State.WriteFailed
            GenerationWait(
                kind = GenerationKind.ExamSpeaking,
                run =
                    if (failed) {
                        GenerationRun(GenerationRun.Status.Failed, GenerationFailure.NotStarted)
                    } else {
                        GenerationRun(GenerationRun.Status.Following, steps = mapOf("writeTask" to StepState.Started))
                    },
                onRetry = retry,
                modifier = Modifier.padding(top = 16.dp),
            ) {
                if (!failed) {
                    Text(
                        stringResource(R.string.speaking_opens_when_ready),
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        style = MaterialTheme.typography.bodyMedium,
                    )
                }
            }
        }

        model.state == CallStartModel.State.Failed && limit != null -> {
            CallLimitMessage(
                limit,
                onCreateAccount = { actions.open(AppRoute.Login) },
                onSeePlus = { actions.open(AppRoute.Subscription) },
                title =
                    stringResource(
                        if (limit.period ==
                            LimitPeriod.Month
                        ) {
                            R.string.speaking_no_time_month
                        } else {
                            R.string.speaking_no_time_day
                        },
                    ),
            )
        }

        model.state == CallStartModel.State.Failed -> {
            Text(
                stringResource(R.string.speaking_start_failed),
                Modifier.padding(top = 12.dp).semantics { liveRegion = LiveRegionMode.Polite },
                color = MaterialTheme.colorScheme.error,
                style = MaterialTheme.typography.bodyMedium,
            )
        }
    }
}

@Composable
private fun TaskRow(
    task: SpeakingPaperTask,
    index: Int,
    paper: SpeakingPaper,
    openAtFirst: Boolean,
    locked: Boolean,
    busy: Boolean,
    starting: Boolean,
    onStart: () -> Unit,
    onLastResult: (UUID) -> Unit,
) {
    val locale = currentLocale()
    var open by rememberSaveable(task.key) { mutableStateOf(openAtFirst) }
    val requester = remember { BringIntoViewRequester() }
    LaunchedEffect(openAtFirst) { if (openAtFirst) requester.bringIntoView() }
    val level = paper.level.value
    val prep =
        when {
            task.prepMinutes <= 0 -> {
                null
            }

            task.prepShared != null -> {
                val shared = requireNotNull(task.prepShared)
                stringResource(
                    R.string.speaking_prep_shared,
                    formatDuration((shared.minutes * 60).roundToLong(), locale),
                    spokenList(shared.tasks.map { it.toString() }, locale),
                )
            }

            else -> {
                stringResource(R.string.speaking_prep, formatDuration((task.prepMinutes * 60).roundToLong(), locale))
            }
        }
    val facts =
        listOfNotNull(
            taskRoleLabel(task.role == SpeakingPaperTask.Role.PARTNER),
            taskMinutes(task.minutes.min, task.minutes.max),
            prep,
        ).joinToString(" · ")
    val lastTry =
        task.lastTry?.let {
            when {
                it.rated == 0L -> stringResource(R.string.speaking_last_none)
                it.atLevel > 0 -> stringResource(R.string.speaking_last_at, it.atLevel.toString(), it.rated.toString(), level)
                it.nearLevel > 0 -> stringResource(R.string.speaking_last_near, it.nearLevel.toString(), it.rated.toString(), level)
                else -> stringResource(R.string.speaking_last_below, level)
            }
        }
    val state = stringResource(if (open) R.string.disclosure_expanded else R.string.disclosure_collapsed)

    ListItem(
        headlineContent = { Text(inLanguage(task.name, paper.language)) },
        supportingContent = {
            Column {
                Text(facts)
                lastTry?.let { Text(it) }
            }
        },
        leadingContent = { Text((index + 1).toString(), style = MaterialTheme.typography.labelLarge) },
        trailingContent = {
            Icon(painterResource(R.drawable.ic_expand_more), contentDescription = null, modifier = Modifier.rotate(if (open) 180f else 0f))
        },
        modifier =
            Modifier
                .bringIntoViewRequester(requester)
                .clickable(role = Role.Button) { open = !open }
                .semantics { stateDescription = state },
    )
    if (open) {
        Column(Modifier.padding(start = 56.dp, end = 16.dp, bottom = 16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text(
                stringResource(R.string.speaking_rated_on, spokenList(task.criteria.map { criterionGloss(it.key, it.name) }, locale)),
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                style = MaterialTheme.typography.bodyMedium,
            )
            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                if (!locked) {
                    Button(onClick = onStart, enabled = !busy) {
                        Text(stringResource(if (starting) R.string.conversation_starting else R.string.speaking_start_task))
                    }
                }
                task.lastTry?.let { last ->
                    OutlinedButton(onClick = { onLastResult(last.conversationId) }) { Text(stringResource(R.string.speaking_last_result)) }
                }
            }
        }
    }
}

/** Main's row into the exam's speaking paper, whose [title] names the exam and level ("DELE B2"). */
@Composable
fun SpeakingPracticeRow(
    title: String,
    plusRequired: Boolean,
    onOpen: () -> Unit,
    modifier: Modifier = Modifier,
) {
    ListRow(
        modifier = modifier,
        onClick = onOpen,
        end = {
            if (plusRequired) PlusMark()
            ListRowChevron()
        },
    ) {
        ListRowLeading { KindDot(LearnKind.Conversation) }
        Column(Modifier.weight(1f)) {
            Text(stringResource(R.string.speaking_eyebrow), style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.Medium)
            Text(
                stringResource(R.string.speaking_row, title),
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                style = MaterialTheme.typography.bodyMedium,
            )
        }
    }
}
