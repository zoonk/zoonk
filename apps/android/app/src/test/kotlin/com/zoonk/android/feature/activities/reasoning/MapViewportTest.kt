package com.zoonk.android.feature.activities.reasoning

import org.junit.Assert.assertEquals
import org.junit.Test

/** Main's `map-viewport.test.ts`, with the values its `fitViewport` and `spreadPins` return. */
class MapViewportTest {
    private fun assertPoints(
        expected: List<MapPoint>,
        actual: List<MapPoint>,
    ) {
        assertEquals(expected.size, actual.size)
        expected.zip(actual).forEach { (want, got) ->
            assertEquals(want.x, got.x, TOLERANCE)
            assertEquals(want.y, got.y, TOLERANCE)
        }
    }

    @Test
    fun showsTheWholeMapWhenThereIsNothingToFrame() {
        assertEquals(MapBox(0.0, 0.0, 1000.0, 500.0), fitViewport(1000.0, 500.0, maxZoom = 4.0, points = emptyList()))
    }

    @Test
    fun zoomsInOnClusteredPlacesNoFurtherThanTheMapsDetailAllows() {
        val points = listOf(MapPoint(600.0, 200.0), MapPoint(610.0, 205.0))
        assertEquals(MapBox(480.0, 125.0, 250.0, 155.0), fitViewport(1000.0, 500.0, maxZoom = 4.0, points = points))
    }

    @Test
    fun keepsAShapeAPhoneCanShowAndStaysOnTheMap() {
        val points = listOf(MapPoint(20.0, 20.0), MapPoint(980.0, 40.0))
        assertEquals(MapBox(0.0, 0.0, 1000.0, 500.0), fitViewport(1000.0, 500.0, maxZoom = 4.0, points = points))
    }

    @Test
    fun keepsTheMapShortEnoughForAWideScreen() {
        assertEquals(
            MapBox(343.75, 187.5, 312.5, 125.0),
            fitViewport(1000.0, 500.0, maxZoom = 4.0, points = listOf(MapPoint(500.0, 250.0)), maxAspect = 0.4),
        )
    }

    @Test
    fun leavesPinsWithRoomAlone() {
        val points = listOf(MapPoint(50.0, 50.0), MapPoint(200.0, 200.0))
        assertEquals(points, spreadPins(points, distance = 40.0, width = 300.0, height = 300.0))
    }

    @Test
    fun pushesOverlappingPinsApartUntilTheyHaveRoom() {
        assertPoints(
            listOf(
                MapPoint(132.64928749927333, 140.59714999709337),
                MapPoint(177.35071250072667, 140.59714999709337),
                MapPoint(155.0, 188.80570000581326),
            ),
            spreadPins(
                listOf(MapPoint(150.0, 150.0), MapPoint(160.0, 150.0), MapPoint(155.0, 170.0)),
                distance = 40.0,
                width = 300.0,
                height = 300.0,
            ),
        )
    }

    @Test
    fun separatesPinsInTheSameSpotAndKeepsThemInTheFrame() {
        assertPoints(
            listOf(MapPoint(20.0, 20.0), MapPoint(59.999999999936335, 20.0)),
            spreadPins(listOf(MapPoint(5.0, 5.0), MapPoint(5.0, 5.0)), distance = 40.0, width = 300.0, height = 300.0),
        )
    }

    private companion object {
        const val TOLERANCE = 1e-9
    }
}
