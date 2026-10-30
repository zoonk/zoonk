package com.zoonk.android.feature.language

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.ui.components.LevelBar
import com.zoonk.android.ui.components.MarkedLine
import com.zoonk.android.ui.components.SectionHeader
import com.zoonk.android.ui.components.levelShare
import com.zoonk.android.ui.format.DateStyle
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatDate
import com.zoonk.android.ui.format.formatList
import com.zoonk.android.ui.theme.withTabularFigures
import com.zoonk.api.models.LanguageProgress
import com.zoonk.api.models.LanguageSkillLevel
import kotlinx.datetime.LocalDate
import kotlinx.datetime.toJavaLocalDate

/**
 * Main's `SkillLevelsCard`: each skill's level on the CEFR bands, the goal's mark on them, and what
 * rose since the level test. Before the first level only the line saying levels move shows.
 */
@Composable
fun SkillLevelsCard(
    progress: LanguageProgress,
    modifier: Modifier = Modifier,
) {
    val target = progress.target

    Column(modifier, verticalArrangement = Arrangement.spacedBy(12.dp)) {
        if (progress.levels.isNotEmpty()) {
            FlowRow(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalArrangement = Arrangement.spacedBy(4.dp),
                itemVerticalAlignment = Alignment.CenterVertically,
            ) {
                SectionHeader(stringResource(R.string.language_level_by_skill))
                if (target != null) TargetLabel(target.label, progress.goal.targetDate)
            }
            LevelGrid(progress.levels, target?.let { levelShare(it.score) })
        }
        RiseLine(progress.levels)
    }
}

@Composable
fun skillName(skill: LanguageSkillLevel.Skill): String =
    stringResource(
        when (skill) {
            LanguageSkillLevel.Skill.READING -> R.string.language_skill_reading
            LanguageSkillLevel.Skill.LISTENING -> R.string.language_skill_listening
            LanguageSkillLevel.Skill.SPEAKING -> R.string.language_skill_speaking
            LanguageSkillLevel.Skill.WRITING -> R.string.language_skill_writing
        },
    )

/** Skills that rose since the level test, the biggest rise first. */
internal fun listRises(levels: List<LanguageSkillLevel>): List<LanguageSkillLevel> =
    levels
        .filter { it.trend == LanguageSkillLevel.Trend.UP }
        .sortedByDescending { it.score - (parseCefrScore(it.startLabel) ?: it.score) }

/** "B1" is 2 and "B1+" 2.5, from A1 (0) to C2 (5); null for anything else. */
internal fun parseCefrScore(label: String): Double? {
    val level = label.trim().uppercase()
    val band = CEFR_LEVELS.indexOf(level.removeSuffix("+"))
    if (band < 0) return null
    return minOf(MAX_CEFR_SCORE, band + if (level.endsWith("+")) HALF_STEP else 0.0)
}

private val CEFR_LEVELS = listOf("A1", "A2", "B1", "B2", "C1", "C2")
private const val MAX_CEFR_SCORE = 5.0
private const val HALF_STEP = 0.5

@Composable
private fun TargetLabel(
    label: String,
    date: LocalDate?,
) {
    val style = MaterialTheme.typography.bodySmall
    val tick = MaterialTheme.colorScheme.onSurfaceVariant
    val tickHeight = with(LocalDensity.current) { style.fontSize.toDp() }

    Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
        Canvas(Modifier.size(TARGET_WIDTH, tickHeight)) { dashedLine(tick, size.width / 2, 0f, size.height) }
        Text(
            text =
                if (date == null) {
                    stringResource(R.string.language_level_goal, label)
                } else {
                    stringResource(
                        R.string.language_level_goal_by,
                        label,
                        formatDate(date.toJavaLocalDate(), currentLocale(), DateStyle.Month),
                    )
                },
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            style = style,
        )
    }
}

/**
 * The skill names take the room the longest one needs, the bands what's left. When that leaves the
 * bands too little room for their labels (large text, a narrow pane), each name goes over its bands.
 */
@Composable
private fun LevelGrid(
    levels: List<LanguageSkillLevel>,
    targetShare: Double?,
) {
    val nameStyle = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.Medium)
    val levelStyle = MaterialTheme.typography.labelMedium.withTabularFigures()
    val bandStyle = MaterialTheme.typography.labelSmall.withTabularFigures()
    val names = levels.map { skillName(it.skill) }
    val measurer = rememberTextMeasurer()
    val density = LocalDensity.current
    val trendSize = with(density) { levelStyle.lineHeight.toDp() }

    BoxWithConstraints(Modifier.fillMaxWidth()) {
        val nameWidth = with(density) { (names.maxOfOrNull { measurer.measure(it, nameStyle).size.width } ?: 0).toDp() }
        val levelLabelWidth = with(density) { (levels.maxOfOrNull { measurer.measure(it.label, levelStyle).size.width } ?: 0).toDp() }
        val bandWidth = with(density) { CEFR_LEVELS.maxOf { measurer.measure(it, bandStyle).size.width }.toDp() } + BAND_ROOM
        val level = levelLabelWidth + TREND_GAP + trendSize
        val barsBeside = maxWidth - nameWidth - level - COLUMN_GAP * 2
        val columns = Columns(name = nameWidth.takeIf { barsBeside >= bandWidth * CEFR_LEVELS.size }, level = level)

        Column {
            BandHeader(columns, bandStyle)
            levels.forEachIndexed { index, level ->
                if (index > 0) HorizontalDivider()
                LevelRow(level, names[index], columns, nameStyle, levelStyle, trendSize, targetShare)
            }
        }
    }
}

/** A null [name] stacks each name over its bands. */
private class Columns(
    val name: Dp?,
    val level: Dp,
)

@Composable
private fun BandHeader(
    columns: Columns,
    style: TextStyle,
) {
    Row(Modifier.fillMaxWidth().clearAndSetSemantics {}, horizontalArrangement = Arrangement.spacedBy(COLUMN_GAP)) {
        columns.name?.let { Box(Modifier.width(it)) }
        Row(Modifier.weight(1f)) {
            CEFR_LEVELS.forEach { band ->
                Text(
                    text = band,
                    modifier = Modifier.weight(1f),
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    textAlign = TextAlign.Center,
                    softWrap = false,
                    style = style,
                )
            }
        }
        Box(Modifier.width(columns.level))
    }
}

@Composable
private fun LevelRow(
    level: LanguageSkillLevel,
    name: String,
    columns: Columns,
    nameStyle: TextStyle,
    levelStyle: TextStyle,
    trendSize: Dp,
    targetShare: Double?,
) {
    val trend =
        when (level.trend) {
            LanguageSkillLevel.Trend.UP -> stringResource(R.string.language_level_up)
            LanguageSkillLevel.Trend.DOWN -> stringResource(R.string.language_level_down)
            LanguageSkillLevel.Trend.SAME -> null
        }
    val spoken =
        if (trend == null) {
            stringResource(R.string.language_skill_level, name, level.label)
        } else {
            stringResource(R.string.language_skill_level_trend, name, level.label, trend)
        }
    val bars =
        @Composable { barsModifier: Modifier ->
            Row(barsModifier, horizontalArrangement = Arrangement.spacedBy(COLUMN_GAP), verticalAlignment = Alignment.CenterVertically) {
                LevelBar(level.score, Modifier.weight(1f).targetTick(targetShare))
                Row(
                    Modifier.width(columns.level),
                    horizontalArrangement = Arrangement.End,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(level.label, style = levelStyle)
                    Box(Modifier.padding(start = TREND_GAP).size(trendSize), contentAlignment = Alignment.Center) {
                        TrendArrow(level.trend)
                    }
                }
            }
        }
    val rowModifier =
        Modifier
            .fillMaxWidth()
            .heightIn(min = 48.dp)
            .padding(vertical = 10.dp)
            .clearAndSetSemantics { contentDescription = spoken }

    if (columns.name != null) {
        Row(rowModifier, horizontalArrangement = Arrangement.spacedBy(COLUMN_GAP), verticalAlignment = Alignment.CenterVertically) {
            Text(name, Modifier.width(columns.name), style = nameStyle)
            bars(Modifier.weight(1f))
        }
    } else {
        Column(rowModifier, verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Text(name, style = nameStyle)
            bars(Modifier.fillMaxWidth())
        }
    }
}

@Composable
private fun TrendArrow(trend: LanguageSkillLevel.Trend) {
    when (trend) {
        LanguageSkillLevel.Trend.UP -> {
            Icon(painterResource(R.drawable.ic_arrow_upward), null, tint = MaterialTheme.colorScheme.onTertiaryContainer)
        }

        LanguageSkillLevel.Trend.DOWN -> {
            Icon(painterResource(R.drawable.ic_arrow_downward), null, tint = MaterialTheme.colorScheme.onSurfaceVariant)
        }

        LanguageSkillLevel.Trend.SAME -> {}
    }
}

/** The goal's mark across a skill's bands, as the target label's tick shows it. */
@Composable
private fun Modifier.targetTick(share: Double?): Modifier {
    if (share == null) return this
    val color = MaterialTheme.colorScheme.onSurfaceVariant
    val rtl = LocalLayoutDirection.current == LayoutDirection.Rtl
    return drawWithContent {
        drawContent()
        val reach = TICK_REACH.toPx()
        val along = size.width * share.toFloat()
        dashedLine(color, if (rtl) size.width - along else along, -reach, size.height + reach)
    }
}

private fun DrawScope.dashedLine(
    color: Color,
    x: Float,
    top: Float,
    bottom: Float,
) {
    val dash = DASH.toPx()
    drawLine(
        color = color,
        start = Offset(x, top),
        end = Offset(x, bottom),
        strokeWidth = TARGET_WIDTH.toPx(),
        pathEffect = PathEffect.dashPathEffect(floatArrayOf(dash, dash)),
    )
}

@Composable
private fun RiseLine(levels: List<LanguageSkillLevel>) {
    val rises = listRises(levels)
    val only = rises.firstOrNull()
    val style = MaterialTheme.typography.bodyMedium

    if (only == null) {
        Text(stringResource(R.string.language_levels_move), color = MaterialTheme.colorScheme.onSurfaceVariant, style = style)
        return
    }

    val text =
        if (rises.size == 1) {
            stringResource(R.string.language_level_rose, skillName(only.skill), only.label)
        } else {
            pluralStringResource(R.plurals.language_levels_rose, rises.size, formatList(rises.map { skillName(it.skill) }, currentLocale()))
        }
    MarkedLine(
        style,
        mark = {
            Icon(
                painterResource(R.drawable.ic_trending_up),
                contentDescription = null,
                modifier = Modifier.size(with(LocalDensity.current) { style.fontSize.toDp() }),
                tint = MaterialTheme.colorScheme.onTertiaryContainer,
            )
        },
    ) {
        Text(text, style = style)
    }
}

private val COLUMN_GAP = 12.dp
private val BAND_ROOM = 8.dp
private val TREND_GAP = 2.dp
private val TARGET_WIDTH = 1.5.dp
private val DASH = 3.dp
private val TICK_REACH = 8.dp
