package com.zoonk.android.feature.activities.geometry

import com.zoonk.android.ui.components.cleanFloat
import com.zoonk.api.models.PlayableLibraryStepAnyOfContentOneOf6Fields.Measure
import kotlin.math.PI
import kotlin.math.atan2
import kotlin.math.cos
import kotlin.math.hypot
import kotlin.math.max
import kotlin.math.min
import kotlin.math.sign
import kotlin.math.sin

/**
 * Main's `board-measure.ts`: what a board shows, rounded so the parts on screen add up to the total
 * on screen. [partIndexes] are the corners or sides the parts belong to; [totalIndex] is the side
 * whose square is the total.
 */
internal data class BoardReading(
    val parts: List<Double>,
    val partIndexes: List<Int>,
    val total: Double,
    val totalIndex: Int?,
)

internal fun readBoard(
    points: List<Vec>,
    measure: Measure,
): BoardReading {
    val indexes = points.indices.toList()
    return when (measure) {
        Measure.ANGLE_SUM -> {
            val parts = BoardGeometry.roundParts(BoardGeometry.interiorAngles(points), digits = 0)
            BoardReading(parts, indexes, cleanFloat(parts.sum()), totalIndex = null)
        }

        Measure.PERIMETER -> {
            val parts = BoardGeometry.roundParts(BoardGeometry.sideLengths(points), digits = 1)
            BoardReading(parts, indexes, cleanFloat(parts.sum()), totalIndex = null)
        }

        Measure.AREA -> {
            BoardReading(
                emptyList(),
                emptyList(),
                BoardGeometry.roundParts(listOf(BoardGeometry.polygonArea(points)), digits = 2).first(),
                null,
            )
        }

        Measure.PYTHAGORAS -> {
            val lengths = BoardGeometry.sideLengths(points)
            val hypotenuse = lengths.indexOf(lengths.max())
            val squares = lengths.map { it * it }
            val legs = indexes.filter { it != hypotenuse }
            val parts = BoardGeometry.roundParts(legs.map { squares[it] }, digits = 2)
            BoardReading(parts, legs, BoardGeometry.roundParts(listOf(squares[hypotenuse]), digits = 2).first(), hypotenuse)
        }
    }
}

/** Main's `board-scale.ts`: the board's grid fitted to [width] and at most [maxHeight], one data unit to [unit] pixels, y up. */
internal class BoardScale(
    private val bounds: BoardBounds,
    width: Float,
    maxHeight: Float,
    private val padding: Double,
) {
    private val spanX = max(bounds.maxX - bounds.minX, Math.ulp(1.0))
    private val spanY = max(bounds.maxY - bounds.minY, Math.ulp(1.0))
    val unit = max(min((width - 2 * padding) / spanX, (maxHeight - 2 * padding) / spanY), 1.0)
    val height = (spanY * unit + 2 * padding).toFloat()
    private val left = (width - spanX * unit) / 2

    fun toData(pixel: Vec) = Vec(bounds.minX + (pixel.x - left) / unit, bounds.maxY - (pixel.y - padding) / unit)

    fun toPixel(point: Vec) = Vec(left + (point.x - bounds.minX) * unit, padding + (bounds.maxY - point.y) * unit)
}

/** A wedge from [from] turning [sweep], in radians clockwise on screen. */
internal data class Wedge(
    val from: Double,
    val sweep: Double,
)

/** Main's `cornerWedge`: the arc inside a corner's [angle], and where its label goes. */
internal fun cornerWedge(
    angle: Double,
    corner: Vec,
    next: Vec,
    previous: Vec,
    radius: Double,
    labelGap: Double,
): Pair<Wedge, Vec> {
    val toNext = unit(corner, next)
    val toPrevious = unit(corner, previous)
    val from = atan2(toNext.y, toNext.x)
    val shortTurn = atan2(toNext.x * toPrevious.y - toNext.y * toPrevious.x, toNext.x * toPrevious.x + toNext.y * toPrevious.y)
    val direction = sign(shortTurn).takeIf { it != 0.0 } ?: 1.0
    val sweep = (if (angle > HALF_TURN) -direction else direction) * angle * PI / HALF_TURN
    return Wedge(from, sweep) to along(corner, from + sweep / 2, radius + labelGap)
}

internal fun fanWedges(angles: List<Double>): List<Wedge> =
    angles.mapIndexed { index, angle -> Wedge(PI + angles.take(index).sum() * PI / HALF_TURN, angle * PI / HALF_TURN) }

internal fun centroid(points: List<Vec>) = Vec(points.sumOf { it.x } / points.size, points.sumOf { it.y } / points.size)

internal fun awayFromMiddle(
    point: Vec,
    middle: Vec,
    distance: Double,
): Vec {
    val length = hypot(point.x - middle.x, point.y - middle.y).takeIf { it != 0.0 } ?: 1.0
    return Vec(point.x + (point.x - middle.x) / length * distance, point.y + (point.y - middle.y) / length * distance)
}

private fun unit(
    from: Vec,
    to: Vec,
): Vec {
    val length = hypot(to.x - from.x, to.y - from.y).takeIf { it != 0.0 } ?: 1.0
    return Vec((to.x - from.x) / length, (to.y - from.y) / length)
}

private fun along(
    origin: Vec,
    direction: Double,
    distance: Double,
) = Vec(origin.x + cos(direction) * distance, origin.y + sin(direction) * distance)

private const val HALF_TURN = 180.0
