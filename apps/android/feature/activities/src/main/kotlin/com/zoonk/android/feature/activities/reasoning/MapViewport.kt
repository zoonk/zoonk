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

internal data class MapLabelSpot(
    val center: MapPoint,
    val width: Double,
    val height: Double,
    val angle: Double,
    val street: Boolean,
    val priority: Boolean,
    val positions: List<MapPoint>? = null,
    val question: Boolean = false,
)

private fun labelAxes(label: MapLabelSpot): List<MapPoint> {
    val angle = label.angle * Math.PI / 180
    return listOf(MapPoint(kotlin.math.cos(angle), kotlin.math.sin(angle)), MapPoint(-kotlin.math.sin(angle), kotlin.math.cos(angle)))
}

private fun labelProjection(
    label: MapLabelSpot,
    axis: MapPoint,
): Double {
    val axes = labelAxes(label)
    val along = (label.width / 2 + 1.5) * kotlin.math.abs(axes[0].x * axis.x + axes[0].y * axis.y)
    val across = (label.height / 2 + 1.5) * kotlin.math.abs(axes[1].x * axis.x + axes[1].y * axis.y)
    return along + across
}

private fun clearOfMapPin(
    label: MapLabelSpot,
    pin: MapPoint,
): Boolean =
    kotlin.math.abs(label.center.x - pin.x) >= labelProjection(label, MapPoint(1.0, 0.0)) + 23 ||
        kotlin.math.abs(label.center.y - pin.y) >= labelProjection(label, MapPoint(0.0, 1.0)) + 23

private fun clearOfMapLabel(
    label: MapLabelSpot,
    other: MapLabelSpot,
): Boolean =
    kotlin.math.abs(
        label.center.x - other.center.x,
    ) >= labelProjection(label, MapPoint(1.0, 0.0)) + labelProjection(other, MapPoint(1.0, 0.0)) + 3 ||
        kotlin.math.abs(
            label.center.y - other.center.y,
        ) >= labelProjection(label, MapPoint(0.0, 1.0)) + labelProjection(other, MapPoint(0.0, 1.0)) + 3

private fun inMapFrame(
    label: MapLabelSpot,
    width: Double,
    height: Double,
): Boolean {
    val rx = labelProjection(label, MapPoint(1.0, 0.0))
    val ry = labelProjection(label, MapPoint(0.0, 1.0))
    return label.center.x >= rx && label.center.x + rx <= width && label.center.y >= ry && label.center.y + ry <= height
}

internal data class MapLabelPlacement(
    val center: MapPoint,
    val scale: Double = 1.0,
) {
    val x get() = center.x
    val y get() = center.y
}

private fun namedMapCandidates(
    label: MapLabelSpot,
    placed: List<MapLabelSpot>,
    pins: List<MapPoint>,
    width: Double,
    height: Double,
): List<MapPoint> {
    val rx = labelProjection(label, MapPoint(1.0, 0.0))
    val ry = labelProjection(label, MapPoint(0.0, 1.0))
    if (rx * 2 > width || ry * 2 > height) return emptyList()
    val seeds = label.positions.orEmpty() + label.center
    val obstacles =
        placed.map { Triple(it.center, labelProjection(it, MapPoint(1.0, 0.0)), labelProjection(it, MapPoint(0.0, 1.0))) } +
            pins.map { Triple(it, 20.0, 20.0) }
    val xs =
        (
            listOf(rx, width - rx) + seeds.map { it.x } +
                obstacles.flatMap { (p, x, _) ->
                    listOf(p.x - rx - x - 3, p.x + rx + x + 3)
                }
        ).map { it.coerceIn(rx, width - rx) }.distinct()
    val ys =
        (
            listOf(ry, height - ry) + seeds.map { it.y } +
                obstacles.flatMap { (p, _, y) ->
                    listOf(p.y - ry - y - 3, p.y + ry + y + 3)
                }
        ).map { it.coerceIn(ry, height - ry) }.distinct()
    return xs.flatMap { x -> ys.map { y -> MapPoint(x, y) } }
}

internal fun isMapLabelNamed(
    references: String,
    source: String,
    text: String,
): Boolean {
    val named = references.lowercase(java.util.Locale.ROOT)
    return listOf(source, text).any { it.isNotEmpty() && named.contains(it.lowercase(java.util.Locale.ROOT)) }
}

internal fun placeMapLabels(
    labels: List<MapLabelSpot>,
    pins: List<MapPoint>,
    width: Double,
    height: Double,
): List<MapLabelPlacement?> {
    val order = labels.indices.sortedWith(compareByDescending<Int> { labels[it].question }.thenByDescending { labels[it].priority })
    val named = order.filter { labels[it].priority || labels[it].question }

    data class Layout(
        val placed: MutableList<MapLabelSpot>,
        val spots: MutableList<MapLabelPlacement?>,
    )

    fun arrange(
        scale: Double,
        pack: Boolean,
    ): Layout {
        val placed = mutableListOf<MapLabelSpot>()
        val spots = MutableList<MapLabelPlacement?>(labels.size) { null }
        for (index in named) {
            val label = labels[index].let { it.copy(width = it.width * scale, height = it.height * scale) }
            val comparator =
                compareBy<MapPoint> { point ->
                    if (pack) point.y else hypot(point.x - label.center.x, point.y - label.center.y)
                }.thenBy { point ->
                    if (pack) point.x else 0.0
                }
            val points = namedMapCandidates(label, placed, pins, width, height).sortedWith(comparator)
            val original =
                (if (label.street) label.positions.orEmpty() else listOf(label.center)).sortedBy {
                    hypot(
                        it.x - label.center.x,
                        it.y - label.center.y,
                    )
                }
            val spot =
                (if (pack) points else original + points).map { label.copy(center = it) }.firstOrNull { candidate ->
                    inMapFrame(candidate, width, height) &&
                        pins.all { clearOfMapPin(candidate, it) } &&
                        placed.all { clearOfMapLabel(candidate, it) }
                }
            if (spot != null) {
                placed.add(spot)
                spots[index] = MapLabelPlacement(spot.center, scale)
            }
        }
        return Layout(placed, spots)
    }
    val layouts = mutableListOf<Layout>()
    for (scale in listOf(1.0, 0.9, 0.8)) {
        layouts.add(arrange(scale, false))
        if (layouts.last().placed.size == named.size) break
        layouts.add(arrange(scale, true))
        if (layouts.last().placed.size == named.size) break
    }
    val chosen =
        layouts.firstOrNull { it.placed.size == named.size }
            ?: layouts
                .sortedWith(
                    compareByDescending<Layout> { layout ->
                        named.count { labels[it].question && layout.spots[it] != null }
                    }.thenByDescending { it.placed.size },
                ).first()
    for (index in order.filter { !labels[it].priority && !labels[it].question }) {
        val label = labels[index]
        val spot =
            (if (label.street) label.positions.orEmpty() else listOf(label.center))
                .sortedBy {
                    hypot(it.x - label.center.x, it.y - label.center.y)
                }.map { label.copy(center = it) }
                .firstOrNull { candidate ->
                    inMapFrame(candidate, width, height) &&
                        pins.all { clearOfMapPin(candidate, it) } &&
                        chosen.placed.all { clearOfMapLabel(candidate, it) }
                }
        if (spot != null) {
            chosen.placed.add(spot)
            chosen.spots[index] = MapLabelPlacement(spot.center)
        }
    }
    return chosen.spots
}
