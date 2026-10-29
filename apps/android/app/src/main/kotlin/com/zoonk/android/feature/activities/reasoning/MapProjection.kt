package com.zoonk.android.feature.activities.reasoning

import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.asin
import kotlin.math.atan2
import kotlin.math.cos
import kotlin.math.floor
import kotlin.math.ln
import kotlin.math.sin
import kotlin.math.sqrt
import kotlin.math.tan

private typealias RawProjection = (lambda: Double, phi: Double) -> MapPoint

/**
 * Main's `projectPlace`: where a place falls on a base map, through the same d3-geo projection the
 * map was drawn with (`d3-geo` 3.1, point projection only). Null when the projection leaves the
 * place out, as the United States map does outside its three areas.
 */
internal fun projectPlace(
    spec: BaseMapProjection,
    latitude: Double,
    longitude: Double,
): MapPoint? {
    val rotate = spec.rotate ?: listOf(0.0, 0.0, 0.0)
    val (x, y) = spec.translate
    return when (spec.kind) {
        ProjectionKind.Mercator -> {
            d3Projection(::mercatorRaw, spec.scale, x, y, rotate = rotate)(longitude, latitude)
        }

        ProjectionKind.EqualEarth -> {
            d3Projection(::equalEarthRaw, spec.scale, x, y, rotate = rotate)(longitude, latitude)
        }

        ProjectionKind.AzimuthalEqualArea -> {
            d3Projection(::azimuthalEqualAreaRaw, spec.scale, x, y, rotate = rotate)(longitude, latitude)
        }

        ProjectionKind.ConicEqualArea -> {
            conicEqualArea(
                spec.parallels ?: CONIC_PARALLELS,
                spec.scale,
                x,
                y,
                rotate = rotate,
            )(longitude, latitude)
        }

        ProjectionKind.AlbersUsa -> {
            albersUsa(spec.scale, x, y, longitude, latitude)
        }
    }
}

/** d3's `projection(point)`: rotate, project, then scale and translate around the projection's center; outside [extent], nothing. */
private fun d3Projection(
    raw: RawProjection,
    scale: Double,
    translateX: Double,
    translateY: Double,
    center: List<Double> = listOf(0.0, 0.0),
    rotate: List<Double>,
    extent: List<Double>? = null,
): (longitude: Double, latitude: Double) -> MapPoint? {
    val rotation = rotation(rotate.map { it % 360 * RADIANS })
    val origin = raw(center[0] % 360 * RADIANS, center[1] % 360 * RADIANS)
    val dx = translateX - scale * origin.x
    val dy = translateY + scale * origin.y
    return { longitude, latitude ->
        val rotated = rotation(longitude * RADIANS, latitude * RADIANS)
        val point = raw(rotated.x, rotated.y).let { MapPoint(dx + scale * it.x, dy - scale * it.y) }
        if (extent == null) point else point.takeIf { it.x in extent[0]..extent[2] && it.y in extent[1]..extent[3] }
    }
}

private fun rotation(angles: List<Double>): RawProjection {
    val deltaLambda = angles[0] % TAU
    val deltaPhi = angles[1]
    val deltaGamma = angles.getOrElse(2) { 0.0 }
    val turnsPhi = deltaPhi != 0.0 || deltaGamma != 0.0
    return when {
        deltaLambda != 0.0 && turnsPhi -> {
            lambda,
            phi,
            ->
            rotationLambda(deltaLambda)(lambda, phi).let { rotationPhiGamma(deltaPhi, deltaGamma)(it.x, it.y) }
        }

        deltaLambda != 0.0 -> rotationLambda(deltaLambda)

        turnsPhi -> rotationPhiGamma(deltaPhi, deltaGamma)

        else -> rotationLambda(0.0)
    }
}

private fun rotationLambda(deltaLambda: Double): RawProjection =
    { lambda, phi ->
        val turned = lambda + deltaLambda
        MapPoint(if (abs(turned) > PI) turned - (turned / TAU).jsRound() * TAU else turned, phi)
    }

private fun rotationPhiGamma(
    deltaPhi: Double,
    deltaGamma: Double,
): RawProjection {
    val cosDeltaPhi = cos(deltaPhi)
    val sinDeltaPhi = sin(deltaPhi)
    val cosDeltaGamma = cos(deltaGamma)
    val sinDeltaGamma = sin(deltaGamma)
    return { lambda, phi ->
        val cosPhi = cos(phi)
        val x = cos(lambda) * cosPhi
        val y = sin(lambda) * cosPhi
        val z = sin(phi)
        val k = z * cosDeltaPhi + x * sinDeltaPhi
        MapPoint(
            atan2(y * cosDeltaGamma - k * sinDeltaGamma, x * cosDeltaPhi - z * sinDeltaPhi),
            asin(k * cosDeltaGamma + y * sinDeltaGamma),
        )
    }
}

/** JavaScript's `Math.round`: halves round up, toward positive infinity. */
private fun Double.jsRound(): Double = floor(this + 0.5)

private fun mercatorRaw(
    lambda: Double,
    phi: Double,
) = MapPoint(lambda, ln(tan((PI / 2 + phi) / 2)))

private fun equalEarthRaw(
    lambda: Double,
    phi: Double,
): MapPoint {
    val l = asin(EQUAL_EARTH_M * sin(phi))
    val l2 = l * l
    val l6 = l2 * l2 * l2
    return MapPoint(
        lambda * cos(l) / (EQUAL_EARTH_M * (A1 + 3 * A2 * l2 + l6 * (7 * A3 + 9 * A4 * l2))),
        l * (A1 + A2 * l2 + l6 * (A3 + A4 * l2)),
    )
}

private fun azimuthalEqualAreaRaw(
    lambda: Double,
    phi: Double,
): MapPoint {
    val cx = cos(lambda)
    val cy = cos(phi)
    val k = sqrt(2 / (1 + cx * cy))
    return if (k.isInfinite()) MapPoint(2.0, 0.0) else MapPoint(k * cy * sin(lambda), k * sin(phi))
}

private fun conicEqualAreaRaw(parallels: List<Double>): RawProjection {
    val y0 = parallels[0] * RADIANS
    val y1 = parallels[1] * RADIANS
    val sy0 = sin(y0)
    val n = (sy0 + sin(y1)) / 2
    if (abs(n) < EPSILON) {
        val cosPhi0 = cos(y0)
        return { lambda, phi -> MapPoint(lambda * cosPhi0, sin(phi) / cosPhi0) }
    }
    val c = 1 + sy0 * (2 * n - sy0)
    val r0 = sqrt(c) / n
    return { lambda, phi ->
        val r = sqrt(c - 2 * n * sin(phi)) / n
        MapPoint(r * sin(lambda * n), r0 - r * cos(lambda * n))
    }
}

private fun conicEqualArea(
    parallels: List<Double>,
    scale: Double,
    x: Double,
    y: Double,
    center: List<Double> = CONIC_CENTER,
    rotate: List<Double>,
    extent: List<Double>? = null,
) = d3Projection(conicEqualAreaRaw(parallels), scale, x, y, center, rotate, extent)

/** d3's `geoAlbersUsa`: the lower 48 states, then Alaska and Hawaii in their insets, each only inside its own box. */
private fun albersUsa(
    k: Double,
    x: Double,
    y: Double,
    longitude: Double,
    latitude: Double,
): MapPoint? {
    val lower48 =
        conicEqualArea(
            listOf(29.5, 45.5),
            k,
            x,
            y,
            center = listOf(-0.6, 38.7),
            rotate = listOf(96.0, 0.0),
            extent = listOf(x - 0.455 * k, y - 0.238 * k, x + 0.455 * k, y + 0.238 * k),
        )
    val alaska =
        conicEqualArea(
            listOf(55.0, 65.0),
            k * 0.35,
            x - 0.307 * k,
            y + 0.201 * k,
            center = listOf(-2.0, 58.5),
            rotate = listOf(154.0, 0.0),
            extent = listOf(x - 0.425 * k + EPSILON, y + 0.120 * k + EPSILON, x - 0.214 * k - EPSILON, y + 0.234 * k - EPSILON),
        )
    val hawaii =
        conicEqualArea(
            listOf(8.0, 18.0),
            k,
            x - 0.205 * k,
            y + 0.212 * k,
            center = listOf(-3.0, 19.9),
            rotate = listOf(157.0, 0.0),
            extent = listOf(x - 0.214 * k + EPSILON, y + 0.166 * k + EPSILON, x - 0.115 * k - EPSILON, y + 0.234 * k - EPSILON),
        )
    return lower48(longitude, latitude) ?: alaska(longitude, latitude) ?: hawaii(longitude, latitude)
}

private const val RADIANS = PI / 180
private const val TAU = 2 * PI
private const val EPSILON = 1e-6
private const val A1 = 1.340264
private const val A2 = -0.081106
private const val A3 = 0.000893
private const val A4 = 0.003796
private val EQUAL_EARTH_M = sqrt(3.0) / 2
private val CONIC_PARALLELS = listOf(0.0, 60.0)
private val CONIC_CENTER = listOf(0.0, 33.6442)
