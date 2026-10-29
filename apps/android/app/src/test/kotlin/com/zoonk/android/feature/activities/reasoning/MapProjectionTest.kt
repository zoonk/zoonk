package com.zoonk.android.feature.activities.reasoning

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

/** Expected points are what main's `projectPlace` (d3-geo 3.1) returns for the same base maps and places. */
class MapProjectionTest {
    private val pump = 51.51334 to -0.13667
    private val newYork = 40.7 to -74.0
    private val anchorage = 61.2 to -149.9
    private val honolulu = 21.3 to -157.8
    private val tokyo = 35.7 to 139.7
    private val nearAntimeridian = 0.0 to 179.9

    private fun assertProjects(
        spec: BaseMapProjection,
        place: Pair<Double, Double>,
        expected: MapPoint,
    ) {
        val point = checkNotNull(projectPlace(spec, place.first, place.second))
        assertEquals(expected.x, point.x, TOLERANCE)
        assertEquals(expected.y, point.y, TOLERANCE)
    }

    @Test
    fun projectsOnEqualEarth() {
        val world = BaseMapProjection(ProjectionKind.EqualEarth, 184.73156767339816, listOf(500.0, 243.35848769370224))
        assertProjects(world, pump, MapPoint(499.69074352605253, 65.05602536658614))
        assertProjects(world, tokyo, MapPoint(852.7386675138487, 114.40943295095636))
        assertProjects(world, nearAntimeridian, MapPoint(999.7222222222222, 243.35848769370224))
    }

    @Test
    fun projectsOnARotatedAzimuthalEqualArea() {
        val europe =
            BaseMapProjection(
                ProjectionKind.AzimuthalEqualArea,
                952.2897023403041,
                listOf(530.2800063468133, 390.32013721073855),
                rotate = listOf(-15.0, -52.0, 0.0),
            )
        val americas =
            BaseMapProjection(
                ProjectionKind.AzimuthalEqualArea,
                409.2585951667836,
                listOf(500.0, 489.62058776639844),
                rotate = listOf(95.0, -10.0, 0.0),
            )
        assertProjects(europe, pump, MapPoint(375.00998561721497, 382.1789554068741))
        assertProjects(europe, newYork, MapPoint(-297.1968260912024, -36.5572023311658))
        assertProjects(americas, newYork, MapPoint(616.8738578247719, 266.2379204092788))
        assertProjects(americas, nearAntimeridian, MapPoint(-53.83979030814373, 497.8655454824037))
    }

    @Test
    fun projectsOnMercator() {
        val soho = BaseMapProjection(ProjectionKind.Mercator, 3819718.6342054936, listOf(9600.000000000013, 4020415.8208127413))
        assertProjects(soho, pump, MapPoint(488.66666666666606, 392.08917915588245))
    }

    @Test
    fun putsAlaskaAndHawaiiInTheirInsetsAndLeavesOutTheRestOfTheWorld() {
        val usa = BaseMapProjection(ProjectionKind.AlbersUsa, 1281.155720846112, listOf(537.23940528341, 287.7963402143282))
        assertProjects(usa, newYork, MapPoint(914.0820440469392, 200.08857874304863))
        assertProjects(usa, anchorage, MapPoint(167.46580497056968, 523.7476181927486))
        assertProjects(usa, honolulu, MapPoint(321.11872637861643, 528.6042091878818))
        assertNull(projectPlace(usa, pump.first, pump.second))
        assertNull(projectPlace(usa, tokyo.first, tokyo.second))
    }

    private companion object {
        const val TOLERANCE = 1e-6
    }
}
