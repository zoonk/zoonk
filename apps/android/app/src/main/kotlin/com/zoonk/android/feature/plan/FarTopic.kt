package com.zoonk.android.feature.plan

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.LocalContentColor
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.paneTitle
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.repeatOnLifecycle
import androidx.lifecycle.viewModelScope
import com.zoonk.android.R
import com.zoonk.android.data.MutationResult
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.ui.components.LIST_ITEM_INSET
import com.zoonk.android.ui.components.Limit
import com.zoonk.android.ui.components.LimitNotice
import com.zoonk.android.ui.components.LimitSubject
import com.zoonk.android.ui.components.ListRow
import com.zoonk.android.ui.components.bleed
import com.zoonk.api.models.SkillOutline
import com.zoonk.api.models.SkillOutlineChapter
import com.zoonk.api.models.SkillOutlineGeneration
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.datetime.LocalDate
import kotlinx.datetime.toJavaLocalDate
import java.util.UUID
import kotlin.time.Duration
import kotlin.time.Duration.Companion.minutes
import kotlin.time.Duration.Companion.seconds
import kotlin.time.TimeSource

/** A topic whose lessons the plan writes two weeks before it gets there, as its row shows it. */
data class FarTopic(
    val skillId: UUID,
    val title: String,
    val lessons: Long?,
    val nextDate: LocalDate?,
)

sealed interface FarTopicShown {
    data object Loading : FarTopicShown

    data object Available : FarTopicShown

    data object Writing : FarTopicShown

    data class Ready(
        val chapters: List<SkillOutlineChapter>,
    ) : FarTopicShown

    /** The plan has nothing left to write for it: studied, settled or left out. */
    data object Unavailable : FarTopicShown

    /** [stuck]: following the writing failed, so Try again follows it again instead of asking again. */
    data class Unreachable(
        val stuck: Boolean = false,
    ) : FarTopicShown

    data class Refused(
        val limit: Limit,
    ) : FarTopicShown
}

data class FarTopicSheetState(
    val topic: FarTopic,
    val shown: FarTopicShown = FarTopicShown.Loading,
    val asking: Boolean = false,
)

/**
 * Main's far topic sheet for one page: the topic open in it, its lesson plan written only from the
 * learner's tap and followed with main's 4-second poll, which gives up after three misses in a row or
 * ten minutes. The page reads again only once the sheet closes, as main's does: read while it's open,
 * the plan could take away the row it opened from.
 */
class FarTopicViewModel(
    private val store: PlanStore,
    private val goalId: UUID,
    private val pollEvery: Duration = POLL_EVERY,
    private val timeSource: TimeSource = TimeSource.Monotonic,
) : ViewModel() {
    private val opened = MutableStateFlow<FarTopicSheetState?>(null)
    val sheet: StateFlow<FarTopicSheetState?> = opened.asStateFlow()

    private var landed = false

    /** Counts the sheet's openings, so an answer to an earlier one doesn't show in the next. */
    private var openings = 0

    fun open(topic: FarTopic) {
        val opening = ++openings
        opened.value = FarTopicSheetState(topic)
        viewModelScope.launch {
            val read = store.outline(goalId, topic.skillId)
            if (read is MutationResult.Obsolete) return@launch
            val shown = read.shown().also(::noteLanded)
            update(opening) { copy(shown = shown) }
        }
    }

    fun request() {
        val state = opened.value ?: return
        if (state.asking) return
        val opening = openings
        val skillId = state.topic.skillId
        update(opening) { copy(asking = true) }
        viewModelScope.launch {
            val shown =
                when (val result = store.writeOutline(goalId, skillId)) {
                    is MutationResult.Done -> {
                        if (result.value.status == SkillOutlineGeneration.Status.WRITING) {
                            FarTopicShown.Writing
                        } else {
                            store.outline(goalId, skillId).shown().also(::noteLanded)
                        }
                    }

                    is MutationResult.Failed -> {
                        Limit.of(result)?.let(FarTopicShown::Refused)
                            ?: if (result.status == UNPROCESSABLE) FarTopicShown.Unavailable else FarTopicShown.Unreachable()
                    }

                    MutationResult.Obsolete -> {
                        null
                    }
                }
            update(opening) { copy(shown = shown ?: this.shown, asking = false) }
        }
    }

    fun retry() {
        val state = opened.value ?: return
        if ((state.shown as? FarTopicShown.Unreachable)?.stuck == true) {
            update(openings) { copy(shown = FarTopicShown.Writing) }
        } else {
            request()
        }
    }

    /** Runs while the sheet shows the lessons being written. */
    suspend fun follow() {
        val opening = openings
        val skillId = opened.value?.topic?.skillId ?: return
        val started = timeSource.markNow()
        var misses = 0

        while (true) {
            delay(pollEvery)
            val read = store.outline(goalId, skillId)
            if (read is MutationResult.Obsolete) return
            val outline = (read as? MutationResult.Done)?.value
            misses = if (outline == null) misses + 1 else 0

            if (outline != null && outline.status != SkillOutline.Status.WRITING) {
                val shown = outline.shown().also(::noteLanded)
                update(opening) { copy(shown = shown) }
                return
            }

            if (misses >= MAX_MISSES || started.elapsedNow() >= GIVE_UP_AFTER) {
                update(opening) { copy(shown = FarTopicShown.Unreachable(stuck = true)) }
                return
            }
        }
    }

    fun close() {
        opened.value = null
        if (landed) {
            landed = false
            store.outlineLanded()
        }
    }

    /** Chapters its row doesn't show yet, even ones written while the sheet was closed: the page reads again on closing. */
    private fun noteLanded(shown: FarTopicShown) {
        if (shown is FarTopicShown.Ready) landed = true
    }

    /** Answers apply only to the opening that asked: the learner may have closed it or opened another since. */
    private fun update(
        opening: Int,
        transform: FarTopicSheetState.() -> FarTopicSheetState,
    ) = opened.update { state -> if (opening == openings) state?.transform() else state }

    private companion object {
        val POLL_EVERY = 4.seconds
        val GIVE_UP_AFTER = 10.minutes
        const val MAX_MISSES = 3
        const val UNPROCESSABLE = 422
    }
}

private fun MutationResult<SkillOutline>.shown(): FarTopicShown =
    (this as? MutationResult.Done)?.value?.shown() ?: FarTopicShown.Unreachable()

private fun SkillOutline.shown(): FarTopicShown =
    when {
        status == SkillOutline.Status.WRITING -> FarTopicShown.Writing
        status == SkillOutline.Status.READY && chapters.isNotEmpty() -> FarTopicShown.Ready(chapters)
        else -> FarTopicShown.Available
    }

@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun FarTopicSheet(
    topics: FarTopicViewModel,
    navigator: AppNavigator,
    onChapter: (UUID) -> Unit,
) {
    val sheet by topics.sheet.collectAsStateWithLifecycle()
    val open = sheet ?: return

    ModalBottomSheet(onDismissRequest = topics::close, modifier = Modifier.semantics { paneTitle = open.topic.title }) {
        FarTopicContent(
            open = open,
            topics = topics,
            navigator = navigator,
            onChapter = onChapter,
            modifier = Modifier.verticalScroll(rememberScrollState()).padding(start = SHEET_MARGIN, end = SHEET_MARGIN, bottom = 32.dp),
        )
    }
}

@Composable
internal fun FarTopicContent(
    open: FarTopicSheetState,
    topics: FarTopicViewModel,
    navigator: AppNavigator,
    onChapter: (UUID) -> Unit,
    modifier: Modifier = Modifier,
) {
    val topic = open.topic

    Column(modifier, verticalArrangement = Arrangement.spacedBy(16.dp)) {
        Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(
                text = topic.title,
                modifier = Modifier.semantics { heading() },
                style = MaterialTheme.typography.titleLarge,
            )
            farTopicLine(topic.lessons?.toInt(), topic.nextDate?.toJavaLocalDate())?.let {
                Text(it, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodyMedium)
            }
        }

        FarTopicBody(
            open = open,
            topics = topics,
            navigator = navigator,
            onChapter = { chapterId ->
                topics.close()
                onChapter(chapterId)
            },
        )
    }
}

@Composable
private fun FarTopicBody(
    open: FarTopicSheetState,
    topics: FarTopicViewModel,
    navigator: AppNavigator,
    onChapter: (UUID) -> Unit,
) {
    when (val shown = open.shown) {
        FarTopicShown.Loading -> {
            Box(Modifier.fillMaxWidth().padding(vertical = 8.dp), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(Modifier.size(24.dp), color = MaterialTheme.colorScheme.onSurfaceVariant, strokeWidth = 2.dp)
            }
        }

        is FarTopicShown.Ready -> {
            Column(Modifier.bleed(LIST_ITEM_INSET)) {
                shown.chapters.forEach { chapter ->
                    ListRow(
                        headline = { Text(chapter.title, maxLines = 2, overflow = TextOverflow.Ellipsis) },
                        onClick = { onChapter(chapter.chapterId) },
                        leading = { Icon(painterResource(R.drawable.ic_menu_book), contentDescription = null) },
                    )
                }
            }
        }

        else -> {
            FarTopicRequest(open, topics, navigator)
        }
    }
}

/**
 * The topic's state as one message and one action, as main's sheet has, so TalkBack reads each new
 * message where the learner is and the action keeps its focus as its words change.
 */
@Composable
private fun FarTopicRequest(
    open: FarTopicSheetState,
    topics: FarTopicViewModel,
    navigator: AppNavigator,
) {
    val shown = open.shown
    val writing = shown == FarTopicShown.Writing
    val failed = shown is FarTopicShown.Unreachable
    val limit = (shown as? FarTopicShown.Refused)?.limit
    val message =
        when (shown) {
            FarTopicShown.Writing -> R.string.plan_far_writing
            is FarTopicShown.Unreachable -> R.string.plan_far_unreachable
            FarTopicShown.Unavailable -> R.string.plan_far_nothing_left
            else -> R.string.plan_far_explain
        }
    val action =
        when (shown) {
            is FarTopicShown.Unreachable -> R.string.load_failed_try_again
            FarTopicShown.Available, is FarTopicShown.Refused -> R.string.plan_far_see_lessons
            else -> null
        }

    if (writing) FollowWhileWritten(topics, open.topic.skillId)
    Row(
        modifier = Modifier.semantics(mergeDescendants = true) { liveRegion = LiveRegionMode.Polite },
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        if (writing) {
            val lineHeight =
                with(LocalDensity.current) {
                    MaterialTheme.typography.bodyMedium.lineHeight
                        .toDp()
                }
            Box(Modifier.height(lineHeight), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(
                    Modifier.size(16.dp).clearAndSetSemantics {},
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    strokeWidth = 2.dp,
                )
            }
        }
        FarTopicText(stringResource(message), Modifier.weight(1f))
    }

    if (action != null) {
        Button(
            onClick = if (failed) topics::retry else topics::request,
            enabled = !open.asking && (limit == null || limit is Limit.SlowDown),
            modifier = Modifier.fillMaxWidth(),
            colors = if (failed) ButtonDefaults.filledTonalButtonColors() else ButtonDefaults.buttonColors(),
        ) {
            AskingMark(open.asking)
            Text(stringResource(action))
        }
    }

    if (limit != null) {
        LimitNotice(
            limit = limit,
            subject = LimitSubject.Outlines,
            onCreateAccount = {
                topics.close()
                navigator.open(AppRoute.Login)
            },
            onSeePlus = {
                topics.close()
                navigator.open(AppRoute.Subscription)
            },
        )
    }
}

@Composable
private fun FarTopicText(
    text: String,
    modifier: Modifier = Modifier,
) {
    Text(text, modifier, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodyMedium)
}

@Composable
private fun AskingMark(asking: Boolean) {
    if (!asking) return
    CircularProgressIndicator(
        Modifier.padding(end = ButtonDefaults.IconSpacing).size(ButtonDefaults.IconSize),
        color = LocalContentColor.current,
        strokeWidth = 2.dp,
    )
}

/** Follows the writing while the sheet shows it and the app is started. */
@Composable
private fun FollowWhileWritten(
    topics: FarTopicViewModel,
    skillId: UUID,
) {
    val lifecycle = LocalLifecycleOwner.current.lifecycle
    LaunchedEffect(lifecycle, skillId) {
        lifecycle.repeatOnLifecycle(Lifecycle.State.STARTED) { topics.follow() }
    }
}
