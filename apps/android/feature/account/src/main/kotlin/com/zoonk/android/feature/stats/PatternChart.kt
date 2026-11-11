package com.zoonk.android.feature.stats

import androidx.annotation.DrawableRes
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.layout.wrapContentWidth
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.Hyphens
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.IntRect
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.ui.components.ChartInspector
import com.zoonk.android.ui.components.ChartTooltip
import com.zoonk.android.ui.components.ChartTooltipArea
import com.zoonk.android.ui.components.SectionHeader
import com.zoonk.android.ui.theme.LocalMoreContrast
import com.zoonk.android.ui.theme.ZoonkRadius
import com.zoonk.android.ui.theme.zoonk
import com.zoonk.android.ui.theme.zoonkType

/**
 * A group with too few answers to count is a hollow dashed outline and one without answers has no
 * bar, so neither reads as a result.
 */
internal enum class PatternState { Best, Counted, Few, None }

/** [value] and [note] are the tooltip's lines; [label] is the name under the bar, [name] in full. */
internal data class PatternColumn(
    val name: String,
    val label: String,
    val state: PatternState,
    val share: Float,
    val value: String,
    val note: String?,
    val hours: String? = null,
    @param:DrawableRes val icon: Int? = null,
)

/**
 * Main's `PatternChart`: groups compared on a 0–100% scale, bars rising from one baseline with their
 * value on top and the best one under a crown. A tapped column shows its detail in a tooltip above
 * it. TalkBack reads each column as one: [bestLabel] for the best, its name, hours, value and note.
 */
@Composable
internal fun PatternChart(
    title: String,
    bestLabel: String,
    columns: List<PatternColumn>,
    fullBar: Dp,
    inspector: ChartInspector,
    modifier: Modifier = Modifier,
    footer: String? = null,
) {
    if (columns.isEmpty()) return

    val chart = remember { Any() }
    val active = inspector.indexIn(chart)?.takeIf { it in columns.indices }

    Column(modifier, verticalArrangement = Arrangement.spacedBy(12.dp)) {
        SectionHeader(title)

        ChartTooltipArea(
            tooltip = active?.let { { ChartTooltip(columns[it].name, columns[it].value, note = columns[it].note) } },
            anchor = { area ->
                active?.let {
                    val width = area.width / columns.size
                    IntRect(left = it * width, top = 0, right = (it + 1) * width, bottom = area.height)
                }
            },
            inspector = inspector,
            riseAbove = true,
        ) {
            Row(Modifier.fillMaxWidth()) {
                columns.forEachIndexed { index, column ->
                    PatternColumnView(
                        column = column,
                        bestLabel = bestLabel,
                        fullBar = fullBar,
                        active = index == active,
                        onInspect = { inspector.inspect(chart, index) },
                        modifier = Modifier.weight(1f),
                    )
                }
            }
        }

        footer?.let { StatsLine(it) }
    }
}

@Composable
private fun PatternColumnView(
    column: PatternColumn,
    bestLabel: String,
    fullBar: Dp,
    active: Boolean,
    onInspect: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val scheme = MaterialTheme.colorScheme
    val best = column.state == PatternState.Best
    val quiet = column.state == PatternState.Few || column.state == PatternState.None
    val spoken = listOfNotNull(bestLabel.takeIf { best }, column.name, column.hours, column.value, column.note).joinToString()

    Column(
        modifier
            .clip(RoundedCornerShape(ZoonkRadius.lg))
            .background(if (active) scheme.surfaceContainerHigh else Color.Transparent)
            .selectable(selected = active, onClick = onInspect)
            .clearAndSetSemantics { contentDescription = spoken }
            .padding(top = 4.dp, bottom = 8.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        PatternPlot(column, fullBar)

        column.icon?.let {
            Box(
                Modifier.size(CHIP).background(if (best) scheme.tertiary else scheme.surfaceContainerHighest, CircleShape),
                contentAlignment = Alignment.Center,
            ) {
                Icon(
                    painterResource(it),
                    contentDescription = null,
                    modifier = Modifier.size(CHIP_ICON),
                    tint =
                        when {
                            best -> scheme.background
                            quiet -> scheme.onSurfaceVariant
                            else -> scheme.onSurface
                        },
                )
            }
        }

        Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(
                column.label,
                modifier = Modifier.padding(horizontal = 2.dp),
                color = if (best) scheme.onSurface else scheme.onSurfaceVariant,
                style = MaterialTheme.typography.bodySmall.copy(hyphens = Hyphens.Auto),
                fontWeight = if (best) FontWeight.Medium else null,
                textAlign = TextAlign.Center,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
            )
            column.hours?.let {
                Text(it, color = MaterialTheme.zoonk.faint, style = MaterialTheme.zoonkType.eyebrow, textAlign = TextAlign.Center)
            }
        }
    }
}

/** The room above a full bar holds its value and the best column's crown, at any font size. */
@Composable
private fun PatternPlot(
    column: PatternColumn,
    fullBar: Dp,
) {
    val scheme = MaterialTheme.colorScheme
    val best = column.state == PatternState.Best
    val quiet = column.state == PatternState.Few || column.state == PatternState.None
    val valueStyle = MaterialTheme.zoonkType.data
    val headroom = CROWN + VALUE_GAP * 2 + with(LocalDensity.current) { valueStyle.lineHeight.toDp() }
    val baseline = scheme.outlineVariant

    Column(
        Modifier
            .fillMaxWidth()
            .height(fullBar + headroom + BASELINE)
            .drawBehind {
                val y = size.height - BASELINE.toPx() / 2
                drawLine(baseline, Offset(0f, y), Offset(size.width, y), strokeWidth = BASELINE.toPx())
            }.padding(bottom = BASELINE),
        verticalArrangement = Arrangement.spacedBy(VALUE_GAP, Alignment.Bottom),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        if (best) {
            Box(Modifier.size(CROWN).background(scheme.tertiary, CircleShape), contentAlignment = Alignment.Center) {
                Icon(
                    painterResource(R.drawable.ic_crown),
                    contentDescription = null,
                    modifier = Modifier.size(CROWN_ICON),
                    tint = scheme.background,
                )
            }
        }

        Text(
            if (column.state == PatternState.None) DASH else column.value,
            modifier = Modifier.wrapContentWidth(unbounded = true),
            color = if (quiet) scheme.onSurfaceVariant else scheme.onSurface,
            style = valueStyle,
            fontWeight = if (best) FontWeight.SemiBold else null,
            maxLines = 1,
            softWrap = false,
        )

        if (column.state != PatternState.None) {
            PatternBar(column.state, Modifier.height((fullBar * column.share).coerceAtLeast(MIN_BAR)))
        }
    }
}

@Composable
private fun PatternBar(
    state: PatternState,
    modifier: Modifier = Modifier,
) {
    val scheme = MaterialTheme.colorScheme
    val sized = modifier.widthIn(max = BAR_WIDTH).fillMaxWidth()
    val shape = RoundedCornerShape(topStart = BAR_CORNER, topEnd = BAR_CORNER)

    if (state != PatternState.Few) {
        Box(sized.background(if (state == PatternState.Best) scheme.tertiary else scheme.tertiary.copy(alpha = COUNTED_ALPHA), shape))
        return
    }

    val outline = if (LocalMoreContrast.current) scheme.onSurface else scheme.onSurface.copy(alpha = FEW_OUTLINE_ALPHA)

    Box(
        sized.drawBehind {
            val line = FEW_OUTLINE.toPx()
            val inset = line / 2
            val corner = BAR_CORNER.toPx()
            val path =
                Path().apply {
                    moveTo(inset, size.height)
                    lineTo(inset, corner)
                    quadraticTo(inset, inset, corner, inset)
                    lineTo(size.width - corner, inset)
                    quadraticTo(size.width - inset, inset, size.width - inset, corner)
                    lineTo(size.width - inset, size.height)
                }
            val dash = FEW_DASH.toPx()
            drawPath(path, outline, style = Stroke(width = line, pathEffect = PathEffect.dashPathEffect(floatArrayOf(dash, dash))))
        },
    )
}

private const val DASH = "–"
private const val COUNTED_ALPHA = 0.45f
private const val FEW_OUTLINE_ALPHA = 0.3f
private val CROWN = 24.dp
private val CROWN_ICON = 14.dp
private val VALUE_GAP = 4.dp
private val BASELINE = 1.dp
private val BAR_WIDTH = 32.dp
private val BAR_CORNER = 3.dp
private val MIN_BAR = 2.dp
private val FEW_OUTLINE = 1.dp
private val FEW_DASH = 3.dp
private val CHIP = 36.dp
private val CHIP_ICON = 20.dp
