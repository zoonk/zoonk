package com.zoonk.android.feature.activities.math

import com.zoonk.android.feature.activities.ActivityExpression
import kotlin.math.abs
import kotlin.math.ceil
import kotlin.math.floor
import kotlin.math.max
import kotlin.math.min

/** One side of the scale: [x] bags of the unknown and [units] of known weight. */
internal data class Pan(
    val units: Double,
    val x: Double,
)

internal data class BalanceState(
    val left: Pan,
    val right: Pan,
)

internal enum class PanSide { Left, Right }

internal sealed interface BalanceMove {
    data class Split(
        val groups: Double,
    ) : BalanceMove

    data class TakeUnit(
        val side: PanSide,
    ) : BalanceMove

    data class TakeX(
        val side: PanSide,
    ) : BalanceMove
}

internal fun parseBalance(
    left: String,
    right: String,
    variable: String,
): BalanceState? {
    val leftPan = linearPan(left, variable) ?: return null
    val rightPan = linearPan(right, variable) ?: return null
    return BalanceState(leftPan, rightPan)
}

internal fun solveBalance(state: BalanceState): Double? {
    val slope = state.left.x - state.right.x
    return if (abs(slope) < SLACK) null else (state.right.units - state.left.units) / slope
}

/** Whole bags and blocks few enough to draw, for a positive answer; otherwise the activity is solved by picking moves. */
internal fun canDrawBlocks(
    state: BalanceState,
    solution: Double?,
): Boolean {
    val pans = listOf(state.left, state.right)
    return solution != null &&
        solution > 0 &&
        pans.all { isCountable(it.x, MAX_BAGS) && isCountable(it.units, MAX_BLOCKS) } &&
        pans.any { it.x > 0 }
}

/** How far the scale tips toward the heavier side, in degrees: right is positive. */
internal fun tiltDegrees(
    state: BalanceState,
    solution: Double,
): Double {
    val left = state.left.weight(solution)
    val right = state.right.weight(solution)
    val heavier = max(left, right)
    if (heavier <= 0 || abs(right - left) < SLACK) return 0.0
    return (right - left) / heavier * MAX_TILT_DEGREES
}

internal fun splitGroups(state: BalanceState): Double? {
    val (bags, blocks) = if (state.left.x > 0) state.left to state.right else state.right to state.left
    return bags.x.takeIf { it > 1 && bags.units == 0.0 && blocks.x == 0.0 }
}

internal fun applyMove(
    state: BalanceState,
    move: BalanceMove,
): BalanceState =
    when (move) {
        is BalanceMove.Split -> {
            val divide = { pan: Pan -> Pan(pan.units / move.groups, pan.x / move.groups) }
            BalanceState(divide(state.left), divide(state.right))
        }

        is BalanceMove.TakeUnit -> {
            state.change(move.side) { if (it.units > 0) it.copy(units = it.units - min(it.units, 1.0)) else it }
        }

        is BalanceMove.TakeX -> {
            state.change(move.side) { if (it.x > 0) it.copy(x = it.x - min(it.x, 1.0)) else it }
        }
    }

internal fun isolatedValue(state: BalanceState): Double? {
    val (left, right) = state
    return when {
        left.x == 1.0 && left.units == 0.0 && right.x == 0.0 -> right.units
        right.x == 1.0 && right.units == 0.0 && left.x == 0.0 -> left.units
        else -> null
    }
}

/** How many of the worked steps the learner's moves have reached, in order; all of them once a bag stands alone at the answer. */
internal fun reachedSteps(
    current: BalanceState,
    history: List<BalanceState>,
    solution: Double,
    steps: List<BalanceState?>,
): Int {
    val isolated = isolatedValue(current)
    if (isolated != null && abs(isolated - solution) < SLACK) return steps.size
    val visited = history + current
    return steps.foldIndexed(0) { index, reached, step ->
        if (reached == index && step != null && visited.any { it.matches(step) }) reached + 1 else reached
    }
}

internal fun panText(
    pan: Pan,
    symbol: String,
    format: (Double) -> String,
): String {
    val unknown = if (pan.x == 0.0) "" else "${if (pan.x == 1.0) "" else format(pan.x)}$symbol"
    val units = if (pan.units == 0.0 && unknown.isNotEmpty()) "" else format(pan.units)
    return listOf(unknown, units).filter { it.isNotEmpty() }.joinToString(" + ")
}

internal data class ItemPosition(
    val x: Float,
    val y: Float,
)

/** Where a pan's bags, blocks and weight sit, in main's units, measured up from the plate. */
internal data class PanLayout(
    val bags: List<ItemPosition>,
    val blocks: List<ItemPosition>,
    val height: Float,
    val weight: ItemPosition?,
)

internal fun panLayout(
    pan: Pan,
    width: Float,
): PanLayout {
    val bagCount = if (pan.x == floor(pan.x) && pan.x > 0) pan.x.toInt() else 0
    val stack = STACK_HEIGHTS.find { bagCount * BAG_STEP + unitsWidth(pan, it) <= width }
    val blockStack = stack ?: MIN_STACK
    val bagSpace = floor((width - unitsWidth(pan, blockStack)) / BAG_STEP).toInt()
    val bagColumns = max(min(bagCount, if (stack == null) bagSpace else bagCount), 1)
    val bagRows = ceil(bagCount.toDouble() / bagColumns).toInt()
    val unitsLeft = if (bagCount > 0) min(bagColumns, bagCount) * BAG_STEP + GROUP_GAP else 0f
    val blockCount = if (isWholeBlocks(pan.units)) pan.units.toInt() else 0
    val bags = (0 until bagCount).map { ItemPosition(it % bagColumns * BAG_STEP, (it / bagColumns + 1) * BAG_HEIGHT) }
    val blocks = (0 until blockCount).map { ItemPosition(unitsLeft + it / blockStack * BLOCK_STEP, (it % blockStack + 1) * BLOCK_STEP) }
    val weight = if (!isWholeBlocks(pan.units) && pan.units > 0) ItemPosition(unitsLeft, WEIGHT_HEIGHT) else null
    val height = (listOf(bagRows * BAG_HEIGHT, weight?.y ?: 0f) + blocks.map { it.y }).max()
    return PanLayout(bags, blocks, height, weight)
}

private fun linearPan(
    expression: String,
    variable: String,
): Pan? {
    val at = { value: Double -> ActivityExpression.evaluate(expression, mapOf(variable to value)) }
    val atZero = at(0.0) ?: return null
    val atOne = at(1.0) ?: return null
    val atTwo = at(2.0) ?: return null
    val slope = atOne - atZero
    return if (abs(atTwo - (atZero + 2 * slope)) < SLACK) Pan(atZero, slope) else null
}

private fun isCountable(
    value: Double,
    max: Int,
) = value == floor(value) && value >= 0 && value <= max

private fun isWholeBlocks(units: Double) = isCountable(units, MAX_WHOLE_BLOCKS)

private fun Pan.weight(solution: Double) = x * solution + units

private fun BalanceState.change(
    side: PanSide,
    pan: (Pan) -> Pan,
) = if (side == PanSide.Left) copy(left = pan(left)) else copy(right = pan(right))

private fun Pan.matches(other: Pan) = abs(x - other.x) < SLACK && abs(units - other.units) < SLACK

private fun BalanceState.matches(step: BalanceState) =
    (left.matches(step.left) && right.matches(step.right)) || (left.matches(step.right) && right.matches(step.left))

private fun unitsWidth(
    pan: Pan,
    stack: Int,
): Float =
    when {
        pan.units <= 0 -> 0f
        isWholeBlocks(pan.units) -> ceil(pan.units / stack).toFloat() * BLOCK_STEP + GROUP_GAP
        else -> WEIGHT_WIDTH + GROUP_GAP
    }

internal const val BAG_WIDTH = 34f
internal const val BAG_HEIGHT = 44f
internal const val BLOCK_SIZE = 22f
internal const val WEIGHT_WIDTH = 52f
internal const val WEIGHT_HEIGHT = 30f
private const val BAG_STEP = BAG_WIDTH + 2
private const val BLOCK_STEP = BLOCK_SIZE + 1
private const val MIN_STACK = 3
private val STACK_HEIGHTS = listOf(MIN_STACK, MIN_STACK + 1, MIN_STACK + 2)
private const val GROUP_GAP = 6f
private const val MAX_WHOLE_BLOCKS = 12
private const val MAX_BAGS = 6
private const val MAX_BLOCKS = 12
private const val MAX_TILT_DEGREES = 9.0
private const val SLACK = 1e-9
