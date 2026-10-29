package com.zoonk.android.feature.goalcontent

import android.icu.text.DateFormat
import android.icu.util.TimeZone
import android.icu.util.ULocale
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.animation.expandVertically
import androidx.compose.animation.shrinkVertically
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
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
import androidx.compose.material3.ListItem
import androidx.compose.material3.ListItemDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.collapse
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.expand
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
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppTab
import com.zoonk.android.ui.components.LabelChip
import com.zoonk.android.ui.components.MarkStatus
import com.zoonk.android.ui.components.StatusMark
import com.zoonk.android.ui.components.StatusMessage
import com.zoonk.android.ui.components.markSize
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatNumber
import com.zoonk.android.ui.theme.zoonk
import com.zoonk.api.models.SyllabusChapter
import java.net.URI
import java.time.LocalDate
import java.util.Date
import java.util.Locale

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

/** A heading inside a block, such as a notice's heading over its topics. */
@Composable
internal fun SectionLabel(
    text: String,
    modifier: Modifier = Modifier,
) {
    Text(
        text = text,
        modifier = modifier.padding(horizontal = PAGE_PADDING).semantics { heading() },
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        style = MaterialTheme.typography.labelLarge,
    )
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

/** A row of a list: the learner's place is highlighted, and a row without [onClick] is plain text. */
@Composable
internal fun ContentRow(
    headline: @Composable () -> Unit,
    modifier: Modifier = Modifier,
    onClick: (() -> Unit)? = null,
    current: Boolean = false,
    leading: (@Composable () -> Unit)? = null,
    supporting: (@Composable () -> Unit)? = null,
    trailing: (@Composable () -> Unit)? = null,
    stateDescription: String? = null,
) {
    ListItem(
        headlineContent = headline,
        modifier =
            (if (onClick == null) modifier else modifier.clickable(onClick = onClick))
                .semantics(mergeDescendants = true) { if (stateDescription != null) this.stateDescription = stateDescription },
        leadingContent = leading,
        supportingContent = supporting,
        trailingContent = trailing,
        colors =
            ListItemDefaults.colors(
                containerColor = if (current) MaterialTheme.colorScheme.surfaceContainerHigh else MaterialTheme.colorScheme.surface,
            ),
    )
}

/** A row that opens what's under it in place; TalkBack hears whether it's open. */
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
    val turn by animateFloatAsState(if (expanded) HALF_TURN else 0f, tween(EXPAND_MILLIS), label = "chevron")

    Column(modifier) {
        ListItem(
            headlineContent = headline,
            modifier =
                Modifier
                    .clickable(onClick = onToggle)
                    .semantics {
                        if (stateDescription != null) this.stateDescription = stateDescription
                        if (expanded) {
                            collapse {
                                onToggle()
                                true
                            }
                        } else {
                            expand {
                                onToggle()
                                true
                            }
                        }
                    },
            leadingContent = leading,
            supportingContent = supporting,
            trailingContent = {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                    trailing?.invoke()
                    Icon(
                        painter = painterResource(R.drawable.ic_expand_more),
                        contentDescription = null,
                        modifier = Modifier.rotate(turn),
                        tint = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            },
        )
        AnimatedVisibility(
            visible = expanded,
            enter = expandVertically(tween(EXPAND_MILLIS)),
            exit = shrinkVertically(tween(EXPAND_MILLIS)),
        ) {
            content()
        }
    }
}

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

/** A share done as a ring, in blue on a faint track. Decorative. */
@Composable
internal fun ProgressRing(
    share: Double,
    modifier: Modifier = Modifier,
) {
    val track = MaterialTheme.colorScheme.onSurface.copy(alpha = RING_TRACK_ALPHA)
    val fill = MaterialTheme.colorScheme.tertiary

    Canvas(modifier.clearAndSetSemantics {}) {
        val stroke = size.minDimension * RING_STROKE
        val inset = stroke / 2
        val arcSize = Size(size.width - stroke, size.height - stroke)
        drawCircle(track, radius = (size.minDimension - stroke) / 2, style = Stroke(stroke))
        drawArc(
            color = fill,
            startAngle = -90f,
            sweepAngle = FULL_TURN * share.coerceIn(0.0, 1.0).toFloat(),
            useCenter = false,
            topLeft = Offset(inset, inset),
            size = arcSize,
            style = Stroke(stroke, cap = StrokeCap.Round),
        )
    }
}

@Composable
internal fun ChapterMark(
    chapter: SyllabusChapter,
    isNext: Boolean,
) {
    when {
        isNext -> {
            StatusMark(MarkStatus.Next, contentDescription = stringResource(R.string.goalcontent_up_next))
        }

        chapter.state != SyllabusChapter.State.DONE && !chapter.writing && chapter.lessonsDone > 0 && chapter.lessonsTotal > 0 -> {
            val locale = currentLocale()
            val spoken =
                pluralStringResource(
                    R.plurals.goalcontent_lessons_done_spoken,
                    chapter.lessonsTotal.toInt(),
                    formatNumber(chapter.lessonsDone.toDouble(), locale),
                    chapter.lessonsTotal.toInt(),
                )
            Box(Modifier.size(markSize()).semantics { contentDescription = spoken }, contentAlignment = Alignment.Center) {
                ProgressRing(chapter.lessonsDone.toDouble() / chapter.lessonsTotal, Modifier.size(markSize() * RING_SHARE))
            }
        }

        chapter.state == SyllabusChapter.State.DONE && chapter.known -> {
            StatusMark(MarkStatus.Skipped, contentDescription = stringResource(R.string.goalcontent_skipped))
        }

        chapter.state == SyllabusChapter.State.DONE -> {
            StatusMark(MarkStatus.Done, contentDescription = stringResource(R.string.goalcontent_done))
        }

        else -> {
            StatusMark(MarkStatus.Todo)
        }
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
            Box(Modifier.size(markSize()), contentAlignment = Alignment.Center) {
                ProgressRing(mark.share.coerceAtLeast(MIN_RING_SHARE), Modifier.size(markSize() * RING_SHARE * scale))
            }
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

@Composable
internal fun PlusChip(modifier: Modifier = Modifier) {
    val spoken = stringResource(R.string.goalcontent_plus_spoken)
    LabelChip(
        text = stringResource(R.string.goalcontent_plus),
        modifier = modifier.clearAndSetSemantics { contentDescription = spoken },
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

/** When a far topic starts: its day this month, else its month, with the year only in another year. */
internal fun formatStart(
    date: LocalDate,
    today: LocalDate,
    locale: Locale,
): String {
    val skeleton =
        when {
            date.year == today.year && date.month == today.month -> "MMMd"
            date.year == today.year -> "MMMM"
            else -> "yMMMM"
        }
    return DateFormat
        .getInstanceForSkeleton(skeleton, ULocale.forLocale(locale))
        .apply { timeZone = TimeZone.GMT_ZONE }
        .format(Date(date.toEpochDay() * MILLIS_PER_DAY))
}

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

private const val HALF_TURN = 180f
private const val FULL_TURN = 360f
private const val EXPAND_MILLIS = 200
private const val KNOWN_ALPHA = 0.7f
private const val RING_TRACK_ALPHA = 0.1f
private const val RING_STROKE = 0.09f
private const val RING_SHARE = 0.6f
private const val SMALL_MARK = 0.85f
private const val MINUS_SHARE = 0.7f
private const val MIN_RING_SHARE = 0.15
private const val CHIP_TINT_ALPHA = 0.15f
private const val MILLIS_PER_DAY = 86_400_000L
private val BAR_HEIGHT = 6.dp
private val BAR_CORNER = 3.dp
