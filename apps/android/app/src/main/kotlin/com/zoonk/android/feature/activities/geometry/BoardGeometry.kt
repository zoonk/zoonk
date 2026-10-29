package com.zoonk.android.feature.activities.geometry

import androidx.compose.ui.input.key.Key
import com.zoonk.android.feature.activities.SnapRange
import com.zoonk.android.feature.activities.isMultiple
import com.zoonk.android.feature.activities.jsRound
import com.zoonk.android.feature.activities.snapToStep
import com.zoonk.api.models.PlayableLibraryStepAnyOfContentOneOf6Fields.Measure
import com.zoonk.api.models.PlayableLibraryStepAnyOfContentOneOf6FieldsPointsInner.Track
import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.atan2
import kotlin.math.ceil
import kotlin.math.floor
import kotlin.math.hypot
import kotlin.math.pow
import kotlin.math.roundToLong
import kotlin.math.sign

internal data class Vec(
    val x: Double,
    val y: Double,
) {
    operator fun plus(other: Vec) = Vec(x + other.x, y + other.y)

    operator fun minus(other: Vec) = Vec(x - other.x, y - other.y)
}

internal data class BoardBounds(
    val minX: Double,
    val maxX: Double,
    val minY: Double,
    val maxY: Double,
)

/** What moves on a board: whether a corner moves, and the line it slides along, if any. */
internal data class BoardCorner(
    val movable: Boolean,
    val track: Track?,
)

/** Main's `board-geometry.ts`: shapes on a grid whose corners move a grid step at a time. */
internal object BoardGeometry {
    fun polygonArea(points: List<Vec>): Double = abs(signedArea(points))

    fun sideLengths(points: List<Vec>): List<Double> =
        points.mapIndexed { index, point ->
            val side = around(points, index + 1) - point
            hypot(side.x, side.y)
        }

    fun interiorAngles(points: List<Vec>): List<Double> {
        val winding = sign(signedArea(points)).takeIf { it != 0.0 } ?: 1.0
        return points.mapIndexed { index, point ->
            val incoming = point - around(points, index - 1)
            val outgoing = around(points, index + 1) - point
            val turn = atan2(cross(incoming, outgoing), dot(incoming, outgoing)) * HALF_TURN / PI
            HALF_TURN - winding * turn
        }
    }

    /** Rounds [values] so the rounded parts still add up to their rounded total. */
    fun roundParts(
        values: List<Double>,
        digits: Int,
    ): List<Double> {
        val scale = 10.0.pow(digits)
        val scaled = values.map { it * scale }
        val floors = scaled.map { floor(it) }
        val missing = jsRound(scaled.sum()) - floors.sum()
        val bumped =
            scaled.indices
                .sortedByDescending { scaled[it] - floors[it] }
                .take(maxOf(missing, 0.0).toInt())
                .toSet()
        return floors.mapIndexed { index, floor -> (floor + if (index in bumped) 1 else 0) / scale }
    }

    /** The square drawn outward on each side, from that side's first corner. */
    fun sideSquares(points: List<Vec>): List<List<Vec>> {
        val winding = sign(signedArea(points)).takeIf { it != 0.0 } ?: 1.0
        return points.mapIndexed { index, point ->
            val next = around(points, index + 1)
            val side = next - point
            val outward = Vec(winding * side.y, -winding * side.x)
            listOf(point, next, next + outward, point + outward)
        }
    }

    fun gridStep(points: List<Vec>): Double {
        val span = maxOf(points.maxOf { it.x } - points.minOf { it.x }, points.maxOf { it.y } - points.minOf { it.y })
        return GRID_STEPS.firstOrNull { step ->
            span / step >= MIN_POSITIONS && points.all { isMultiple(it.x, step) && isMultiple(it.y, step) }
        } ?: (span / (MIN_POSITIONS * MIN_POSITIONS))
    }

    fun bounds(
        measure: Measure,
        points: List<Vec>,
        step: Double,
    ): BoardBounds {
        val drawn = if (measure == Measure.PYTHAGORAS) sideSquares(points).flatten() else points
        val (minX, maxX) = drawn.minOf { it.x } to drawn.maxOf { it.x }
        val (minY, maxY) = drawn.minOf { it.y } to drawn.maxOf { it.y }
        val share = if (measure == Measure.PYTHAGORAS) SQUARES_MARGIN_SHARE else MARGIN_SHARE
        val margin = maxOf(step, maxOf(maxX - minX, maxY - minY) * share)
        return BoardBounds(
            minX = floor((minX - margin) / step) * step,
            maxX = ceil((maxX + margin) / step) * step,
            minY = floor((minY - margin) / step) * step,
            maxY = ceil((maxY + margin) / step) * step,
        )
    }

    fun minimumArea(points: List<Vec>): Double = polygonArea(points) * MIN_AREA_SHARE

    /** [points] with corner [index] snapped to the grid near [to] along its track, or null when that isn't a fair shape. */
    fun moveCorner(
        corners: List<BoardCorner>,
        points: List<Vec>,
        index: Int,
        to: Vec,
        bounds: BoardBounds,
        measure: Measure,
        minArea: Double,
        step: Double,
    ): List<Vec>? {
        val corner = corners.getOrNull(index)?.takeIf { it.movable } ?: return null
        val point = points[index]
        val moved =
            Vec(
                x = if (corner.track == Track.VERTICAL) point.x else snapToStep(to.x, SnapRange(bounds.minX, bounds.maxX, step)),
                y = if (corner.track == Track.HORIZONTAL) point.y else snapToStep(to.y, SnapRange(bounds.minY, bounds.maxY, step)),
            )
        val next = points.mapIndexed { pointIndex, it -> if (pointIndex == index) moved else it }
        return next.takeIf { isFairShape(it, bounds, measure, minArea) }
    }

    /** A grid step in an arrow's direction; on a track, any arrow slides along it. */
    fun keyOffset(
        key: Key,
        step: Double,
        track: Track?,
    ): Vec? {
        val offset =
            when (key) {
                Key.DirectionDown -> Vec(0.0, -step)
                Key.DirectionLeft -> Vec(-step, 0.0)
                Key.DirectionRight -> Vec(step, 0.0)
                Key.DirectionUp -> Vec(0.0, step)
                else -> return null
            }
        val amount = offset.x + offset.y
        return when (track) {
            null -> offset
            Track.HORIZONTAL -> Vec(amount, 0.0)
            Track.VERTICAL -> Vec(0.0, amount)
        }
    }

    private fun isFairShape(
        points: List<Vec>,
        bounds: BoardBounds,
        measure: Measure,
        minArea: Double,
    ): Boolean {
        val drawn = if (measure == Measure.PYTHAGORAS) sideSquares(points).flatten() else points
        return drawn.all { it.x in bounds.minX..bounds.maxX && it.y in bounds.minY..bounds.maxY } &&
            polygonArea(points) >= minArea &&
            interiorAngles(points).all { it >= MIN_ANGLE && abs(it - HALF_TURN) >= MIN_ANGLE } &&
            !crossesItself(points)
    }

    private fun crossesItself(points: List<Vec>): Boolean {
        val sides = points.mapIndexed { index, point -> point to around(points, index + 1) }
        return sides.indices.any { index ->
            sides.indices.any { other ->
                other > index + 1 && !(index == 0 && other == sides.lastIndex) && segmentsCross(sides[index], sides[other])
            }
        }
    }

    private fun segmentsCross(
        side: Pair<Vec, Vec>,
        other: Pair<Vec, Vec>,
    ): Boolean {
        val (start, end) = side
        val (otherStart, otherEnd) = other
        val direction = end - start
        val otherDirection = otherEnd - otherStart
        val splitsOther = cross(direction, otherStart - start) * cross(direction, otherEnd - start) < 0
        val splitsThis = cross(otherDirection, start - otherStart) * cross(otherDirection, end - otherStart) < 0
        return splitsOther && splitsThis
    }

    private fun signedArea(points: List<Vec>): Double = points.indices.sumOf { cross(points[it], around(points, it + 1)) } / 2

    private fun <T> around(
        items: List<T>,
        index: Int,
    ): T = items[Math.floorMod(index, items.size)]

    private fun cross(
        first: Vec,
        second: Vec,
    ) = first.x * second.y - first.y * second.x

    private fun dot(
        first: Vec,
        second: Vec,
    ) = first.x * second.x + first.y * second.y

    private val GRID_STEPS = listOf(10.0, 5.0, 2.0, 1.0, 0.5, 0.25, 0.1, 0.05, 0.01)
    private const val HALF_TURN = 180.0
    private const val MIN_POSITIONS = 4
    private const val MARGIN_SHARE = 0.25
    private const val SQUARES_MARGIN_SHARE = 0.1
    private const val MIN_AREA_SHARE = 0.05
    private const val MIN_ANGLE = 3.0
}
