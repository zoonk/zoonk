package com.zoonk.android.feature.activities.reasoning

import androidx.annotation.StringRes
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.sizeIn
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.compositeOver
import androidx.compose.ui.graphics.drawscope.Fill
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.graphics.drawscope.withTransform
import androidx.compose.ui.layout.Layout
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.drawText
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.feature.activities.ActivityBadge
import com.zoonk.android.feature.activities.ActivityCanvas
import com.zoonk.android.feature.activities.ActivityCanvasLabel
import com.zoonk.android.feature.activities.ActivityProps
import com.zoonk.android.feature.activities.ActivityRenderer
import com.zoonk.android.feature.activities.ActivitySelectGrid
import com.zoonk.android.feature.activities.ActivityTile
import com.zoonk.android.feature.activities.LineMarker
import com.zoonk.android.ui.richtext.RichText
import com.zoonk.android.ui.theme.withTabularFigures
import com.zoonk.android.ui.theme.zoonk
import com.zoonk.api.models.PlayableLibraryStepAnyOfContentOneOf23FieldsPlacesInner
import kotlin.math.floor
import kotlin.math.roundToInt
import com.zoonk.api.models.PlayableLibraryStepAnyOfContent.PlayableLibraryStepAnyOfContentOneOf23Value as MapExplorerContent

val mapExplorerRenderer =
    ActivityRenderer(
        badge = { ActivityBadge(R.string.activities_reasoning_badge_explore_map, R.drawable.ic_map) },
        canvas = { MapExplorerActivity(it) },
    )

private typealias Place = PlayableLibraryStepAnyOfContentOneOf23FieldsPlacesInner

@Composable
private fun MapExplorerActivity(props: ActivityProps) {
    val fields = (props.content as MapExplorerContent).value.fields
    val assets = LocalContext.current.assets
    val map = remember(fields.baseMapId) { loadBaseMap(assets, fields.baseMapId) }

    if (map == null) {
        ActivityCanvas {
            Text(
                stringResource(R.string.activities_reasoning_map_unavailable),
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                style = MaterialTheme.typography.bodyMedium,
            )
        }
        return
    }

    var selectedId by rememberSaveable { mutableStateOf<String?>(null) }
    var visited by rememberSaveable { mutableStateOf(listOf<String>()) }
    val places = fields.places
    val name = baseMapName(fields.baseMapId)?.let { stringResource(it) }.orEmpty()
    val note = baseMapNote(fields.baseMapId)?.let { stringResource(it) }
    val selected = places.indexOfFirst { it.id == selectedId }

    fun select(id: String) {
        selectedId = id
        if (id !in visited) visited = visited + id
    }

    ActivityCanvas {
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.Bottom) {
            Text(name, Modifier.weight(1f), color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodyMedium)
            Text(
                pluralStringResource(R.plurals.activities_reasoning_map_explored, places.size, visited.size, places.size),
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                style = MaterialTheme.typography.labelMedium.withTabularFigures(),
            )
        }
        MapView(map, places, name, selectedId, visited, ::select)
        if (map.drawing.legend.isNotEmpty() || note != null) {
            FlowRow(horizontalArrangement = Arrangement.spacedBy(16.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                map.drawing.legend.forEach { LegendItem(it) }
                note?.let { ActivityCanvasLabel(it) }
            }
        }
        PlaceDetails(selected + 1, places.getOrNull(selected))
        ActivitySelectGrid(
            places.withIndex().toList(),
            label = stringResource(R.string.activities_reasoning_map_places),
            columns = if (places.any { it.label.length > LONG_LABEL }) 1 else 2,
        ) { (index, place) ->
            ActivityTile(
                picked = place.id == selectedId,
                result = null,
                onClick = { select(place.id) },
                role = Role.RadioButton,
            ) {
                PlaceNumber(index + 1, isVisited = place.id in visited, isSelected = false, small = true)
                Text(place.label, Modifier.padding(start = 8.dp))
            }
        }
    }
}

private class PinSpot(
    val number: Int,
    val place: Place,
    val spot: MapPoint,
    val shown: MapPoint,
)

private class MapLayout(
    val crop: MapBox,
    val height: Double,
    val pins: List<PinSpot>,
)

/** Main's `layoutPins`, in dp: the part of the map to show, how tall, and where each place's pin goes. */
private fun layoutPins(
    drawing: BaseMapDrawing,
    places: List<Place>,
    width: Double,
): MapLayout {
    val projected =
        places.withIndex().mapNotNull { (index, place) ->
            projectPlace(drawing.projection, place.latitude, place.longitude)?.let {
                index to
                    it
            }
        }
    val crop = fitViewport(drawing.width, drawing.height, drawing.maxZoom, projected.map { it.second }, maxAspect = MAX_MAP_HEIGHT / width)
    val zoom = width / crop.width
    val height = floor(crop.height * zoom + 0.5)
    val spots = projected.map { (_, point) -> MapPoint((point.x - crop.x) * zoom, (point.y - crop.y) * zoom) }
    val shown = spreadPins(spots, PIN_SPACING, width, height)
    return MapLayout(crop, height, projected.mapIndexed { at, (index, _) -> PinSpot(index + 1, places[index], spots[at], shown[at]) })
}

@Composable
private fun MapView(
    map: BaseMap,
    places: List<Place>,
    name: String,
    selectedId: String?,
    visited: List<String>,
    onSelect: (String) -> Unit,
) {
    val description =
        pluralStringResource(
            R.plurals.activities_reasoning_map_description,
            places.size,
            name,
            places.size,
            places
                .mapIndexed {
                    index,
                    place,
                    ->
                    stringResource(R.string.activities_reasoning_map_place, index + 1, place.label)
                }.joinToString(", "),
        )
    BoxWithConstraints(Modifier.fillMaxWidth()) {
        val width = maxWidth.value.toDouble()
        val layout = remember(map, places, width) { layoutPins(map.drawing, places, width) }
        Box(
            Modifier
                .fillMaxWidth()
                .height(layout.height.dp)
                .clip(RoundedCornerShape(12.dp))
                .semantics { contentDescription = description },
        ) {
            MapDrawing(map, layout, Modifier.matchParentSize())
            Layout(
                content = {
                    layout.pins.forEach { pin ->
                        Pin(pin, isSelected = pin.place.id == selectedId, isVisited = pin.place.id in visited) { onSelect(pin.place.id) }
                    }
                },
                modifier = Modifier.matchParentSize(),
            ) { measurables, constraints ->
                val pins = measurables.map { it.measure(constraints.copy(minWidth = 0, minHeight = 0)) }
                layout(constraints.maxWidth, constraints.maxHeight) {
                    pins.forEachIndexed { index, pin ->
                        val shown = layout.pins[index].shown
                        pin.place(shown.x.dp.roundToPx() - pin.width / 2, shown.y.dp.roundToPx() - pin.height / 2)
                    }
                }
            }
        }
    }
}

/** Main's `BaseMapView` drawing: the base map's shapes, streets and labels, and a line from each moved pin to its true spot. */
@Composable
private fun MapDrawing(
    map: BaseMap,
    layout: MapLayout,
    modifier: Modifier,
) {
    val colors = MaterialTheme.colorScheme
    val accent = MaterialTheme.zoonk.vizAccent
    val tones = regionTones()
    val sea = tones.getValue(RegionTone.GroupC)
    val measurer = rememberTextMeasurer()
    val regionStyle = MaterialTheme.typography.labelMedium.copy(fontWeight = FontWeight.SemiBold)
    val streetStyle = MaterialTheme.typography.labelMedium.copy(fontWeight = FontWeight.Medium)
    val labelTexts = map.drawing.labels.map { label -> label.key?.let(::baseMapLabel)?.let { stringResource(it) } ?: label.text }
    val labels =
        remember(map, labelTexts, regionStyle, streetStyle) {
            map.drawing.labels.mapIndexed { index, label ->
                label to measurer.measure(labelTexts[index], if (label.kind == LabelKind.Street) streetStyle else regionStyle)
            }
        }
    val regionLabel = colors.onSurface.copy(alpha = REGION_LABEL_ALPHA)

    Canvas(modifier.clearAndSetSemantics {}) {
        val crop = layout.crop
        val zoom = (size.width / crop.width).toFloat()
        if (map.sphere == null) drawRect(sea)
        withTransform({
            translate((-crop.x * zoom).toFloat(), (-crop.y * zoom).toFloat())
            scale(zoom, zoom, Offset.Zero)
        }) {
            map.sphere?.let { drawPath(it, sea) }
            val hairline = Stroke(0.75.dp.toPx() / zoom, join = StrokeJoin.Round)
            map.regions.forEach { (path, tone) ->
                drawPath(path, tones.getValue(tone))
                drawPath(path, colors.outlineVariant, style = hairline)
            }
            val street = Stroke(STREET_WIDTH.toPx() / zoom, cap = StrokeCap.Round, join = StrokeJoin.Round)
            map.streets.forEach { drawPath(it, colors.surface, style = street) }
            map.drawing.insets.forEach {
                drawRect(
                    colors.outlineVariant,
                    topLeft = Offset(it.x.toFloat(), it.y.toFloat()),
                    size = Size(it.width.toFloat(), it.height.toFloat()),
                    style = Stroke(1.dp.toPx() / zoom),
                )
            }
        }

        val halo = Stroke(LABEL_HALO.toPx(), join = StrokeJoin.Round)
        labels.forEach { (label, text) ->
            val center = Offset(((label.x - crop.x) * zoom).toFloat(), ((label.y - crop.y) * zoom).toFloat())
            val topLeft = center - Offset(text.size.width / 2f, text.size.height / 2f)
            rotate(label.angle.toFloat(), pivot = center) {
                drawText(text, colors.surface, topLeft, drawStyle = halo)
                drawText(text, if (label.kind == LabelKind.Street) colors.onSurfaceVariant else regionLabel, topLeft, drawStyle = Fill)
            }
        }

        layout.pins.forEach { pin ->
            val spot =
                Offset(
                    pin.spot.x.dp
                        .toPx(),
                    pin.spot.y.dp
                        .toPx(),
                )
            val shown =
                Offset(
                    pin.shown.x.dp
                        .toPx(),
                    pin.shown.y.dp
                        .toPx(),
                )
            if (spot != shown) drawLine(accent, spot, shown, strokeWidth = 1.5.dp.toPx())
            drawCircle(accent, radius = TRUE_SPOT.toPx(), center = spot)
        }
    }
}

/** Main's region tones: soft tints laid over the page, so they stay opaque where shapes meet. */
@Composable
private fun regionTones(): Map<RegionTone, Color> {
    val surface = MaterialTheme.colorScheme.surface
    val viz = MaterialTheme.zoonk

    fun soft(color: Color) = color.copy(alpha = SOFT).compositeOver(surface)
    return mapOf(
        RegionTone.Context to MaterialTheme.colorScheme.surfaceContainerHigh,
        RegionTone.Focus to surface,
        RegionTone.GroupA to soft(viz.vizAccent),
        RegionTone.GroupB to soft(viz.vizHighlight),
        RegionTone.GroupC to soft(viz.vizSecondary),
    )
}

@Composable
private fun Pin(
    pin: PinSpot,
    isSelected: Boolean,
    isVisited: Boolean,
    onClick: () -> Unit,
) {
    val description = stringResource(R.string.activities_reasoning_map_place, pin.number, pin.place.label)
    Box(
        Modifier
            .sizeIn(minWidth = 48.dp, minHeight = 48.dp)
            .clip(CircleShape)
            .selectable(selected = isSelected, role = Role.Button, onClick = onClick)
            .clearAndSetSemantics { contentDescription = description },
        contentAlignment = Alignment.Center,
    ) {
        PlaceNumber(pin.number, isVisited, isSelected, small = false)
    }
}

/** A place's number: white until explored, tinted once explored, solid while shown. */
@Composable
private fun PlaceNumber(
    number: Int,
    isVisited: Boolean,
    isSelected: Boolean,
    small: Boolean,
) {
    val accent = MaterialTheme.zoonk.vizAccent
    val surface = MaterialTheme.colorScheme.surface
    val (container, content) =
        when {
            isSelected -> accent to surface
            isVisited -> accent.copy(alpha = SOFT).compositeOver(surface) to accent
            else -> surface to accent
        }
    val size = if (small) 24.dp else 32.dp
    Box(
        Modifier
            .then(
                if (isSelected) {
                    Modifier.drawBehind {
                        drawCircle(
                            accent.copy(alpha = RING_ALPHA),
                            radius =
                                this.size.minDimension / 2 + RING.toPx(),
                        )
                    }
                } else {
                    Modifier
                },
            ).defaultMinSize(size, size)
            .then(if (small) Modifier else Modifier.shadow(PIN_SHADOW, CircleShape))
            .background(container, CircleShape)
            .border(if (small) 1.5.dp else 2.dp, accent, CircleShape)
            .padding(horizontal = 4.dp),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            "$number",
            color = content,
            style =
                (if (small) MaterialTheme.typography.labelMedium else MaterialTheme.typography.labelLarge).withTabularFigures().copy(
                    fontWeight = FontWeight.SemiBold,
                ),
        )
    }
}

@Composable
private fun LegendItem(item: BaseMapLegendItem) {
    val tones = regionTones()
    Row(
        Modifier.clearAndSetSemantics {},
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Box(
            Modifier
                .size(12.dp)
                .clip(RoundedCornerShape(2.dp))
                .background(tones.getValue(item.tone))
                .border(1.dp, MaterialTheme.colorScheme.outlineVariant, RoundedCornerShape(2.dp)),
        )
        ActivityCanvasLabel(baseMapLabel(item.key)?.let { stringResource(it) } ?: item.key)
    }
}

/** Main's `PlaceDetails`: what the shown place reveals, or how to start. */
@Composable
private fun PlaceDetails(
    number: Int,
    place: Place?,
) {
    Box(Modifier.semantics { liveRegion = LiveRegionMode.Polite }) {
        if (place == null) {
            val style = MaterialTheme.typography.bodyMedium
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                LineMarker(style) {
                    Icon(
                        painterResource(R.drawable.ic_location_on),
                        contentDescription = null,
                        modifier = Modifier.size(16.dp),
                        tint = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
                Text(
                    stringResource(R.string.activities_reasoning_map_hint),
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    style = style,
                )
            }
        } else {
            Surface(
                shape = RoundedCornerShape(12.dp),
                color = MaterialTheme.colorScheme.surface,
                border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
                modifier = Modifier.fillMaxWidth(),
            ) {
                Row(Modifier.padding(12.dp), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    PlaceNumber(number, isVisited = true, isSelected = true, small = false)
                    Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                        Text(place.label, style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.SemiBold))
                        RichText(
                            place.reveals,
                            style = MaterialTheme.typography.bodyMedium.copy(color = MaterialTheme.colorScheme.onSurfaceVariant),
                        )
                    }
                }
            }
        }
    }
}

@StringRes
private fun baseMapName(id: String): Int? =
    when (id) {
        "africa" -> R.string.activities_reasoning_map_africa
        "americas" -> R.string.activities_reasoning_map_americas
        "asia" -> R.string.activities_reasoning_map_asia
        "brazil-states" -> R.string.activities_reasoning_map_brazil_states
        "europe" -> R.string.activities_reasoning_map_europe
        "europe-1914" -> R.string.activities_reasoning_map_europe_1914
        "london-1854" -> R.string.activities_reasoning_map_london_1854
        "roman-empire-117" -> R.string.activities_reasoning_map_roman_empire_117
        "usa-states" -> R.string.activities_reasoning_map_usa_states
        "world" -> R.string.activities_reasoning_map_world
        "world-continents" -> R.string.activities_reasoning_map_world_continents
        else -> null
    }

@StringRes
private fun baseMapNote(id: String): Int? =
    when (id) {
        "europe-1914", "roman-empire-117" -> R.string.activities_reasoning_map_note_borders
        "london-1854" -> R.string.activities_reasoning_map_note_london_1854
        else -> null
    }

/** Main's `useBaseMapLabels`: the place names a drawing writes on itself; street names stay as written. */
@StringRes
private fun baseMapLabel(key: String): Int? =
    when (key) {
        "africa" -> R.string.activities_reasoning_map_label_africa
        "antarctica" -> R.string.activities_reasoning_map_label_antarctica
        "asia" -> R.string.activities_reasoning_map_label_asia
        "austriaHungary" -> R.string.activities_reasoning_map_label_austria_hungary
        "europe" -> R.string.activities_reasoning_map_label_europe
        "france" -> R.string.activities_reasoning_map_label_france
        "germanEmpire" -> R.string.activities_reasoning_map_label_german_empire
        "italy" -> R.string.activities_reasoning_map_label_italy
        "northAmerica" -> R.string.activities_reasoning_map_label_north_america
        "oceania" -> R.string.activities_reasoning_map_label_oceania
        "ottomanEmpire" -> R.string.activities_reasoning_map_label_ottoman_empire
        "parthianEmpire" -> R.string.activities_reasoning_map_label_parthian_empire
        "romanEmpire" -> R.string.activities_reasoning_map_label_roman_empire
        "russianEmpire" -> R.string.activities_reasoning_map_label_russian_empire
        "serbia" -> R.string.activities_reasoning_map_label_serbia
        "southAmerica" -> R.string.activities_reasoning_map_label_south_america
        "spain" -> R.string.activities_reasoning_map_label_spain
        "tripleAlliance" -> R.string.activities_reasoning_map_label_triple_alliance
        "tripleEntente" -> R.string.activities_reasoning_map_label_triple_entente
        "unitedKingdom" -> R.string.activities_reasoning_map_label_united_kingdom
        else -> null
    }

private const val MAX_MAP_HEIGHT = 440.0
private const val PIN_SPACING = 40.0
private const val LONG_LABEL = 24
private const val SOFT = 0.16f
private const val RING_ALPHA = 0.3f
private const val REGION_LABEL_ALPHA = 0.75f
private val STREET_WIDTH = 9.dp
private val LABEL_HALO = 3.dp
private val TRUE_SPOT = 3.5.dp
private val RING = 4.dp
private val PIN_SHADOW = 4.dp
