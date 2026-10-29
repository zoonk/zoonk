package com.zoonk.android.feature.activities.reasoning

import android.content.res.AssetManager
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.vector.PathParser
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import java.io.FileNotFoundException

@Serializable
internal enum class ProjectionKind {
    @SerialName("albersUsa")
    AlbersUsa,

    @SerialName("azimuthalEqualArea")
    AzimuthalEqualArea,

    @SerialName("conicEqualArea")
    ConicEqualArea,

    @SerialName("equalEarth")
    EqualEarth,

    @SerialName("mercator")
    Mercator,
}

@Serializable
internal data class BaseMapProjection(
    val kind: ProjectionKind,
    val scale: Double,
    val translate: List<Double>,
    val parallels: List<Double>? = null,
    val rotate: List<Double>? = null,
)

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

/** Main's pre-built base map drawings (`_assets/base-maps/generated`), in their own coordinates. */
@Serializable
internal data class BaseMapDrawing(
    val width: Double,
    val height: Double,
    val maxZoom: Double,
    val projection: BaseMapProjection,
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

/** The build copies main's drawings into `assets/base-maps`; a map it doesn't have is null. */
internal fun loadBaseMap(
    assets: AssetManager,
    id: String,
): BaseMap? {
    val json =
        try {
            assets.open("base-maps/$id.json").use { it.readBytes().decodeToString() }
        } catch (_: FileNotFoundException) {
            return null
        }
    return BaseMap(mapJson.decodeFromString(BaseMapDrawing.serializer(), json))
}

private val mapJson = Json { ignoreUnknownKeys = true }
