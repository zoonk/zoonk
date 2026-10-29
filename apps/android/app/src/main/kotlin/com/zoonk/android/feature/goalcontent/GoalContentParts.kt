package com.zoonk.android.feature.goalcontent

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyListScope
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.LocalContentColor
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ProvideTextStyle
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.LinkAnnotation
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.TextLinkStyles
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.withLink
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.data.LoadState
import com.zoonk.android.data.Resource
import com.zoonk.android.data.collectShown
import com.zoonk.android.data.value
import com.zoonk.android.feature.plan.planGoal
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppTab
import com.zoonk.android.ui.components.ListRow
import com.zoonk.android.ui.components.ListRowChevron
import com.zoonk.android.ui.components.ListRowLeading
import com.zoonk.android.ui.components.LoadFailedMessage
import com.zoonk.android.ui.components.MarkStatus
import com.zoonk.android.ui.components.ProgressMark
import com.zoonk.android.ui.components.StatusMark
import com.zoonk.android.ui.components.StatusMessage
import com.zoonk.android.ui.components.TitleAndMeta
import com.zoonk.android.ui.components.markSize
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatNumber
import com.zoonk.android.ui.scaffold.PageScaffold
import com.zoonk.android.ui.theme.zoonk
import com.zoonk.api.models.LearnerSummary
import com.zoonk.api.models.LearnerSummaryGoal
import kotlinx.coroutines.launch
import java.net.URI

internal val PAGE_PADDING = 16.dp

/** Main's gap between a page's blocks. */
internal val SECTION_GAP = 32.dp

/** A block's title with its count at the end, as a TalkBack heading. */
@Composable
internal fun SectionTitle(
    title: String,
    modifier: Modifier = Modifier,
    detail: String? = null,
) {
    Row(
        modifier = modifier.fillMaxWidth().padding(horizontal = PAGE_PADDING),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            text = title,
            modifier = Modifier.weight(1f).semantics { heading() },
            style = MaterialTheme.typography.titleMedium,
        )
        if (detail != null) {
            Text(text = detail, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodyMedium)
        }
    }
}

@Composable
internal fun SectionNote(
    text: AnnotatedString,
    modifier: Modifier = Modifier,
) {
    Text(
        text = text,
        modifier = modifier.padding(horizontal = PAGE_PADDING),
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        style = MaterialTheme.typography.bodySmall,
    )
}

/** Main's hairline between a list's rows, as wide as the page's column. */
@Composable
internal fun RowDivider() {
    HorizontalDivider(Modifier.padding(horizontal = PAGE_PADDING))
}

/** A row of a list, drawn as the Plan's rows are; one that opens a page ends in a chevron. */
@Composable
internal fun ContentRow(
    headline: @Composable () -> Unit,
    modifier: Modifier = Modifier,
    onClick: (() -> Unit)? = null,
    current: Boolean = false,
    chevron: Boolean = onClick != null,
    leading: (@Composable () -> Unit)? = null,
    supporting: (@Composable () -> Unit)? = null,
    trailing: (@Composable () -> Unit)? = null,
    stateDescription: String? = null,
) {
    ListRow(
        modifier = modifier.padding(horizontal = PAGE_PADDING),
        onClick = onClick,
        highlighted = current,
        stateDescription = stateDescription,
        end = if (chevron) ({ ListRowChevron() }) else null,
    ) {
        RowWords(headline, leading, supporting, trailing)
    }
}

/** A row that opens what's under it in place. */
@Composable
internal fun ExpandableRow(
    expanded: Boolean,
    onToggle: () -> Unit,
    headline: @Composable () -> Unit,
    modifier: Modifier = Modifier,
    leading: (@Composable () -> Unit)? = null,
    supporting: (@Composable () -> Unit)? = null,
    trailing: (@Composable () -> Unit)? = null,
    stateDescription: String? = null,
    content: @Composable () -> Unit,
) {
    Column(modifier) {
        ListRow(
            modifier = Modifier.padding(horizontal = PAGE_PADDING),
            onClick = onToggle,
            expanded = expanded,
            stateDescription = stateDescription,
        ) {
            RowWords(headline, leading, supporting, trailing)
        }
        if (expanded) content()
    }
}

@Composable
private fun RowScope.RowWords(
    headline: @Composable () -> Unit,
    leading: (@Composable () -> Unit)?,
    supporting: (@Composable () -> Unit)?,
    trailing: (@Composable () -> Unit)?,
) {
    val quiet = MaterialTheme.colorScheme.onSurfaceVariant
    if (leading != null) ListRowLeading(leading)
    TitleAndMeta(
        modifier = Modifier.weight(1f),
        meta = { if (trailing != null) CompositionLocalProvider(LocalContentColor provides quiet, content = trailing) },
    ) {
        ProvideTextStyle(MaterialTheme.typography.bodyLarge.copy(fontWeight = FontWeight.Medium), headline)
        if (supporting != null) {
            CompositionLocalProvider(LocalContentColor provides quiet) {
                ProvideTextStyle(MaterialTheme.typography.bodyMedium, supporting)
            }
        }
    }
}

/** Where words under a row's start, past its mark. */
@Composable
internal fun rowWordsStart(): Dp = PAGE_PADDING + markSize() + 12.dp

/** A row's words with a chip after them, which moves under them when the line has no room. */
@Composable
internal fun TitleWithChip(
    chip: (@Composable () -> Unit)?,
    title: @Composable () -> Unit,
) {
    if (chip == null) {
        title()
        return
    }
    FlowRow(
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalArrangement = Arrangement.spacedBy(4.dp),
        itemVerticalAlignment = Alignment.CenterVertically,
    ) {
        title()
        chip()
    }
}

/** "4. Title": a row's number quiet before its words. */
@Composable
internal fun numberedTitle(
    number: Long,
    title: String,
): AnnotatedString {
    val quiet = MaterialTheme.colorScheme.onSurfaceVariant
    val locale = currentLocale()
    return buildAnnotatedString {
        withStyle(SpanStyle(color = quiet, fontFeatureSettings = "tnum")) {
            append(formatNumber(number.toDouble(), locale, grouping = false))
            append(". ")
        }
        append(title)
    }
}

/** Main's progress bar: studied in blue, then known in gray, on the track; hidden from TalkBack. */
@Composable
internal fun CoverageBar(
    studied: Double,
    modifier: Modifier = Modifier,
    known: Double = 0.0,
) {
    val track = MaterialTheme.colorScheme.surfaceContainerHighest
    val studiedColor = MaterialTheme.colorScheme.tertiary
    val knownColor = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = KNOWN_ALPHA)
    val rtl = LocalLayoutDirection.current == LayoutDirection.Rtl
    val studiedShare = studied.coerceIn(0.0, 1.0).toFloat()
    val knownShare = known.coerceIn(0.0, 1.0 - studiedShare).toFloat()

    Canvas(
        modifier
            .fillMaxWidth()
            .height(BAR_HEIGHT)
            .clip(RoundedCornerShape(BAR_CORNER))
            .clearAndSetSemantics {},
    ) {
        drawRect(track)
        val studiedWidth = size.width * studiedShare
        val knownWidth = size.width * knownShare

        fun x(
            start: Float,
            width: Float,
        ) = if (rtl) size.width - start - width else start
        drawRect(studiedColor, Offset(x(0f, studiedWidth), 0f), Size(studiedWidth, size.height))
        drawRect(knownColor, Offset(x(studiedWidth, knownWidth), 0f), Size(knownWidth, size.height))
    }
}

@Composable
internal fun FilledDot(
    color: Color,
    modifier: Modifier,
) {
    Canvas(modifier) { drawCircle(color) }
}

/** Decorative: the row's words carry its state for TalkBack. */
@Composable
internal fun TopicMarkIcon(
    mark: TopicMark?,
    small: Boolean = false,
) {
    val scale = if (small) SMALL_MARK else 1f
    when (mark) {
        null -> {
            Box(Modifier.size(markSize()))
        }

        TopicMark.Studied, TopicMark.Known -> {
            StatusMark(MarkStatus.Done, Modifier.size(markSize() * scale))
        }

        TopicMark.ToStudy -> {
            StatusMark(MarkStatus.Todo, Modifier.size(markSize() * scale))
        }

        is TopicMark.InProgress -> {
            ProgressMark(mark.share.coerceAtLeast(MIN_RING_SHARE).toFloat(), Modifier.size(markSize() * scale))
        }

        TopicMark.NotPlanned -> {
            Box(Modifier.size(markSize()), contentAlignment = Alignment.Center) {
                Icon(
                    painter = painterResource(R.drawable.ic_do_not_disturb_on),
                    contentDescription = null,
                    modifier = Modifier.size(markSize() * MINUS_SHARE * scale),
                    tint = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    }
}

@Composable
internal fun topicMarkWords(mark: TopicMark?): String? =
    when (mark) {
        null -> null
        TopicMark.Studied -> stringResource(R.string.goalcontent_studied)
        TopicMark.Known -> stringResource(R.string.goalcontent_topic_known)
        TopicMark.ToStudy -> stringResource(R.string.goalcontent_topic_to_study)
        TopicMark.NotPlanned -> stringResource(R.string.goalcontent_not_in_plan)
        is TopicMark.InProgress -> stringResource(R.string.goalcontent_topic_in_progress)
    }

/** "Appears a lot": a few words on a soft amber tint, never color alone. */
@Composable
internal fun FrequencyChip(modifier: Modifier = Modifier) {
    Text(
        text = stringResource(R.string.goalcontent_appears_a_lot),
        modifier =
            modifier
                .background(MaterialTheme.zoonk.warning.copy(alpha = CHIP_TINT_ALPHA), MaterialTheme.shapes.extraSmall)
                .padding(horizontal = 6.dp, vertical = 2.dp),
        style = MaterialTheme.typography.labelMedium,
        maxLines = 1,
    )
}

/** "%1$s" filled with words drawn as [FrequencyChip]'s mark, inside a sentence. */
@Composable
internal fun frequencyMarkStyle(): SpanStyle =
    SpanStyle(
        background = MaterialTheme.zoonk.warning.copy(alpha = CHIP_TINT_ALPHA),
        color = MaterialTheme.colorScheme.onSurface,
        fontWeight = FontWeight.Medium,
    )

/** Annotates [parts] found in [text] in order: links open their site, styles mark their words. */
internal fun annotate(
    text: String,
    vararg parts: Pair<String, Any>,
): AnnotatedString =
    buildAnnotatedString {
        var from = 0
        val found =
            parts
                .mapNotNull { (words, how) -> text.indexOf(words).takeIf { it >= 0 && words.isNotEmpty() }?.let { Triple(it, words, how) } }
                .sortedBy { it.first }
        for ((start, words, how) in found) {
            if (start < from) continue
            append(text.substring(from, start))
            when (how) {
                is LinkTarget -> {
                    withLink(LinkAnnotation.Url(how.url, TextLinkStyles(SpanStyle(textDecoration = TextDecoration.Underline)))) {
                        append(words)
                    }
                }

                is SpanStyle -> {
                    withStyle(how) { append(words) }
                }
            }
            from = start + words.length
        }
        append(text.substring(from))
    }

internal data class LinkTarget(
    val url: String,
)

/** A source's site as people say it: "inep.gov.br". */
internal fun sourceHost(url: String): String =
    runCatching { URI(url).host }
        .getOrNull()
        ?.removePrefix("www.")
        ?: url

@Composable
internal fun ContinueButton(
    started: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Button(onClick = onClick, modifier = modifier) {
        Text(stringResource(if (started) R.string.goalcontent_continue else R.string.goalcontent_start))
    }
}

/**
 * A page about the learner's plan goal: loading while the summary loads, its failure with Retry,
 * and not found only once the summary says there's no plan goal.
 */
@Composable
internal fun WithPlanGoal(
    summary: Resource<LearnerSummary>,
    navigator: AppNavigator,
    frame: @Composable (
        content: @Composable (PaddingValues) -> Unit,
    ) -> Unit = { PageScaffold(onBack = { navigator.back() }, content = it) },
    content: @Composable (LearnerSummaryGoal) -> Unit,
) {
    val state by summary.collectShown()
    val scope = rememberCoroutineScope()
    val goal = state.value?.planGoal

    when {
        goal != null -> content(goal)
        state.value != null || state == LoadState.Empty -> frame { PageNotFound(navigator, it) }
        state is LoadState.Failed -> frame { LoadFailedMessage(onRetry = { scope.launch { summary.refresh() } }, Modifier.padding(it)) }
        else -> frame { PageLoading(it) }
    }
}

@Composable
internal fun PageLoading(padding: PaddingValues) {
    Box(Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.Center) {
        CircularProgressIndicator(color = MaterialTheme.colorScheme.tertiary)
    }
}

@Composable
internal fun PageNotFound(
    navigator: AppNavigator,
    padding: PaddingValues,
) {
    Box(Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.Center) {
        StatusMessage(
            icon = R.drawable.ic_search_off,
            title = stringResource(R.string.goalcontent_not_found_title),
            description = stringResource(R.string.goalcontent_not_found_description),
        ) {
            Button(onClick = { navigator.showRoot(AppTab.Today) }) { Text(stringResource(R.string.goalcontent_not_found_action)) }
        }
    }
}

/** Adds [rows] with a hairline between each. */
internal inline fun <T> LazyListScope.dividedItems(
    rows: List<T>,
    crossinline key: (T) -> Any,
    contentType: Any,
    crossinline row: @Composable (T) -> Unit,
) {
    rows.forEachIndexed { index, value ->
        item(key = key(value), contentType = contentType) {
            Column {
                if (index > 0) RowDivider()
                row(value)
            }
        }
    }
}

private const val KNOWN_ALPHA = 0.7f
private const val SMALL_MARK = 0.85f
private const val MINUS_SHARE = 0.7f
private const val MIN_RING_SHARE = 0.15
private const val CHIP_TINT_ALPHA = 0.15f
private val BAR_HEIGHT = 6.dp
private val BAR_CORNER = 3.dp
