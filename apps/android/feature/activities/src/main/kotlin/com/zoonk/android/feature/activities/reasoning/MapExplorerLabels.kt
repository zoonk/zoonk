package com.zoonk.android.feature.activities.reasoning

import androidx.compose.foundation.Canvas
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.PathMeasure
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.Fill
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.graphics.drawscope.withTransform
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.text.TextLayoutResult
import androidx.compose.ui.text.drawText
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.unit.dp
import kotlin.math.min

internal data class MapLabelsLayout(
    val texts: List<Pair<BaseMapLabel, TextLayoutResult>>,
    val labels: List<MapLabelSpot>,
    val spots: List<MapLabelPlacement?>,
    val pinNumbers: List<MapBox>,
)

@Composable
internal fun mapLabelLayout(
    map: BaseMap,
    layout: MapLayout,
    references: String,
    question: String,
): MapLabelsLayout {
    val measurer = rememberTextMeasurer()
    val numberStyle = mapPinNumberStyle()
    val density = LocalDensity.current.density
    val fontScale = LocalDensity.current.fontScale
    val labelSize = MaterialTheme.typography.labelMedium.fontSize * (min(fontScale, MAX_LABEL_SCALE) / fontScale)
    val regionStyle = MaterialTheme.typography.labelMedium.copy(fontSize = labelSize, fontWeight = FontWeight.SemiBold)
    val streetStyle = MaterialTheme.typography.labelMedium.copy(fontSize = labelSize, fontWeight = FontWeight.Medium)
    val labelTexts = map.drawing.labels.map { label -> label.key?.let(::baseMapLabel)?.let { stringResource(it) } ?: label.text }
    val labels =
        remember(map, labelTexts, regionStyle, streetStyle) {
            map.drawing.labels.mapIndexed { index, label ->
                label to measurer.measure(labelTexts[index], if (label.kind == LabelKind.Street) streetStyle else regionStyle)
            }
        }

    val crop = layout.crop
    val zoom = (layout.width / crop.width).toFloat()
    val streetPaths =
        map.streets.map { path ->
            val bounds = path.getBounds()
            val steps =
                kotlin.math
                    .ceil((bounds.width + bounds.height) * zoom / MAP_STREET_SAMPLE_STEP)
                    .toInt()
                    .coerceAtLeast(1)
            val measure = PathMeasure().apply { setPath(path, false) }
            (0..steps).map { step ->
                val point = measure.getPosition(measure.length * step / steps)
                MapPoint((point.x - crop.x) * zoom, (point.y - crop.y) * zoom)
            }
        }
    val geometry =
        labels.mapIndexed { index, (label, text) ->
            val streetIndex = map.drawing.streets.indexOfFirst { it.name == label.text }
            val positions = streetPaths.getOrNull(streetIndex).orEmpty()
            MapLabelSpot(
                MapPoint(
                    (label.x - crop.x) * zoom,
                    (label.y - crop.y) * zoom,
                ),
                text.size.width.toDouble() / density,
                text.size.height.toDouble() / density,
                label.angle,
                label.kind == LabelKind.Street,
                isMapLabelNamed(references, label.text, labelTexts[index]),
                positions,
                question = isMapLabelNamed(question, label.text, labelTexts[index]),
            )
        }
    val pinNumbers =
        layout.pins.map { pin ->
            val number = measurer.measure(pin.number.toString(), numberStyle)
            val w = number.size.width.toDouble() / density
            val h = number.size.height.toDouble() / density
            MapBox(pin.shown.x - w / 2, pin.shown.y - h / 2, w, h)
        }
    val spots =
        placeMapLabels(
            geometry,
            layout.pins.map { it.shown },
            layout.width,
            layout.height,
            streets = streetPaths,
            pinNumbers = pinNumbers,
        )
    return MapLabelsLayout(labels, geometry, spots, pinNumbers)
}

@Composable
internal fun MapLabels(
    map: BaseMap,
    layout: MapLayout,
    references: String,
    question: String,
    modifier: Modifier,
) {
    val colors = MaterialTheme.colorScheme
    val regionLabel = colors.onSurface.copy(alpha = REGION_LABEL_ALPHA)
    val layoutLabels = mapLabelLayout(map, layout, references, question)
    Canvas(modifier.clearAndSetSemantics {}) {
        val halo = Stroke(LABEL_HALO.toPx(), join = StrokeJoin.Round)
        layoutLabels.texts.forEachIndexed { index, (label, text) ->
            val spot = layoutLabels.spots[index] ?: return@forEachIndexed
            val center = Offset((spot.x * density).toFloat(), (spot.y * density).toFloat())
            val topLeft = center - Offset(text.size.width / 2f, text.size.height / 2f)
            rotate(label.angle.toFloat(), pivot = center) {
                withTransform({ scale(spot.scale.toFloat(), spot.scale.toFloat(), pivot = center) }) {
                    drawText(text, colors.surface, topLeft, drawStyle = halo)
                    drawText(text, if (label.kind == LabelKind.Street) colors.onSurfaceVariant else regionLabel, topLeft, drawStyle = Fill)
                }
            }
        }
    }
}

private const val REGION_LABEL_ALPHA = 0.75f

/** The map's own labels are part of the drawing, which doesn't grow with the font size. */
private const val MAX_LABEL_SCALE = 1.3f
private val LABEL_HALO = 3.dp
