package com.zoonk.android.feature.challenge

import android.text.format.DateFormat
import androidx.annotation.DrawableRes
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.LocalContentColor
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.VerticalDivider
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.createSavedStateHandle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.zoonk.android.R
import com.zoonk.android.app.AppContainer
import com.zoonk.android.data.ApiError
import com.zoonk.android.data.GenerationKind
import com.zoonk.android.data.LiveGenerationSource
import com.zoonk.android.data.LoadState
import com.zoonk.android.data.SessionState
import com.zoonk.android.data.collectShown
import com.zoonk.android.feature.checkpoint.checkpointName
import com.zoonk.android.feature.conversation.ChecklistRow
import com.zoonk.android.feature.mock.chooser.MockLeftOutNote
import com.zoonk.android.feature.mock.mockDaySize
import com.zoonk.android.feature.mock.mockTitle
import com.zoonk.android.feature.plan.lessonsText
import com.zoonk.android.feature.practice.ActionBarWidth
import com.zoonk.android.feature.practice.ActionColumn
import com.zoonk.android.feature.practice.ActionFlow
import com.zoonk.android.feature.practice.BusyButton
import com.zoonk.android.feature.practice.BusyLabel
import com.zoonk.android.feature.practice.RunLoadFailed
import com.zoonk.android.feature.practice.RunLoading
import com.zoonk.android.feature.practice.RunNotFound
import com.zoonk.android.feature.subscription.PlusNotice
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.navigation.AppTab
import com.zoonk.android.ui.characters.TricksterArt
import com.zoonk.android.ui.components.GenerationWait
import com.zoonk.android.ui.components.LimitNotice
import com.zoonk.android.ui.components.LimitSubject
import com.zoonk.android.ui.components.ListRow
import com.zoonk.android.ui.components.OutlinedButton
import com.zoonk.android.ui.components.SectionHeader
import com.zoonk.android.ui.components.TitleAndMeta
import com.zoonk.android.ui.format.DateStyle
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatDate
import com.zoonk.android.ui.format.formatMinutes
import com.zoonk.android.ui.format.formatNumber
import com.zoonk.android.ui.format.formatPercent
import com.zoonk.android.ui.format.formatTimeOfDay
import com.zoonk.android.ui.scaffold.TaskScaffold
import com.zoonk.android.ui.theme.zoonk
import com.zoonk.api.models.Challenge
import com.zoonk.api.models.MockLeftOut
import kotlinx.coroutines.launch
import kotlinx.datetime.toJavaLocalDate
import java.time.LocalTime
import java.time.temporal.ChronoUnit
import java.util.UUID

/** `/challenge/{planItemId}`: a challenge before and on its day, and its move to Monday. */
@Composable
fun ChallengeScreen(
    route: AppRoute.Challenge,
    app: AppContainer,
    navigator: AppNavigator,
) {
    val planItemId = remember(route.planItemId) { runCatching { UUID.fromString(route.planItemId) }.getOrNull() }
    val session by app.sessions.state.collectAsStateWithLifecycle()
    val signedIn = (session as? SessionState.SignedIn)?.session
    if (planItemId == null) {
        RunNotFound(navigator::closeTask)
        return
    }
    if (signedIn == null) {
        RunLoading(navigator::closeTask)
        return
    }
    val viewModel =
        viewModel(key = "challenge:$planItemId:${signedIn.localId}") {
            ChallengeViewModel(
                planItemId,
                route.sessionId,
                app.challenges,
                LiveGenerationSource(app.api, signedIn),
                createSavedStateHandle(),
            )
        }
    val ui by viewModel.ui.collectAsStateWithLifecycle()
    if (ui.moved != null) {
        ChallengeMoved(ui, viewModel, navigator)
        return
    }
    val loaded by app.challenges.challenges[ui.planItemId].collectShown()
    val scope = rememberCoroutineScope()

    // A started block replaces the intro, so Back from it returns to where the challenge was opened.
    LaunchedEffect(ui.opening) {
        ui.opening?.let {
            viewModel.opened()
            navigator.closeTask()
            navigator.open(it)
        }
    }

    when (val read = loaded) {
        is LoadState.Loaded -> {
            val challenge = read.value
            val blockId = challenge.blockId
            // A language call opens on its own screen until it's won or locked.
            if (challenge.call != null && blockId != null && challenge.status != Challenge.Status.DONE && !challenge.locked) {
                LaunchedEffect(blockId) {
                    navigator.closeTask()
                    navigator.open(AppRoute.Checkpoint(blockId.toString(), route.sessionId))
                }
                RunLoading(navigator::closeTask)
                return
            }
            ChallengeView(challenge, ui, viewModel, navigator, route.sessionId)
        }

        is LoadState.Failed -> {
            if (read.error == ApiError.NotFound) {
                ToToday(navigator)
            } else {
                RunLoadFailed(navigator::closeTask, onRetry = { scope.launch { app.challenges.challenges[ui.planItemId].refresh() } })
            }
        }

        LoadState.Empty -> {
            ToToday(navigator)
        }

        else -> {
            RunLoading(navigator::closeTask)
        }
    }
}

/** As main does, a challenge that isn't there, like one a move replaced, opens Today. */
@Composable
private fun ToToday(navigator: AppNavigator) {
    LaunchedEffect(Unit) { navigator.showRoot(AppTab.Today) }
    RunLoading(navigator::closeTask)
}

@Composable
internal fun ChallengeView(
    challenge: Challenge,
    ui: ChallengeUi,
    viewModel: ChallengeViewModel,
    navigator: AppNavigator,
    sessionId: String?,
) {
    val actions = remember(viewModel, navigator, sessionId) { ChallengeActions(viewModel, navigator, sessionId) }
    if (ui.writing) WritingScreen(viewModel, navigator::closeTask) else IntroScreen(challenge, ui, actions)
}

private class ChallengeActions(
    val viewModel: ChallengeViewModel,
    val navigator: AppNavigator,
    private val sessionId: String?,
) {
    fun close() = navigator.closeTask()

    fun toToday() = navigator.showRoot(AppTab.Today)

    fun seePlus() = navigator.open(AppRoute.Subscription)

    fun createAccount() = navigator.open(AppRoute.Login)

    fun openBlock(challenge: Challenge) {
        val blockId = challenge.blockId?.toString() ?: return
        navigator.closeTask()
        navigator.open(if (challenge.mock) AppRoute.Mock(blockId, sessionId) else AppRoute.Checkpoint(blockId, sessionId))
    }
}

@Composable
private fun WritingScreen(
    viewModel: ChallengeViewModel,
    onClose: () -> Unit,
) {
    val run by viewModel.run.collectAsStateWithLifecycle()
    TaskScaffold(onClose = onClose) { padding ->
        Column(
            Modifier
                .fillMaxSize()
                .padding(padding)
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            GenerationWait(
                kind = GenerationKind.ChallengeQuestions,
                run = run,
                onRetry = viewModel::retryWriting.takeIf { viewModel.canRestart },
                modifier = Modifier.widthIn(max = CONTENT_WIDTH),
            ) {
                Text(
                    stringResource(R.string.challenge_writing_title),
                    modifier = Modifier.semantics { heading() },
                    style = MaterialTheme.typography.headlineSmall,
                )
                Text(
                    stringResource(R.string.challenge_writing_detail),
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    style = MaterialTheme.typography.bodyLarge,
                )
            }
        }
    }
}

/** Shown as soon as the move is saved: it needs nothing from the moved challenge's read. */
@Composable
internal fun ChallengeMoved(
    ui: ChallengeUi,
    viewModel: ChallengeViewModel,
    navigator: AppNavigator,
) {
    val moved = ui.moved ?: return
    val day = formatDate(moved.date.toJavaLocalDate(), currentLocale(), DateStyle.WeekdayDay)
    TaskScaffold(
        onClose = navigator::closeTask,
        bottomBar = {
            ActionBarWidth {
                ActionColumn {
                    MoveFailed(ui)
                    ActionFlow { width ->
                        OutlinedButton(onClick = viewModel::undoMove, enabled = !ui.moving) {
                            BusyLabel(stringResource(R.string.challenge_undo), ui.moving)
                        }
                        Button(onClick = { navigator.showRoot(AppTab.Today) }, modifier = width) {
                            Text(stringResource(R.string.challenge_back_to_today))
                        }
                    }
                }
            }
        },
    ) { padding ->
        CenteredColumn(Modifier.padding(padding)) {
            // Read out whole, as main's status card is: where it went and what that left out.
            Column(
                Modifier.semantics(mergeDescendants = true) { liveRegion = LiveRegionMode.Polite },
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                Text(
                    stringResource(R.string.challenge_moved_title, day),
                    modifier = Modifier.semantics { heading() },
                    style = MaterialTheme.typography.headlineSmall,
                )
                val leftOut = moved.effect?.takeIf { it.lessonsRemoved > 0 }?.let { lessonsText(it) }
                Text(
                    listOfNotNull(stringResource(R.string.challenge_moved_detail), leftOut).joinToString(" "),
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    style = MaterialTheme.typography.bodyLarge,
                )
            }
        }
    }
}

@Composable
private fun CenteredColumn(
    modifier: Modifier = Modifier,
    content: @Composable ColumnScope.() -> Unit,
) {
    Column(
        modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 16.dp, vertical = 16.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Column(Modifier.widthIn(max = CONTENT_WIDTH).fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(12.dp), content = content)
    }
}

@Composable
private fun IntroScreen(
    challenge: Challenge,
    ui: ChallengeUi,
    actions: ChallengeActions,
) {
    TaskScaffold(
        onClose = actions::close,
        bottomBar = { ActionBarWidth { ChallengeFooter(challenge, ui, actions) } },
    ) { padding ->
        BoxWithConstraints(Modifier.fillMaxSize().padding(padding)) {
            val wide = maxWidth >= ASIDE_FROM
            val aside = asideFor(challenge)
            Row(Modifier.fillMaxSize()) {
                CenteredColumn(Modifier.weight(1f)) {
                    Intro(challenge)
                    if (!wide) aside?.content?.invoke(true)
                    // A card this size scrolls with the intro; the bar under it keeps only its action.
                    if (plusRequired(challenge, ui)) PlusRequiredNotice(challenge)
                }
                if (wide && aside != null) {
                    VerticalDivider()
                    Column(
                        Modifier.width(ASIDE_WIDTH).verticalScroll(rememberScrollState()).padding(horizontal = 24.dp, vertical = 16.dp),
                        verticalArrangement = Arrangement.spacedBy(16.dp),
                    ) {
                        SectionHeader(aside.title)
                        aside.content(false)
                    }
                }
            }
        }
    }
}

/** What sits beside the intro from a tablet up, and under it on a phone with its own title. */
private class Aside(
    val title: String,
    val content: @Composable (titled: Boolean) -> Unit,
)

@Composable
private fun asideFor(challenge: Challenge): Aside? {
    val topicsTitle = topicsTitle(challenge)
    val name = name(challenge)
    return when {
        challenge.mock -> {
            Aside(challenge.examName ?: name) { MockDetails(challenge) }
        }

        challenge.call != null -> {
            challenge.call?.goals?.takeIf { challenge.status != Challenge.Status.DONE }?.let { goals ->
                val title = stringResource(R.string.challenge_call_goals_title)
                Aside(title) { titled ->
                    Column {
                        if (titled) SectionHeader(title)
                        goals.forEach { goal ->
                            ChecklistRow(buildAnnotatedString { append(goal.label) }, done = false, description = goal.description)
                        }
                    }
                }
            }
        }

        topicsTitle != null -> {
            val rule = duelRule(challenge)
            Aside(topicsTitle) { titled ->
                Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
                    Topics(challenge, if (titled) topicsTitle else null)
                    rule?.let { RuleLine(it) }
                }
            }
        }

        else -> {
            null
        }
    }
}

@Composable
private fun duelRule(challenge: Challenge): String? =
    when {
        challenge.mock || challenge.call != null || challenge.status == Challenge.Status.DONE -> null
        challenge.kind == Challenge.Kind.WEEKLY -> stringResource(R.string.challenge_weekly_rule)
        else -> stringResource(R.string.challenge_trickster_rule)
    }

@Composable
private fun name(challenge: Challenge): String =
    checkpointName(challenge.kind == Challenge.Kind.WEEKLY, challenge.kind == Challenge.Kind.FINAL_BOSS, challenge.phase)

@Composable
private fun topicsTitle(challenge: Challenge): String? =
    when {
        challenge.mock || challenge.topics.isEmpty() -> null
        challenge.kind == Challenge.Kind.WEEKLY -> stringResource(R.string.challenge_topics_weekly)
        challenge.status == Challenge.Status.DONE -> stringResource(R.string.challenge_topics_asked)
        else -> stringResource(R.string.challenge_topics_will_ask)
    }

@Composable
private fun Intro(challenge: Challenge) {
    val locale = currentLocale()
    val prize = stringResource(R.string.challenge_prize, formatNumber(challenge.reward.brainPower.toDouble(), locale))
    val questions =
        challenge.questions
            ?.takeIf { it > 0 }
            ?.toInt()
            ?.let { pluralStringResource(R.plurals.challenge_questions, it, it) }
    val name = name(challenge)
    val eyebrow = if (challenge.rematch) stringResource(R.string.challenge_rematch, name) else name
    val result = challenge.result
    val call = challenge.call
    // Without topics the rule stays under the intro; with them it sits with the topics.
    val inlineRule = duelRule(challenge)?.takeIf { topicsTitle(challenge) == null }

    when {
        challenge.mock -> {
            val section = challenge.sections.singleOrNull()
            val objectiveOnly = challenge.leftOut.any { it.part == MockLeftOut.Part.WRITTEN_IN_FULL }
            // Half a day isn't named by its day, which would say its written part is asked.
            val area = section?.name?.takeIf { challenge.written.isEmpty() && !objectiveOnly }
            IntroHeading(
                title = mockTitle(challenge.number ?: 1),
                whenText = whenText(challenge),
                detail = listOfNotNull(challenge.examName, area).joinToString(" · ").ifEmpty { null },
            )
            Facts(
                listOfNotNull(
                    questions,
                    challenge.minutes?.let { formatMinutes(it.toInt(), locale) },
                    mockDaySize(fullLength = false).takeIf { !challenge.fullLength },
                    stringResource(R.string.challenge_objective_only).takeIf { objectiveOnly },
                ),
            )
        }

        challenge.kind == Challenge.Kind.WEEKLY -> {
            IntroHeading(
                title = stringResource(R.string.checkpoint_weekly),
                whenText = whenText(challenge).takeIf { challenge.startTime != null },
                detail = stringResource(R.string.challenge_weekly_detail),
            )
            Facts(listOfNotNull(questions), prize)
        }

        call != null && challenge.status == Challenge.Status.DONE -> {
            IntroHeading(title = stringResource(R.string.challenge_call_passed), eyebrow = name)
            result?.let {
                val correct = it.correct.toInt()
                Facts(listOf(pluralStringResource(R.plurals.challenge_call_result, correct, correct, it.total.toInt())))
            }
        }

        call != null -> {
            IntroHeading(
                title = call.title ?: stringResource(R.string.challenge_call_title),
                eyebrow = eyebrow,
                detail = stringResource(R.string.challenge_call_detail),
            )
            Facts(
                listOfNotNull(
                    stringResource(R.string.challenge_call_level, formatMinutes(call.minutes.toInt(), locale), call.level.value),
                    call.goals?.let { pluralStringResource(R.plurals.challenge_call_goals, it.size, it.size) },
                    challenge.passMark?.let { stringResource(R.string.challenge_call_to_win, it.toString()) },
                ),
                prize,
            )
        }

        challenge.status == Challenge.Status.DONE -> {
            TricksterArt(Modifier.size(104.dp), beaten = true)
            IntroHeading(title = stringResource(R.string.checkpoint_beat), eyebrow = name)
            result?.let {
                val correct = it.correct.toInt()
                Facts(listOf(pluralStringResource(R.plurals.challenge_result_right, correct, correct, it.total.toInt())))
            }
        }

        else -> {
            TricksterArt(Modifier.size(104.dp), reacts = true)
            IntroHeading(title = stringResource(R.string.checkpoint_trickster), eyebrow = eyebrow, detail = tricksterDetail(challenge))
            val passMark = challenge.passMark?.toInt()?.takeIf { it > 0 }
            val toWin = passMark?.let { pluralStringResource(R.plurals.checkpoint_right_to_win, it, it) }
            Facts(listOfNotNull(questions, toWin), prize)
        }
    }
    inlineRule?.let { RuleLine(it) }
}

@Composable
private fun tricksterDetail(challenge: Challenge): String {
    val recordings = challenge.recordings?.toInt()
    return when {
        recordings == null -> stringResource(R.string.challenge_trickster_recordings)
        recordings > 0 -> pluralStringResource(R.plurals.challenge_trickster_recording_count, recordings, recordings)
        else -> stringResource(R.string.challenge_trickster_mixed)
    }
}

/** "Today", "Tomorrow", a weekday this week, else the date; with its start time when it has one. */
@Composable
private fun whenText(challenge: Challenge): String? {
    val date = challenge.date?.toJavaLocalDate() ?: return null
    val locale = currentLocale()
    val days = ChronoUnit.DAYS.between(challenge.today.toJavaLocalDate(), date)
    val day =
        when {
            days <= 0 -> stringResource(R.string.challenge_today)
            days == 1L -> stringResource(R.string.challenge_tomorrow)
            days < DAYS_IN_A_WEEK -> formatDate(date, locale, DateStyle.Weekday)
            else -> formatDate(date, locale, DateStyle.WeekdayDay)
        }
    val time =
        challenge.startTime?.let {
            runCatching { LocalTime.parse(it) }.getOrNull()?.let { start ->
                formatTimeOfDay(start, locale, DateFormat.is24HourFormat(LocalContext.current))
            }
        }
    return if (time == null) day else stringResource(R.string.challenge_day_time, day, time)
}

@Composable
private fun IntroHeading(
    title: String,
    eyebrow: String? = null,
    whenText: String? = null,
    detail: String? = null,
) {
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        eyebrow?.let { Text(it, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.labelLarge) }
        whenText?.let { Text(it, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.labelLarge) }
        Text(title, modifier = Modifier.semantics { heading() }, style = MaterialTheme.typography.headlineSmall)
        detail?.let { Text(it, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodyLarge) }
    }
}

/** Its size in a line, with the prize in Brain Power's color. */
@Composable
private fun Facts(
    facts: List<String>,
    prize: String? = null,
) {
    if (facts.isEmpty() && prize == null) return
    val brain = MaterialTheme.zoonk.brainText
    Text(
        buildAnnotatedString {
            append(facts.joinToString(" · "))
            prize?.let {
                if (facts.isNotEmpty()) append(" · ")
                withStyle(SpanStyle(color = brain)) { append(it) }
            }
        },
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        style = MaterialTheme.typography.bodyMedium,
    )
}

/** Main's `Callout`: a quiet note on how the challenge plays or is scored. */
@Composable
private fun RuleLine(
    text: String,
    @DrawableRes icon: Int? = null,
) {
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        icon?.let {
            Icon(
                painterResource(it),
                contentDescription = null,
                modifier = Modifier.padding(top = 2.dp).size(16.dp),
                tint = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
        Text(text, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodySmall)
    }
}

/** A topic group, a mock section or a written part: its name and details, with its numbers at the end. */
@Composable
private fun DetailRow(
    title: String,
    meta: String?,
    details: List<String> = emptyList(),
) {
    ListRow(end = {}) {
        TitleAndMeta(
            modifier = Modifier.weight(1f),
            meta = {
                meta?.let { Text(it, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.labelMedium) }
            },
        ) {
            Text(title, style = MaterialTheme.typography.bodyLarge)
            details.forEach { Text(it, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodyMedium) }
        }
    }
}

/** A subject's topics on one row, or a topic without a subject on its own. */
@Composable
private fun Topics(
    challenge: Challenge,
    title: String?,
) {
    val rows =
        challenge.topics
            .groupBy { it.subject }
            .flatMap { (subject, topics) ->
                val names = topics.map { it.name }.distinct()
                if (subject == null) names.map { null to listOf(it) } else listOf(subject to names)
            }
    Column {
        title?.let { SectionHeader(it) }
        rows.forEachIndexed { index, (subject, names) ->
            if (index > 0) HorizontalDivider()
            if (subject == null) {
                DetailRow(names.first(), meta = null)
            } else {
                DetailRow(
                    subject,
                    meta = pluralStringResource(R.plurals.challenge_topic_count, names.size, names.size),
                    details = listOf(names.joinToString(", ")),
                )
            }
        }
    }
}

/** A mock's sections and written parts, and how it's scored. */
@Composable
private fun MockDetails(challenge: Challenge) {
    val locale = currentLocale()
    Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
        if (challenge.sections.size + challenge.written.size > 1) {
            Column {
                challenge.sections.forEachIndexed { index, section ->
                    if (index > 0) HorizontalDivider()
                    val count = section.questions.toInt()
                    DetailRow(
                        section.name ?: stringResource(R.string.challenge_section_questions),
                        meta =
                            pluralStringResource(
                                R.plurals.challenge_section_size,
                                count,
                                count,
                                formatMinutes(section.minutes.toInt(), locale),
                            ),
                        details = listOfNotNull(section.tools),
                    )
                }
                challenge.written.forEach { part ->
                    HorizontalDivider()
                    DetailRow(
                        part.name,
                        meta = part.minutes?.let { formatMinutes(it.toInt(), locale) },
                        details =
                            listOf(
                                part.tasks.joinToString(" · ") { task ->
                                    task.count?.let { count -> "$count × ${task.description}" } ?: task.description
                                },
                                stringResource(if (part.asked) R.string.challenge_written_asked else R.string.challenge_written_practiced),
                            ),
                    )
                }
            }
        }
        MockLeftOutNote(challenge.leftOut.filter { it.part != MockLeftOut.Part.WRITTEN && it.part != MockLeftOut.Part.WRITTEN_IN_FULL })
        RuleLine(scoringLine(challenge), if (challenge.netScored) R.drawable.ic_balance else R.drawable.ic_visibility_off)
    }
}

@Composable
private fun scoringLine(challenge: Challenge): String {
    val locale = currentLocale()
    val penalty = challenge.wrongPenalty
    return when {
        !challenge.netScored -> {
            stringResource(R.string.challenge_result_at_end)
        }

        penalty == 1.0 -> {
            stringResource(R.string.challenge_penalty_cancels)
        }

        else -> {
            // A guess pays off only above this chance of being right.
            val breakEven = penalty / (1 + penalty)
            stringResource(R.string.challenge_penalty_costs, formatPercent(penalty, locale), formatPercent(breakEven, locale))
        }
    }
}

@Composable
private fun ChallengeFooter(
    challenge: Challenge,
    ui: ChallengeUi,
    actions: ChallengeActions,
) {
    val vm = actions.viewModel
    // A refusal is a fact about the plan this screen can't change, so the move isn't offered again.
    val movable = challenge.canMove && ui.refusal == null
    val ready = challenge.status == Challenge.Status.READY && challenge.waitReason == null

    ActionColumn {
        if (plusRequired(challenge, ui)) {
            ActionFlow { width ->
                Button(onClick = actions::seePlus, modifier = width) { Text(stringResource(R.string.challenge_see_plus)) }
            }
            return@ActionColumn
        }
        when (challenge.status) {
            Challenge.Status.READY, Challenge.Status.STARTED -> {
                val wait = challenge.waitReason
                when {
                    wait != null -> {
                        StatusLine(R.drawable.ic_calendar_clock, waitText(wait))
                    }

                    challenge.status == Challenge.Status.READY && challenge.dailyLimitReached -> {
                        StatusLine(null, usedUpText(challenge, movable))
                        MoveFailed(ui)
                        ActionFlow { width ->
                            if (movable) {
                                OutlinedButton(onClick = actions::toToday) { Text(stringResource(R.string.challenge_back_to_today)) }
                                BusyButton(stringResource(R.string.challenge_move), ui.moving, !ui.starting, width, vm::moveToMonday)
                            } else {
                                Button(
                                    onClick = actions::toToday,
                                    modifier = width,
                                ) { Text(stringResource(R.string.challenge_back_to_today)) }
                            }
                        }
                    }

                    challenge.status == Challenge.Status.READY -> {
                        StartActions(challenge, ui, movable, actions)
                    }

                    else -> {
                        ActionFlow { width ->
                            BusyButton(stringResource(R.string.challenge_continue), ui.starting, true, width, vm::start)
                        }
                    }
                }
            }

            Challenge.Status.TRIED -> {
                val lessons = challenge.reinforcementLessons.toInt()
                StatusLine(
                    R.drawable.ic_replay,
                    if (lessons == 0) {
                        stringResource(R.string.checkpoint_retry_tomorrow)
                    } else {
                        pluralStringResource(R.plurals.checkpoint_retry_after_lessons, lessons, lessons)
                    },
                )
                SeeResult(challenge, actions)
            }

            Challenge.Status.DONE -> {
                SeeResult(challenge, actions)
            }

            Challenge.Status.WAITING -> {
                val empty = challenge.questions == 0L && challenge.call == null && !challenge.mock
                val upcoming = challenge.date?.let { it > challenge.today } == true
                if (empty && upcoming) {
                    OpensLine(challenge)
                } else {
                    val line = if (empty) R.string.challenge_not_ready else R.string.challenge_next_session
                    StatusLine(R.drawable.ic_calendar_clock, stringResource(line))
                }
            }

            Challenge.Status.QUEUED -> {
                StatusLine(R.drawable.ic_calendar_clock, stringResource(R.string.missions_after_challenge))
            }

            Challenge.Status.UPCOMING -> {
                OpensLine(challenge)
            }

            Challenge.Status.PLUS_REQUIRED -> {}
        }
        if (!ready) {
            MoveFailed(ui)
            if (movable) {
                ActionFlow { width ->
                    OutlinedButton(onClick = vm::moveToMonday, enabled = !ui.moving && !ui.starting, modifier = width) {
                        BusyLabel(stringResource(R.string.challenge_move), ui.moving)
                    }
                }
            }
        }
    }
}

@Composable
private fun StartActions(
    challenge: Challenge,
    ui: ChallengeUi,
    movable: Boolean,
    actions: ChallengeActions,
) {
    val vm = actions.viewModel
    val refused = ui.refused
    if (refused != null) {
        LimitNotice(refused, LimitSubject.Help, onCreateAccount = actions::createAccount, onSeePlus = actions::seePlus)
        return
    }
    when {
        ui.problem == StartProblem.Failed -> ErrorLine(stringResource(R.string.challenge_start_failed))
        ui.slow -> StatusLine(null, stringResource(R.string.challenge_start_slow))
    }
    MoveFailed(ui)
    ActionFlow { width ->
        if (movable) {
            OutlinedButton(onClick = vm::moveToMonday, enabled = !ui.moving && !ui.starting) {
                BusyLabel(stringResource(R.string.challenge_move), ui.moving)
            }
        }
        val label =
            when {
                ui.starting -> stringResource(R.string.challenge_starting)
                challenge.mock -> stringResource(R.string.challenge_mock_start)
                else -> stringResource(R.string.challenge_start)
            }
        BusyButton(label, ui.starting, !ui.moving, width, vm::start)
    }
}

@Composable
private fun SeeResult(
    challenge: Challenge,
    actions: ChallengeActions,
) {
    if (challenge.blockId == null) return
    ActionFlow { width ->
        Button(onClick = { actions.openBlock(challenge) }, modifier = width) { Text(stringResource(R.string.challenge_see_result)) }
    }
}

private fun plusRequired(
    challenge: Challenge,
    ui: ChallengeUi,
) = ui.problem == StartProblem.PlusRequired || challenge.status == Challenge.Status.PLUS_REQUIRED

@Composable
private fun PlusRequiredNotice(challenge: Challenge) {
    when {
        challenge.mock -> {
            PlusNotice(onSeePlus = null, description = stringResource(R.string.challenge_mock_plus))
        }

        challenge.call != null -> {
            PlusNotice(onSeePlus = null, description = stringResource(R.string.challenge_call_plus))
        }

        else -> {
            PlusNotice(
                onSeePlus = null,
                title = stringResource(R.string.subscription_free_week_over_title),
                description = stringResource(R.string.subscription_free_week_over_description),
            )
        }
    }
}

@Composable
private fun waitText(wait: Challenge.WaitReason): String =
    stringResource(if (wait == Challenge.WaitReason.LESSONS) R.string.missions_after_lessons else R.string.missions_after_challenge)

/** Past today's study time the week's challenge doesn't come back on its own: the next study day plans without it. */
@Composable
private fun usedUpText(
    challenge: Challenge,
    movable: Boolean,
): String {
    if (challenge.kind == Challenge.Kind.WEEKLY) {
        return stringResource(if (movable) R.string.challenge_used_up_move else R.string.challenge_used_up)
    }
    val next = challenge.nextStudyDate?.toJavaLocalDate() ?: return stringResource(R.string.challenge_used_up_next_session)
    return if (ChronoUnit.DAYS.between(challenge.today.toJavaLocalDate(), next) == 1L) {
        stringResource(R.string.challenge_used_up_tomorrow)
    } else {
        stringResource(R.string.challenge_used_up_on, formatDate(next, currentLocale(), DateStyle.Weekday))
    }
}

@Composable
private fun OpensLine(challenge: Challenge) {
    val date = challenge.date
    val text =
        if (date == null) {
            stringResource(R.string.challenge_opens_after_lessons)
        } else {
            val days =
                ChronoUnit.DAYS
                    .between(challenge.today.toJavaLocalDate(), date.toJavaLocalDate())
                    .toInt()
                    .coerceAtLeast(1)
            if (days == 1) {
                stringResource(R.string.challenge_opens_tomorrow)
            } else {
                pluralStringResource(R.plurals.challenge_opens_in, days, days)
            }
        }
    StatusLine(R.drawable.ic_calendar_clock, text)
}

@Composable
private fun MoveFailed(ui: ChallengeUi) {
    val locale = currentLocale()
    val text =
        when (val refusal = ui.refusal) {
            MoveRefusal.BeforeNextMonday -> {
                stringResource(R.string.challenge_move_before_monday)
            }

            MoveRefusal.MockCollision -> {
                stringResource(R.string.challenge_move_collision)
            }

            MoveRefusal.NoRoom -> {
                stringResource(R.string.challenge_move_no_room)
            }

            is MoveRefusal.Unfunded -> {
                stringResource(
                    R.string.challenge_move_unfunded,
                    formatMinutes(refusal.minutes, locale),
                    formatDate(refusal.date.toJavaLocalDate(), locale),
                )
            }

            null -> {
                if (ui.moveFailed) stringResource(R.string.challenge_change_failed) else return
            }
        }
    ErrorLine(text)
}

@Composable
private fun ErrorLine(text: String) {
    Text(
        text,
        modifier = Modifier.semantics { liveRegion = LiveRegionMode.Assertive },
        color = MaterialTheme.colorScheme.error,
        style = MaterialTheme.typography.bodyMedium,
    )
}

/** Where it stands, read out when it changes. */
@Composable
private fun StatusLine(
    @DrawableRes icon: Int?,
    text: String,
) {
    Row(
        Modifier.fillMaxWidth().semantics { liveRegion = LiveRegionMode.Polite },
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalAlignment = Alignment.Top,
    ) {
        icon?.let {
            Icon(
                painterResource(it),
                contentDescription = null,
                modifier = Modifier.size(18.dp),
                tint = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
        Text(text, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodyMedium)
    }
}

private const val DAYS_IN_A_WEEK = 7
private val ASIDE_FROM = 840.dp
private val ASIDE_WIDTH = 360.dp
private val CONTENT_WIDTH = 640.dp
