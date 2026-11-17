package com.zoonk.android.feature.activities.reasoning

import kotlin.math.hypot
import kotlin.math.max
import kotlin.math.min

internal data class MapPoint(
    val x: Double,
    val y: Double,
)

internal data class MapBox(
    val x: Double,
    val y: Double,
    val width: Double,
    val height: Double,
)

/**
 * Main's `fitViewport`: the part of the map that frames every place with room around it, no closer
 * than the map's detail allows, in a shape between wide and about square ([maxAspect] keeps it short
 * enough for the screen), and never past the map's edges.
 */
internal fun fitViewport(
    mapWidth: Double,
    mapHeight: Double,
    maxZoom: Double,
    points: List<MapPoint>,
    maxAspect: Double = MAX_ASPECT,
): MapBox {
    if (points.isEmpty()) return MapBox(0.0, 0.0, mapWidth, mapHeight)

    val left = points.minOf { it.x }
    val right = points.maxOf { it.x }
    val top = points.minOf { it.y }
    val bottom = points.maxOf { it.y }
    val edge = max(mapWidth, mapHeight) * EDGE_PADDING
    val wanted =
        withAspect(
            width = max((right - left) * (1 + SPREAD_PADDING) + edge * 2, mapWidth / maxZoom),
            height = max((bottom - top) * (1 + SPREAD_PADDING) + edge * 2, mapHeight / maxZoom),
            maxAspect = min(maxAspect, MAX_ASPECT),
        )
    val width = min(wanted.first, mapWidth)
    val height = min(wanted.second, mapHeight)

    return MapBox(
        x = ((left + right) / 2 - width / 2).coerceIn(0.0, mapWidth - width),
        y = ((top + bottom) / 2 - height / 2).coerceIn(0.0, mapHeight - height),
        width = width,
        height = height,
    )
}

private fun withAspect(
    width: Double,
    height: Double,
    maxAspect: Double,
): Pair<Double, Double> {
    val aspect = height / width
    val minAspect = min(MIN_ASPECT, maxAspect)
    return when {
        aspect > maxAspect -> height / maxAspect to height
        aspect < minAspect -> width to width * minAspect
        else -> width to height
    }
}

/** Main's `spreadPins`: nudges pins apart until each has [distance] of room, keeping them inside the frame. */
internal fun spreadPins(
    points: List<MapPoint>,
    distance: Double,
    width: Double,
    height: Double,
): List<MapPoint> {
    val inset = distance / 2

    fun relax(current: List<MapPoint>): List<MapPoint> =
        current.mapIndexed { index, point ->
            var pushX = 0.0
            var pushY = 0.0
            current.forEachIndexed { otherIndex, other ->
                val dx = point.x - other.x
                val dy = point.y - other.y
                val gap = hypot(dx, dy)
                if (otherIndex != index && gap < distance) {
                    val (ux, uy) = if (gap == 0.0) (if (otherIndex < index) 1.0 else -1.0) to 0.0 else dx / gap to dy / gap
                    val overlap = (distance - gap) / 2
                    pushX += ux * overlap
                    pushY += uy * overlap
                }
            }
            MapPoint((point.x + pushX).coerceIn(inset, width - inset), (point.y + pushY).coerceIn(inset, height - inset))
        }

    return (1..RELAX_ROUNDS).fold(points) { current, _ -> relax(current) }
}

private const val MIN_ASPECT = 0.62
private const val MAX_ASPECT = 1.05
private const val SPREAD_PADDING = 0.6
private const val EDGE_PADDING = 0.06
private const val RELAX_ROUNDS = 40

internal data class MapTextLabel(
    val center: MapPoint,
    val width: Double,
    val height: Double,
    val angle: Double,
    val street: Boolean,
)

internal fun placeMapLabels(
    width: Double,
    height: Double,
    labels: List<MapTextLabel>,
    pins: List<MapPoint>,
    unit: Double,
): List<MapPoint?> {
    val placed = mutableListOf<Pair<MapPoint, Double>>()
    return labels.map { label ->
        val radius = label.height / 2
        val reach = (label.width / 2 - radius).coerceAtLeast(0.0)
        val count = kotlin.math.ceil(reach * 2 / radius.coerceAtLeast(1.0)).toInt()
        val radians = Math.toRadians(label.angle)

        fun ink(at: MapPoint): List<MapPoint> =
            (0..count).map { index ->
                val along = if (count == 0) 0.0 else -reach + reach * 2 * index / count
                MapPoint(at.x + kotlin.math.cos(radians) * along, at.y + kotlin.math.sin(radians) * along)
            }

        fun clear(at: MapPoint): Boolean =
            ink(at).all { point ->
                point.x - radius >= 0 && point.x + radius <= width && point.y - radius >= 0 && point.y + radius <= height &&
                    pins.all { kotlin.math.hypot(point.x - it.x, point.y - it.y) >= radius + 23 * unit } &&
                    placed.all { (other, otherRadius) ->
                        kotlin.math.hypot(point.x - other.x, point.y - other.y) >=
                            radius + otherRadius + 3 * unit
                    }
            }
        val steps = if (label.street) kotlin.math.floor(label.width / (4 * unit)).toInt() else 0
        val shifts = listOf(0.0) + (1..steps).flatMap { listOf(it * 4 * unit, -it * 4 * unit) }
        val spot =
            shifts
                .map { slide ->
                    MapPoint(
                        label.center.x + kotlin.math.cos(radians) * slide,
                        label.center.y + kotlin.math.sin(radians) * slide,
                    )
                }.firstOrNull(::clear)
        spot?.let { placed.addAll(ink(it).map { point -> point to radius }) }
        spot
    }
}
