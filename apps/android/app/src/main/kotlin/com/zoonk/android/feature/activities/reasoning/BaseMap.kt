package com.zoonk.android.feature.activities.reasoning

import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.vector.PathParser
import com.zoonk.api.ApiJson
import com.zoonk.api.models.ActivityBaseMap
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

@Serializable
internal enum class RegionTone {
    @SerialName("context")
    Context,

    @SerialName("focus")
    Focus,

    @SerialName("groupA")
    GroupA,

    @SerialName("groupB")
    GroupB,

    @SerialName("groupC")
    GroupC,
}

@Serializable
internal data class BaseMapRegion(
    val path: String,
    val tone: RegionTone,
)

@Serializable
internal data class BaseMapStreet(
    val path: String,
)

@Serializable
internal data class BaseMapInset(
    val x: Double,
    val y: Double,
    val width: Double,
    val height: Double,
)

@Serializable
internal enum class LabelKind {
    @SerialName("region")
    Region,

    @SerialName("street")
    Street,
}

@Serializable
internal data class BaseMapLabel(
    val text: String,
    val key: String? = null,
    val kind: LabelKind,
    val x: Double,
    val y: Double,
    val angle: Double,
)

@Serializable
internal data class BaseMapLegendItem(
    val key: String,
    val tone: RegionTone,
)

@Serializable
internal data class BaseMapPlace(
    val id: String,
    val x: Double,
    val y: Double,
)

/** The API's `baseMap`: main's base map drawing, in its own units, with each place already at its spot. */
@Serializable
internal data class BaseMapDrawing(
    val width: Double,
    val height: Double,
    val maxZoom: Double,
    val places: List<BaseMapPlace>,
    val regions: List<BaseMapRegion>,
    val streets: List<BaseMapStreet>,
    val insets: List<BaseMapInset>,
    val labels: List<BaseMapLabel>,
    val legend: List<BaseMapLegendItem>,
    val sphere: String? = null,
)

/** A drawing with its paths parsed once, ready to draw at any size. */
internal class BaseMap(
    val drawing: BaseMapDrawing,
) {
    val sphere: Path? = drawing.sphere?.let(::toPath)
    val regions: List<Pair<Path, RegionTone>> = drawing.regions.map { toPath(it.path) to it.tone }
    val streets: List<Path> = drawing.streets.map { toPath(it.path) }
}

private fun toPath(svg: String): Path = PathParser().parsePathString(svg).toPath()

internal fun ActivityBaseMap.toBaseMap(): BaseMap =
    BaseMap(mapJson.decodeFromJsonElement(BaseMapDrawing.serializer(), ApiJson.encodeToJsonElement(ActivityBaseMap.serializer(), this)))

private val mapJson = Json { ignoreUnknownKeys = true }
