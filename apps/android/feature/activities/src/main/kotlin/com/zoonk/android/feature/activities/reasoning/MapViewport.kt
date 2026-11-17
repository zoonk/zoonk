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
    maxAspect: Double = MAP_MAX_ASPECT,
    minAspect: Double? = null,
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
            maxAspect = min(maxAspect, MAP_MAX_ASPECT),
            wantedMinAspect = minAspect ?: MIN_ASPECT,
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
    wantedMinAspect: Double = MIN_ASPECT,
): Pair<Double, Double> {
    val aspect = height / width
    val minAspect = min(wantedMinAspect, maxAspect)
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
internal const val MAP_MAX_ASPECT = 1.05
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
    val overPinCircle: Boolean = false,
) {
    val x get() = center.x
    val y get() = center.y
}

private const val MIN_MAP_LABEL_SCALE = 0.8
private const val MAX_STREET_OFFSET = 40.0
internal const val MAP_STREET_SAMPLE_STEP = 4.0

private fun mapPathDistance(
    point: MapPoint,
    path: List<MapPoint>,
): Double =
    path.indices.minOfOrNull { index ->
        val from = path[index]
        val to = path.getOrElse(index + 1) { from }
        val dx = to.x - from.x
        val dy = to.y - from.y
        val t =
            if (dx == 0.0 &&
                dy == 0.0
            ) {
                0.0
            } else {
                (((point.x - from.x) * dx + (point.y - from.y) * dy) / (dx * dx + dy * dy)).coerceIn(0.0, 1.0)
            }
        hypot(point.x - from.x - t * dx, point.y - from.y - t * dy)
    } ?: Double.POSITIVE_INFINITY

private fun besideOwnMapStreet(
    label: MapLabelSpot,
    streets: List<List<MapPoint>>,
): Boolean {
    if (!label.street) return true
    val path = label.positions.orEmpty()
    val distance = mapPathDistance(label.center, path)
    return distance <= MAX_STREET_OFFSET && streets.all { it == path || distance + label.height / 2 <= mapPathDistance(label.center, it) }
}

private fun mapStreetCandidates(
    label: MapLabelSpot,
    inlineFrame: MapBox? = null,
    boxes: List<MapBox> = emptyList(),
): List<MapPoint> {
    val normal = labelAxes(label)[1]
    val offset = min(MAX_STREET_OFFSET, labelProjection(label, normal) + 23)
    val path = label.positions.orEmpty()
    val offsets =
        listOf(0.0, -offset, offset) +
            (1..(MAX_STREET_OFFSET / MAP_STREET_SAMPLE_STEP).toInt()).flatMap {
                listOf(
                    -it * MAP_STREET_SAMPLE_STEP,
                    it * MAP_STREET_SAMPLE_STEP,
                )
            }
    return path.flatMapIndexed { index, from ->
        val to = path.getOrElse(index + 1) { from }
        val steps =
            kotlin.math
                .ceil(hypot(to.x - from.x, to.y - from.y) / MAP_STREET_SAMPLE_STEP)
                .toInt()
                .coerceAtLeast(1)
        val rx = labelProjection(label, MapPoint(1.0, 0.0))
        val ry = labelProjection(label, MapPoint(0.0, 1.0))
        val xs =
            if (inlineFrame ==
                null
            ) {
                emptyList()
            } else {
                listOf(rx, inlineFrame.width - rx) + boxes.flatMap { listOf(it.x - rx, it.x + it.width + rx) }
            }
        val ys =
            if (inlineFrame ==
                null
            ) {
                emptyList()
            } else {
                listOf(ry, inlineFrame.height - ry) + boxes.flatMap { listOf(it.y - ry, it.y + it.height + ry) }
            }
        val fractions =
            (
                (0 until steps).map { it.toDouble() / steps } + xs.map { (it - from.x) / (to.x - from.x) } +
                    ys.map { (it - from.y) / (to.y - from.y) }
            ).filter { it >= 0 && it <= 1 }
        val cuts = fractions.sorted()
        val candidates = if (inlineFrame == null) fractions else cuts + cuts.zipWithNext { left, right -> (left + right) / 2 }
        candidates.flatMap { t ->
            val point = MapPoint(from.x + (to.x - from.x) * t, from.y + (to.y - from.y) * t)
            (if (inlineFrame != null) listOf(0.0) else offsets).map { across ->
                MapPoint(point.x + normal.x * across, point.y + normal.y * across)
            }
        }
    }
}

private fun namedMapCandidates(
    label: MapLabelSpot,
    placed: List<MapLabelSpot>,
    pins: List<MapPoint>,
    width: Double,
    height: Double,
): List<MapPoint> {
    if (label.street) return mapStreetCandidates(label)
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
    streets: List<List<MapPoint>> = labels.filter { it.street }.mapNotNull { it.positions },
    pinNumbers: List<MapBox>? = null,
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
                        besideOwnMapStreet(candidate, streets) &&
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
    for (scale in listOf(1.0, (1.0 + MIN_MAP_LABEL_SCALE) / 2, MIN_MAP_LABEL_SCALE)) {
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
    // The last resort stays on the street's line and may cover a circle, never its number.
    if (pinNumbers?.size == pins.size) {
        for (index in named) {
            val original = labels[index]
            if (chosen.spots[index] != null || !original.street) continue
            val label = original.copy(width = original.width * MIN_MAP_LABEL_SCALE, height = original.height * MIN_MAP_LABEL_SCALE)
            val spot =
                mapStreetCandidates(
                    label,
                    inlineFrame = MapBox(0.0, 0.0, width, height),
                    boxes =
                        pinNumbers +
                            chosen.placed.map { other ->
                                val rx = labelProjection(other, MapPoint(1.0, 0.0)) + 3
                                val ry = labelProjection(other, MapPoint(0.0, 1.0)) + 3
                                MapBox(other.center.x - rx, other.center.y - ry, rx * 2, ry * 2)
                            },
                ).sortedBy { hypot(it.x - label.center.x, it.y - label.center.y) }
                    .map { label.copy(center = it) }
                    .firstOrNull { candidate ->
                        inMapFrame(candidate, width, height) &&
                            chosen.placed.all { clearOfMapLabel(candidate, it) } &&
                            pinNumbers.all { box ->
                                kotlin.math.abs(candidate.center.x - box.x - box.width / 2) >=
                                    labelProjection(candidate, MapPoint(1.0, 0.0)) + box.width / 2 + 3 ||
                                    kotlin.math.abs(candidate.center.y - box.y - box.height / 2) >=
                                    labelProjection(candidate, MapPoint(0.0, 1.0)) + box.height / 2 + 3
                            }
                    }
            if (spot != null) {
                chosen.placed.add(spot)
                chosen.spots[index] = MapLabelPlacement(spot.center, MIN_MAP_LABEL_SCALE, overPinCircle = true)
            }
        }
    }
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
                        besideOwnMapStreet(candidate, streets) &&
                        chosen.placed.all { clearOfMapLabel(candidate, it) }
                }
        if (spot != null) {
            chosen.placed.add(spot)
            chosen.spots[index] = MapLabelPlacement(spot.center)
        }
    }
    return chosen.spots
}
