package com.zoonk.android.feature.activities.sorting

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.selection.toggleable
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.listSaver
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.input.key.key
import androidx.compose.ui.input.key.onKeyEvent
import androidx.compose.ui.input.key.type
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.layout.positionInParent
import androidx.compose.ui.platform.LocalResources
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.feature.activities.ActivityBadge
import com.zoonk.android.feature.activities.ActivityCanvas
import com.zoonk.android.feature.activities.ActivityProps
import com.zoonk.android.feature.activities.ActivityRenderer
import com.zoonk.android.feature.activities.links
import com.zoonk.android.feature.activities.linksAnswer
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatNumber
import com.zoonk.android.ui.richtext.RichText
import com.zoonk.android.ui.theme.withTabularFigures
import com.zoonk.android.ui.theme.zoonk
import com.zoonk.api.models.PlayableLibraryStepAnyOfContentOneOf24FieldsNodesInner
import com.zoonk.api.models.PlayableLibraryStepAnyOfContent.PlayableLibraryStepAnyOfContentOneOf24Value as CauseEffectContent
import com.zoonk.api.models.PlayableLibraryStepAnyOfContentOneOfCheck.PlayableLibraryStepAnyOfContentOneOfCheckOneOfValue as ChoiceCheck

private typealias ChainNode = PlayableLibraryStepAnyOfContentOneOf24FieldsNodesInner

val causeEffectChainRenderer =
    ActivityRenderer(
        badge = { ActivityBadge(R.string.activities_sorting_badge_link_causes, R.drawable.ic_flowchart) },
        canvas = { CauseEffectChainActivity(it) },
    )

@Composable
private fun CauseEffectChainActivity(props: ActivityProps) {
    val content = (props.content as CauseEffectContent).value
    val fields = content.fields
    val nodes = remember(fields) { orderNodes(fields.nodes) { it.year } }
    val order = nodes.map { it.id }
    val truth = fields.links.map { CauseLink(it.from, it.to) }
    val isGuided = content.check is ChoiceCheck
    var links by rememberSaveable(stateSaver = LinksSaver) {
        mutableStateOf(
            props.answer.links
                .orEmpty()
                .map { (from, to) -> CauseLink(from, to) },
        )
    }
    var causeId by rememberSaveable { mutableStateOf<String?>(null) }
    var notice by remember { mutableStateOf("") }
    val centers = remember { mutableStateMapOf<String, Float>() }
    val resources = LocalResources.current
    val locked = props.isChecked || props.isLocked
    val labelOf = { id: String -> fields.nodes.firstOrNull { it.id == id }?.label ?: id }

    fun update(next: List<CauseLink>) {
        links = next
        if (!isGuided) props.onAnswerChange(next.takeIf { it.isNotEmpty() }?.let { linksAnswer(it.map { link -> link.from to link.to }) })
    }

    fun linkTo(
        effectId: String,
        fromId: String,
    ) {
        val link = CauseLink(fromId, effectId)
        val cause = labelOf(fromId)
        val effect = labelOf(effectId)
        if (isGuided && link !in truth) {
            notice = resources.getString(R.string.activities_sorting_not_straight, cause, effect)
            return
        }
        val removing = link in links && !isGuided
        update(if (isGuided && link in links) links else links.toggle(link))
        notice =
            resources.getString(if (removing) R.string.activities_sorting_removed else R.string.activities_sorting_linked, cause, effect)
    }

    fun press(id: String) {
        val cause = causeId
        if (cause == null) {
            causeId = id
            notice = resources.getString(R.string.activities_sorting_cause_picked, labelOf(id))
            return
        }
        causeId = null
        if (cause == id) notice = "" else linkTo(id, cause)
    }

    val results =
        if (props.isChecked && !isGuided) {
            compareLinks(links, truth)
        } else {
            links.map { LinkResult(it, if (isGuided) LinkState.Correct else LinkState.Made) }
        }

    ActivityCanvas {
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.Bottom) {
            Text(
                causeId?.let { stringResource(R.string.activities_sorting_now_pick, labelOf(it)) }
                    ?: stringResource(R.string.activities_sorting_pick_cause),
                Modifier.weight(1f),
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                style = MaterialTheme.typography.bodyMedium,
            )
            if (!isGuided) {
                Text(
                    pluralStringResource(R.plurals.activities_sorting_links_count, truth.size, links.size, truth.size),
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    style = MaterialTheme.typography.labelMedium.withTabularFigures(),
                )
            }
        }

        val listLabel = stringResource(R.string.activities_sorting_causes_and_effects)
        val arcs = arcColors()
        Column(
            Modifier
                .fillMaxWidth()
                .drawBehind { drawArcs(results, centers, order, arcs) }
                .padding(start = ARC_GUTTER.dp)
                .semantics { contentDescription = listLabel },
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            nodes.forEach { node ->
                NodeCard(
                    node = node,
                    isCause = causeId == node.id,
                    isCandidate = causeId != null && causeId != node.id,
                    enabled = !locked,
                    onPress = { press(node.id) },
                    onCancel = {
                        (causeId != null).also {
                            causeId = null
                            notice = ""
                        }
                    },
                    modifier = Modifier.onGloballyPositioned { centers[node.id] = it.positionInParent().y + it.size.height / 2f },
                )
            }
        }

        Text(
            if (locked) "" else notice,
            Modifier.fillMaxWidth().heightIn(min = 20.dp).semantics { liveRegion = LiveRegionMode.Polite },
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            style = MaterialTheme.typography.bodyMedium,
        )

        LinkList(
            results = results,
            labelOf = labelOf,
            why = { link -> fields.links.firstOrNull { it.from == link.from && it.to == link.to }?.why },
            showWhy = isGuided || locked,
            canRemove = !locked && !isGuided,
            onRemove = { update(links.toggle(it)) },
        )
    }
}

@Composable
private fun NodeCard(
    node: ChainNode,
    isCause: Boolean,
    isCandidate: Boolean,
    enabled: Boolean,
    onPress: () -> Unit,
    onCancel: () -> Boolean,
    modifier: Modifier,
) {
    val shape = RoundedCornerShape(12.dp)
    val highlight = MaterialTheme.zoonk.vizHighlight
    val colors = MaterialTheme.colorScheme
    val locale = currentLocale()

    Column(
        modifier
            .fillMaxWidth()
            .heightIn(min = 48.dp)
            .clip(shape)
            .background(colors.surface)
            .then(
                when {
                    isCause -> Modifier.border(2.dp, highlight, shape)
                    isCandidate -> Modifier.dashedOutline(highlight)
                    else -> Modifier.border(1.dp, colors.outline, shape)
                },
            ).onKeyEvent { it.type == KeyEventType.KeyDown && it.key == Key.Escape && onCancel() }
            .toggleable(value = isCause, enabled = enabled, role = Role.Button, onValueChange = { onPress() })
            .padding(horizontal = 12.dp, vertical = 8.dp),
        verticalArrangement = Arrangement.spacedBy(2.dp),
    ) {
        val year = node.year
        if (year != null || isCause) {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                if (year != null) {
                    Text(
                        formatNumber(year.toDouble(), locale, grouping = false),
                        color = colors.onSurfaceVariant,
                        style = MaterialTheme.typography.labelSmall.withTabularFigures(),
                    )
                }
                if (isCause) {
                    Text(
                        stringResource(R.string.activities_sorting_cause),
                        color = highlight,
                        style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.SemiBold),
                    )
                }
            }
        }
        Text(node.label, style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.Medium))
    }
}

@Composable
private fun LinkList(
    results: List<LinkResult>,
    labelOf: (String) -> String,
    why: (CauseLink) -> String?,
    showWhy: Boolean,
    canRemove: Boolean,
    onRemove: (CauseLink) -> Unit,
) {
    if (results.isEmpty()) return
    val colors = MaterialTheme.colorScheme
    val label = stringResource(R.string.activities_sorting_your_links)
    val ledTo = stringResource(R.string.activities_sorting_led_to)

    Column(Modifier.semantics { contentDescription = label }, verticalArrangement = Arrangement.spacedBy(8.dp)) {
        results.forEach { (link, state) ->
            val shape = RoundedCornerShape(12.dp)
            Row(
                Modifier
                    .fillMaxWidth()
                    .then(
                        if (state ==
                            LinkState.Missed
                        ) {
                            Modifier.dashedOutline(colors.outline)
                        } else {
                            Modifier.border(1.dp, colors.outlineVariant, shape)
                        },
                    ).padding(start = 12.dp, top = 8.dp, bottom = 8.dp, end = if (canRemove) 0.dp else 12.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                StateIcon(state)
                Column(Modifier.weight(1f).semantics(mergeDescendants = true) {}, verticalArrangement = Arrangement.spacedBy(2.dp)) {
                    Text(
                        "${labelOf(link.from)} → ${labelOf(link.to)}",
                        Modifier.semantics { contentDescription = "${labelOf(link.from)} $ledTo ${labelOf(link.to)}" },
                        style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.Medium),
                    )
                    when (state) {
                        LinkState.Incorrect -> R.string.activities_sorting_not_a_link
                        LinkState.Missed -> R.string.activities_sorting_missed_link
                        else -> null
                    }?.let { Text(stringResource(it), color = colors.onSurfaceVariant, style = MaterialTheme.typography.labelSmall) }
                    why(link)?.takeIf { showWhy && state != LinkState.Incorrect }?.let {
                        RichText(it, style = MaterialTheme.typography.bodyMedium.copy(color = colors.onSurfaceVariant))
                    }
                }
                if (canRemove) {
                    IconButton(onClick = { onRemove(link) }) {
                        Icon(
                            painterResource(R.drawable.ic_close),
                            contentDescription =
                                stringResource(
                                    R.string.activities_sorting_remove_link,
                                    labelOf(link.from),
                                    labelOf(link.to),
                                ),
                            modifier = Modifier.size(16.dp),
                            tint = colors.onSurfaceVariant,
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun StateIcon(state: LinkState) {
    val colors = MaterialTheme.colorScheme
    val (icon, tint) =
        when (state) {
            LinkState.Correct -> R.drawable.ic_check to colors.tertiary
            LinkState.Incorrect -> R.drawable.ic_close to colors.error
            LinkState.Missed -> R.drawable.ic_radio_button_unchecked to colors.tertiary
            LinkState.Made -> return
        }
    Icon(painterResource(icon), contentDescription = null, modifier = Modifier.padding(top = 2.dp).size(16.dp), tint = tint)
}

private data class ArcColors(
    val made: Color,
    val correct: Color,
    val incorrect: Color,
    val missed: Color,
)

@Composable
private fun arcColors() =
    ArcColors(
        made = MaterialTheme.zoonk.vizHighlight,
        correct = MaterialTheme.colorScheme.tertiary,
        incorrect = MaterialTheme.colorScheme.error,
        missed = MaterialTheme.colorScheme.tertiary.copy(alpha = MISSED_ALPHA),
    )

/** Main's arcs: from each cause's card to its effect's, bowing into the gutter at the start, an arrow at the effect. */
private fun DrawScope.drawArcs(
    results: List<LinkResult>,
    centers: Map<String, Float>,
    order: List<String>,
    colors: ArcColors,
) {
    val gutter = ARC_GUTTER.dp.toPx()
    val end = END_OFFSET.dp.toPx()
    val x = { value: Float -> if (layoutDirection == LayoutDirection.Rtl) size.width - value else value }
    results.forEach { (link, state) ->
        val from = centers[link.from] ?: return@forEach
        val to = centers[link.to] ?: return@forEach
        val span = kotlin.math.abs(order.indexOf(link.to) - order.indexOf(link.from))
        val bend = gutter - arcDepth(span).dp.toPx()
        val start = from - end
        val finish = to + end
        val color =
            when (state) {
                LinkState.Made -> colors.made
                LinkState.Correct -> colors.correct
                LinkState.Incorrect -> colors.incorrect
                LinkState.Missed -> colors.missed
            }
        val dashed = state == LinkState.Incorrect || state == LinkState.Missed
        val stroke =
            Stroke(
                width = ARC_WIDTH.dp.toPx(),
                cap = StrokeCap.Round,
                pathEffect = if (dashed) PathEffect.dashPathEffect(floatArrayOf(5.dp.toPx(), 5.dp.toPx())) else null,
            )
        drawPath(
            Path().apply {
                moveTo(x(gutter), start)
                cubicTo(x(bend), start, x(bend), finish, x(gutter), finish)
            },
            color,
            style = stroke,
        )
        val head = ARROW.dp.toPx()
        val tip = Offset(x(gutter), finish)
        val back = if (layoutDirection == LayoutDirection.Rtl) head else -head
        drawPath(
            Path().apply {
                moveTo(tip.x + back, tip.y - head * ARROW_SPREAD)
                lineTo(tip.x, tip.y)
                lineTo(tip.x + back, tip.y + head * ARROW_SPREAD)
            },
            color,
            style = Stroke(ARC_WIDTH.dp.toPx(), cap = StrokeCap.Round, join = StrokeJoin.Round),
        )
    }
}

private val LinksSaver =
    listSaver<List<CauseLink>, String>(
        save = { links -> links.flatMap { listOf(it.from, it.to) } },
        restore = { saved -> saved.chunked(2).map { (from, to) -> CauseLink(from, to) } },
    )

private const val END_OFFSET = 5
private const val ARC_WIDTH = 2.5f
private const val ARROW = 7f
private const val ARROW_SPREAD = 0.6f
private const val MISSED_ALPHA = 0.7f
