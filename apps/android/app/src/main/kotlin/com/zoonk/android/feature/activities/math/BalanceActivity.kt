package com.zoonk.android.feature.activities.math

import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.layout.wrapContentWidth
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.listSaver
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.graphics.drawscope.scale
import androidx.compose.ui.graphics.drawscope.translate
import androidx.compose.ui.graphics.vector.PathParser
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.TextMeasurer
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.drawText
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.feature.activities.ActivityBadge
import com.zoonk.android.feature.activities.ActivityCanvas
import com.zoonk.android.feature.activities.ActivityProps
import com.zoonk.android.feature.activities.ActivityRenderer
import com.zoonk.android.feature.activities.ActivitySelectGrid
import com.zoonk.android.feature.activities.ActivityTile
import com.zoonk.android.feature.activities.LineMarker
import com.zoonk.android.feature.activities.numericAnswer
import com.zoonk.android.ui.components.OutlinedButton
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatAmount
import com.zoonk.android.ui.theme.withTabularFigures
import com.zoonk.android.ui.theme.zoonk
import com.zoonk.api.models.PlayableLibraryStepAnyOfContentOneOf3Fields
import kotlin.math.PI
import kotlin.math.sin
import com.zoonk.api.models.PlayableLibraryStepAnyOfContent.PlayableLibraryStepAnyOfContentOneOf3Value as BalanceContent

private typealias BalanceFields = PlayableLibraryStepAnyOfContentOneOf3Fields

val balanceRenderer =
    ActivityRenderer(
        badge = { ActivityBadge(R.string.activities_math_badge_hands_on, R.drawable.ic_back_hand) },
        canvas = { BalanceActivity(it) },
    )

private class BalanceObject(
    val label: String,
    val symbol: String,
)

/** Main's balance: bags and blocks on a scale when they're few and whole, otherwise the equation solved by picking moves. */
@Composable
private fun BalanceActivity(props: ActivityProps) {
    val fields = (props.content as BalanceContent).value.fields
    val locale = currentLocale()
    val format = { value: Double -> formatAmount(value, locale) }
    val start = parseBalance(fields.equation.left, fields.equation.right, fields.variable)
    val solution = start?.let(::solveBalance)

    ActivityCanvas {
        if (start != null && solution != null && canDrawBlocks(start, solution)) {
            BlockBalance(fields, props, start, solution, format)
        } else {
            SymbolicBalance(fields, props, start, format)
        }
    }
}

@Composable
private fun BlockBalance(
    fields: BalanceFields,
    props: ActivityProps,
    start: BalanceState,
    solution: Double,
    format: (Double) -> String,
) {
    val unknown =
        fields.objects.find { it.symbol == fields.variable }?.let { BalanceObject(it.label, it.symbol) }
            ?: BalanceObject(fields.variable, fields.variable)
    val unit = fields.objects.find { it.symbol != fields.variable }?.let { BalanceObject(it.label, it.symbol) } ?: BalanceObject("1", "1")
    var current by rememberSaveable(stateSaver = BalanceSaver) { mutableStateOf(start) }
    var history by rememberSaveable(stateSaver = HistorySaver) { mutableStateOf(emptyList<BalanceState>()) }
    var wrongMoves by rememberSaveable { mutableIntStateOf(0) }
    val tilt = tiltDegrees(current, solution)
    val text = { state: BalanceState -> panText(state.left, unknown.symbol, format) to panText(state.right, unknown.symbol, format) }
    val (left, right) = text(current)
    val steps = fields.steps.map { parseBalance(it.left, it.right, fields.variable) }
    val reached = reachedSteps(current, history, solution, steps)
    val hint = fields.hints.takeIf { it.isNotEmpty() }?.let { hints -> hints[(wrongMoves - 1 + hints.size).mod(hints.size)].hint }
    val update = { next: BalanceState, previous: List<BalanceState> ->
        current = next
        history = previous
        props.onAnswerChange(isolatedValue(next)?.let(::numericAnswer))
    }
    val move = { balanceMove: BalanceMove ->
        val next = applyMove(current, balanceMove)
        if (tiltDegrees(next, solution) != 0.0 && tilt == 0.0) wrongMoves += 1
        update(next, history + current)
    }
    val description =
        listOfNotNull(
            stringResource(R.string.activities_math_balance_description, left, right),
            stringResource(
                when {
                    tilt == 0.0 -> R.string.activities_math_balance_level
                    tilt > 0 -> R.string.activities_math_balance_right_heavier
                    else -> R.string.activities_math_balance_left_heavier
                },
            ),
        ).joinToString(" ")

    BalanceScale(
        start,
        current,
        tilt,
        unknown.symbol,
        format,
        Modifier.semantics {
            contentDescription = description
            liveRegion = LiveRegionMode.Polite
        },
    )
    Equation(left, right, level = tilt == 0.0)
    if (tilt != 0.0 && hint != null) Hint(hint)
    if (!props.isChecked) {
        BalanceControls(
            state = current,
            unknown = unknown,
            unit = unit,
            enabled = !props.isLocked,
            canUndo = history.isNotEmpty(),
            splitGroups = if (tilt == 0.0) splitGroups(current) else null,
            format = format,
            onMove = move,
            onUndo = { update(history.lastOrNull() ?: start, history.dropLast(1)) },
        )
    }
    BalanceSteps(
        steps =
            fields.steps.mapIndexed { index, step ->
                val (stepLeft, stepRight) = steps[index]?.let(text) ?: (step.left to step.right)
                step.move to "$stepLeft = $stepRight"
            },
        reached = reached,
        showAll = props.isChecked,
    )
}

@Composable
private fun SymbolicBalance(
    fields: BalanceFields,
    props: ActivityProps,
    start: BalanceState?,
    format: (Double) -> String,
) {
    val text = { state: BalanceState ->
        "${panText(state.left, fields.variable, format)} = ${panText(state.right, fields.variable, format)}"
    }
    val steps =
        fields.steps.map { step ->
            parseBalance(step.left, step.right, fields.variable).let {
                step.move to
                    (it?.let(text) ?: "${step.left} = ${step.right}")
            }
        }
    val answer =
        fields.steps
            .lastOrNull()
            ?.let { parseBalance(it.left, it.right, fields.variable) }
            ?.let(::isolatedValue)
    var reached by rememberSaveable { mutableIntStateOf(0) }
    var hint by rememberSaveable { mutableStateOf<String?>(null) }
    val next = fields.steps.getOrNull(reached)

    Text(
        steps.getOrNull(reached - 1)?.second ?: start?.let(text) ?: "${fields.equation.left} = ${fields.equation.right}",
        Modifier.fillMaxWidth().semantics { liveRegion = LiveRegionMode.Polite },
        style =
            MaterialTheme.typography.headlineSmall
                .withTabularFigures()
                .copy(fontWeight = FontWeight.Medium),
        textAlign = TextAlign.Center,
    )
    if (next != null && !props.isChecked) {
        val moves = (listOf(next.move) + fields.hints.map { it.move }.filter { it != next.move })
        val shift = reached % moves.size
        ActivitySelectGrid(
            moves.drop(shift) + moves.take(shift),
            label = stringResource(R.string.activities_math_balance_pick_move),
            columns = 1,
        ) { move ->
            ActivityTile(
                picked = false,
                result = null,
                enabled = !props.isLocked,
                role = Role.Button,
                onClick = {
                    if (move != next.move) {
                        hint = fields.hints.find { it.move == move }?.hint
                    } else {
                        hint = null
                        reached += 1
                        if (reached == fields.steps.size) props.onAnswerChange(answer?.let(::numericAnswer))
                    }
                },
            ) { Text(move) }
        }
    }
    hint?.let { Hint(it) }
    if (props.isChecked) BalanceSteps(steps, reached = steps.size, showAll = true)
}

@Composable
private fun Equation(
    left: String,
    right: String,
    level: Boolean,
) {
    val wrong = MaterialTheme.colorScheme.error
    Text(
        buildAnnotatedString {
            append("$left ")
            withStyle(SpanStyle(color = if (level) Color.Unspecified else wrong)) { append(if (level) "=" else "≠") }
            append(" $right")
        },
        Modifier.fillMaxWidth().clearAndSetSemantics {},
        style =
            MaterialTheme.typography.headlineSmall
                .withTabularFigures()
                .copy(fontWeight = FontWeight.Medium),
        textAlign = TextAlign.Center,
    )
}

@Composable
private fun Hint(hint: String) {
    Text(
        buildAnnotatedString {
            withStyle(SpanStyle(color = MaterialTheme.colorScheme.error, fontWeight = FontWeight.SemiBold)) {
                append(stringResource(R.string.activities_math_balance_not_quite))
            }
            append(" $hint")
        },
        Modifier.semantics { liveRegion = LiveRegionMode.Polite },
        style = MaterialTheme.typography.bodyMedium,
    )
}

@Composable
private fun BalanceControls(
    state: BalanceState,
    unknown: BalanceObject,
    unit: BalanceObject,
    enabled: Boolean,
    canUndo: Boolean,
    splitGroups: Double?,
    format: (Double) -> String,
    onMove: (BalanceMove) -> Unit,
    onUndo: () -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            PanSide.entries.forEach { side ->
                val pan = if (side == PanSide.Left) state.left else state.right
                val name =
                    stringResource(
                        if (side ==
                            PanSide.Left
                        ) {
                            R.string.activities_math_balance_left_side
                        } else {
                            R.string.activities_math_balance_right_side
                        },
                    )
                Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text(name, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.labelMedium)
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        listOf(
                            Triple(unknown, pan.x >= 1, BalanceMove.TakeX(side)),
                            Triple(unit, pan.units >= 1, BalanceMove.TakeUnit(side)),
                        ).forEach { (thing, can, balanceMove) ->
                            val take =
                                stringResource(
                                    if (side ==
                                        PanSide.Left
                                    ) {
                                        R.string.activities_math_balance_take_left
                                    } else {
                                        R.string.activities_math_balance_take_right
                                    },
                                    thing.label,
                                )
                            OutlinedButton(
                                onClick = { onMove(balanceMove) },
                                modifier = Modifier.weight(1f).semantics { contentDescription = "−${thing.symbol}, $take" },
                                enabled = enabled && can,
                            ) { Text("−${thing.symbol}", style = MaterialTheme.typography.labelLarge.withTabularFigures()) }
                        }
                    }
                }
            }
        }
        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            splitGroups?.let { groups ->
                FilledTonalButton(onClick = { onMove(BalanceMove.Split(groups)) }, enabled = enabled) {
                    Text(stringResource(R.string.activities_math_balance_split, format(groups)))
                }
            }
            OutlinedButton(onClick = onUndo, enabled = enabled && canUndo) {
                Icon(painterResource(R.drawable.ic_undo), contentDescription = null, modifier = Modifier.size(ButtonDefaults.IconSize))
                Text(stringResource(R.string.activities_math_balance_undo), Modifier.padding(start = ButtonDefaults.IconSpacing))
            }
        }
    }
}

@Composable
private fun BalanceSteps(
    steps: List<Pair<String, String>>,
    reached: Int,
    showAll: Boolean,
) {
    val label = stringResource(R.string.activities_math_balance_steps)
    val visible = if (showAll) steps else steps.take(reached + 1)
    Column(Modifier.semantics { contentDescription = label }, verticalArrangement = Arrangement.spacedBy(8.dp)) {
        visible.forEachIndexed { index, (move, equation) ->
            val done = showAll || index < reached
            val style = MaterialTheme.typography.bodyMedium.withTabularFigures()
            val spoken = stringResource(if (done) R.string.activities_math_balance_done else R.string.activities_math_balance_next)
            val shown = if (done) stringResource(R.string.activities_math_balance_step, move, equation) else move
            Row(
                Modifier.semantics(mergeDescendants = true) {
                    contentDescription = "$spoken $shown"
                },
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                LineMarker(style) {
                    if (done) {
                        Icon(
                            painterResource(R.drawable.ic_check_circle),
                            contentDescription = null,
                            modifier = Modifier.size(MARKER),
                            tint = MaterialTheme.colorScheme.tertiary,
                        )
                    } else {
                        DashedCircle(MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
                Text(shown, color = if (done) Color.Unspecified else MaterialTheme.colorScheme.onSurfaceVariant, style = style)
            }
        }
    }
}

/** Main's scale drawing, in its 350-wide units scaled to the space, with the arm tilting toward the heavier pan. */
@Composable
private fun BalanceScale(
    frame: BalanceState,
    state: BalanceState,
    tilt: Double,
    symbol: String,
    format: (Double) -> String,
    modifier: Modifier = Modifier,
) {
    val measurer = rememberTextMeasurer()
    val angle by animateFloatAsState(tilt.toFloat(), tween(TILT_MS, easing = FastOutSlowInEasing), label = "tilt")
    val top = viewTop(frame)
    val colors =
        ScaleColors(
            ink = MaterialTheme.colorScheme.onSurface,
            muted = MaterialTheme.colorScheme.onSurfaceVariant,
            ring = MaterialTheme.colorScheme.surface,
            bag = MaterialTheme.zoonk.vizAccent,
            block = MaterialTheme.zoonk.vizHighlight,
            heavier = MaterialTheme.colorScheme.error,
        )
    val itemStyle =
        MaterialTheme.typography.labelLarge
            .withTabularFigures()
            .copy(fontWeight = FontWeight.SemiBold)
    val heavier = stringResource(R.string.activities_math_balance_heavier)

    Canvas(
        modifier
            .fillMaxWidth()
            .wrapContentWidth()
            .widthIn(max = MAX_WIDTH)
            .aspectRatio(VIEW_WIDTH / (VIEW_BOTTOM - top)),
    ) {
        val view = ScaleView(size.width / VIEW_WIDTH, top)
        drawStand(view, colors)
        rotate(angle, view.at(PIVOT_X, PIVOT_Y)) {
            drawLine(colors.muted, view.at(PIVOT_X - ARM, PIVOT_Y), view.at(PIVOT_X + ARM, PIVOT_Y), view.of(PLATE_HEIGHT), StrokeCap.Round)
        }
        val lift = sin(angle * PI / HALF_TURN).toFloat() * ARM
        drawPan(view, PIVOT_X - ARM, -lift, state.left, symbol, format, measurer, itemStyle, colors, heavier.takeIf { tilt < 0 })
        drawPan(view, PIVOT_X + ARM, lift, state.right, symbol, format, measurer, itemStyle, colors, heavier.takeIf { tilt > 0 })
        drawCircle(colors.ink, view.of(PLATE_HEIGHT), view.at(PIVOT_X, PIVOT_Y))
    }
}

/** Main's drawing is in a 350-wide view box; [unit] is one of its units in pixels. */
private class ScaleView(
    val unit: Float,
    private val top: Float,
) {
    fun at(
        x: Float,
        y: Float,
    ) = Offset(x * unit, (y - top) * unit)

    fun of(length: Float) = length * unit

    fun size(
        width: Float,
        height: Float,
    ) = Size(width * unit, height * unit)
}

private class ScaleColors(
    val ink: Color,
    val muted: Color,
    val ring: Color,
    val bag: Color,
    val block: Color,
    val heavier: Color,
)

private fun DrawScope.drawStand(
    view: ScaleView,
    colors: ScaleColors,
) {
    val stand =
        Path().apply {
            view.at(PIVOT_X, PIVOT_Y).let { moveTo(it.x, it.y) }
            view.at(PIVOT_X - STAND_HALF_WIDTH, PIVOT_Y + STAND_HEIGHT).let { lineTo(it.x, it.y) }
            view.at(PIVOT_X + STAND_HALF_WIDTH, PIVOT_Y + STAND_HEIGHT).let { lineTo(it.x, it.y) }
            close()
        }
    drawPath(stand, colors.muted.copy(alpha = STAND_ALPHA))
    drawRoundRect(
        colors.muted,
        view.at(PIVOT_X - BASE_HALF_WIDTH, PIVOT_Y + STAND_HEIGHT),
        view.size(BASE_HALF_WIDTH * 2, PLATE_HEIGHT),
        CornerRadius(view.of(PLATE_HEIGHT / 2)),
    )
}

private fun DrawScope.drawPan(
    view: ScaleView,
    center: Float,
    dy: Float,
    pan: Pan,
    symbol: String,
    format: (Double) -> String,
    measurer: TextMeasurer,
    style: TextStyle,
    colors: ScaleColors,
    heavier: String?,
) {
    val plateY = PIVOT_Y - PLATE_LIFT + dy
    val itemsLeft = center - PLATE_WIDTH / 2 + PAN_PADDING
    val itemsBottom = plateY - PLATE_HEIGHT
    val centeredText = { text: String, x: Float, y: Float ->
        val label = measurer.measure(text, style.copy(color = colors.ring))
        drawText(label, topLeft = view.at(x, y) - Offset(label.size.width / 2f, label.size.height / 2f))
    }
    drawLine(colors.muted, view.at(center, PIVOT_Y + dy), view.at(center, plateY), view.of(PAN_STRING))
    drawRoundRect(
        colors.ink.copy(alpha = PLATE_ALPHA),
        view.at(center - PLATE_WIDTH / 2, itemsBottom),
        view.size(PLATE_WIDTH, PLATE_HEIGHT),
        CornerRadius(
            view.of(PLATE_HEIGHT / 2),
        ),
    )
    val layout = panLayout(pan, ITEMS_WIDTH)
    layout.bags.forEach { bag ->
        val corner = view.at(itemsLeft + bag.x, itemsBottom - bag.y)
        translate(corner.x, corner.y) { scale(view.unit, Offset.Zero) { drawPath(BAG, colors.bag) } }
        centeredText(symbol, itemsLeft + bag.x + BAG_SYMBOL_X, itemsBottom - bag.y + BAG_SYMBOL_Y)
    }
    layout.blocks.forEach { block ->
        val corner = view.at(itemsLeft + block.x, itemsBottom - block.y)
        drawRoundRect(colors.block, corner, view.size(BLOCK_SIZE, BLOCK_SIZE), CornerRadius(view.of(BLOCK_RADIUS)))
        drawRoundRect(
            colors.ring,
            corner,
            view.size(BLOCK_SIZE, BLOCK_SIZE),
            CornerRadius(view.of(BLOCK_RADIUS)),
            style = Stroke(view.of(BLOCK_STROKE)),
        )
    }
    layout.weight?.let { weight ->
        drawRoundRect(
            colors.block,
            view.at(itemsLeft + weight.x, itemsBottom - weight.y),
            view.size(WEIGHT_WIDTH, WEIGHT_HEIGHT),
            CornerRadius(view.of(WEIGHT_RADIUS)),
        )
        centeredText(format(pan.units), itemsLeft + weight.x + WEIGHT_WIDTH / 2, itemsBottom - weight.y + WEIGHT_HEIGHT / 2)
    }
    heavier?.let {
        val label = measurer.measure(it, style.copy(color = colors.heavier))
        drawText(
            label,
            topLeft =
                view.at(center, PIVOT_Y + dy + HEAVIER_OFFSET) - Offset(label.size.width / 2f, label.size.height.toFloat()),
        )
    }
}

/** Main's `CircleDashed`: a step not reached yet, which a plain circle would make look like a choice. */
@Composable
private fun DashedCircle(color: Color) {
    Canvas(Modifier.size(MARKER)) {
        val stroke = MARKER_STROKE.toPx()
        val dash = MARKER_DASH.toPx()
        drawCircle(
            color,
            radius = size.minDimension / 2 - stroke,
            style = Stroke(stroke, pathEffect = PathEffect.dashPathEffect(floatArrayOf(dash, dash))),
        )
    }
}

private fun viewTop(frame: BalanceState): Float {
    val tallest = maxOf(panLayout(frame.left, ITEMS_WIDTH).height, panLayout(frame.right, ITEMS_WIDTH).height, BAG_HEIGHT)
    return PIVOT_Y - PLATE_LIFT - PLATE_HEIGHT - tallest - MAX_TILT_LIFT - TOP_MARGIN
}

private val BalanceSaver =
    listSaver<BalanceState, Double>(
        save = { listOf(it.left.units, it.left.x, it.right.units, it.right.x) },
        restore = { BalanceState(Pan(it[0], it[1]), Pan(it[2], it[3])) },
    )

private val HistorySaver =
    listSaver<List<BalanceState>, Double>(
        save = { states -> states.flatMap { listOf(it.left.units, it.left.x, it.right.units, it.right.x) } },
        restore = { values -> values.chunked(PAN_VALUES).map { BalanceState(Pan(it[0], it[1]), Pan(it[2], it[3])) } },
    )

private val BAG =
    PathParser()
        .parsePathString("M13 2 H21 L19.5 8 C26 10 33 16 33 26 C33 37 26 43 17 43 C8 43 1 37 1 26 C1 16 8 10 14.5 8 Z")
        .toPath()

private const val PAN_VALUES = 4
private const val TILT_MS = 500
private const val HALF_TURN = 180
private const val VIEW_WIDTH = 350f
private const val VIEW_BOTTOM = 250f
private const val PIVOT_X = 175f
private const val PIVOT_Y = 205f
private const val ARM = 95f
private const val PLATE_WIDTH = 156f
private const val PLATE_HEIGHT = 7f
private const val PLATE_LIFT = 22f
private const val PAN_PADDING = 6f
private const val ITEMS_WIDTH = PLATE_WIDTH - PAN_PADDING * 2
private const val HEAVIER_OFFSET = 34f
private const val STAND_HALF_WIDTH = 18f
private const val STAND_HEIGHT = 38f
private const val BASE_HALF_WIDTH = 37f
private const val MAX_TILT_LIFT = 16f
private const val TOP_MARGIN = 8f
private const val BAG_SYMBOL_X = 17f
private const val BAG_SYMBOL_Y = 28f
private const val PAN_STRING = 3.5f
private const val BLOCK_RADIUS = 4f
private const val BLOCK_STROKE = 1.5f
private const val WEIGHT_RADIUS = 6f
private const val STAND_ALPHA = 0.6f
private const val PLATE_ALPHA = 0.7f
private val MAX_WIDTH = 384.dp
private val MARKER = 16.dp
private val MARKER_STROKE = 1.5.dp
private val MARKER_DASH = 2.5.dp
