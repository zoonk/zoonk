package com.zoonk.android.feature.activities.reasoning

import org.junit.Assert.assertEquals
import org.junit.Test

/** Main's `map-viewport.test.ts`, with the values its `fitViewport` and `spreadPins` return. */
class MapViewportTest {
    @Test fun translatedCourseMatchesEitherTheSourceOrTranslatedName() {
        for (references in listOf("Onde fica a América do Norte?", "Onde fica North America?")) {
            org.junit.Assert.assertTrue(isMapLabelNamed(references, "North America", "América do Norte"))
        }
        org.junit.Assert.assertFalse(isMapLabelNamed("Onde fica a Europa?", "North America", "América do Norte"))
    }

    private val named = MapLabelSpot(MapPoint(160.0, 120.0), 80.0, 12.0, 0.0, true, true, listOf(MapPoint(160.0, 120.0)))

    @Test fun namedLabelBoxesClearEveryPinBox() {
        val pins = listOf(MapPoint(160.0, 120.0), MapPoint(190.0, 155.0))
        val spot =
            placeMapLabels(
                listOf(named.copy(positions = listOf(MapPoint(150.0, 120.0), MapPoint(170.0, 120.0)))),
                pins,
                320.0,
                240.0,
            )[0]!!
        pins.forEach { pin -> org.junit.Assert.assertTrue(kotlin.math.abs(spot.x - pin.x) >= 60 || kotlin.math.abs(spot.y - pin.y) >= 26) }
    }

    @Test fun threeNamedRegionsPackWithoutBoxOverlap() {
        val labels = List(3) { named.copy(center = MapPoint(100.0, 20.0), width = 110.0, street = false) }
        val spots = placeMapLabels(labels, emptyList(), 200.0, 40.0)
        org.junit.Assert.assertTrue(spots.all { it != null })
        for (i in spots.indices) {
            for (j in i + 1 until spots.size) {
                org.junit.Assert.assertTrue(
                    kotlin.math.abs(spots[i]!!.x - spots[j]!!.x) >= 55 * (spots[i]!!.scale + spots[j]!!.scale) ||
                        kotlin.math.abs(spots[i]!!.y - spots[j]!!.y) >= 6 * (spots[i]!!.scale + spots[j]!!.scale),
                )
            }
        }
    }

    @Test fun questionNamesOutrankAnswerOnlyNamesAtMinimumSize() {
        val choice = named.copy(center = MapPoint(50.0, 10.0), width = 110.0, street = false)
        val spots = placeMapLabels(listOf(choice, choice.copy(question = true)), emptyList(), 100.0, 20.0)
        org.junit.Assert.assertNull(spots[0])
        org.junit.Assert.assertNotNull(spots[1])
        org.junit.Assert.assertTrue(spots[1]!!.scale >= 0.8)
    }

    @Test fun namedStreetSurvivesItsOnlySpotBeingUnderAPin() {
        org.junit.Assert.assertNotNull(placeMapLabels(listOf(named), listOf(named.center), 320.0, 240.0)[0])
    }

    @Test fun twoNamedLabelsOnOneSegmentStayReadable() {
        val spots = placeMapLabels(listOf(named, named), emptyList(), 320.0, 240.0)
        org.junit.Assert.assertTrue(spots.all { it != null })
        org.junit.Assert.assertNotEquals(spots[0], spots[1])
    }

    @Test fun namedRegionSurvivesAPinAtItsSpot() {
        org.junit.Assert.assertNotNull(placeMapLabels(listOf(named.copy(street = false)), listOf(named.center), 320.0, 240.0)[0])
    }

    @Test
    fun namedStreetMovesOffItsPinBeforeAnOptionalLabel() {
        val labels =
            listOf(
                MapLabelSpot(MapPoint(138.0, 100.0), 80.0, 12.0, 0.0, false, false),
                MapLabelSpot(MapPoint(70.0, 100.0), 80.0, 12.0, 0.0, true, true, listOf(MapPoint(70.0, 100.0), MapPoint(138.0, 100.0))),
            )
        val spots = placeMapLabels(labels, listOf(MapPoint(70.0, 100.0)), 210.0, 200.0)
        org.junit.Assert.assertNotNull(spots[1])
        org.junit.Assert.assertTrue(spots[1]!!.x > 130)
        org.junit.Assert.assertNull(spots[0])
    }

    @Test
    fun droppedLabelFreesItsSpaceAndOneEdgeRuleKeepsWhatFits() {
        val labels =
            listOf(
                MapLabelSpot(MapPoint(100.0, 100.0), 500.0, 12.0, 0.0, false, false),
                MapLabelSpot(MapPoint(100.0, 100.0), 40.0, 12.0, 0.0, false, false),
                MapLabelSpot(MapPoint(12.0, 30.0), 20.0, 12.0, 0.0, false, false),
            )
        assertEquals(
            listOf(null, MapPoint(100.0, 100.0), MapPoint(12.0, 30.0)),
            placeMapLabels(labels, emptyList(), 210.0, 200.0).map {
                it?.center
            },
        )
    }

    @Test
    fun streetCanSlideFartherThanItsTextWidthIntoTheVisibleFrame() {
        val labels =
            listOf(
                MapLabelSpot(
                    MapPoint(70.0, 300.0),
                    80.0,
                    12.0,
                    90.0,
                    true,
                    false,
                    listOf(MapPoint(70.0, 50.0), MapPoint(70.0, 124.0), MapPoint(70.0, 300.0)),
                ),
            )
        val spots = placeMapLabels(labels, listOf(MapPoint(70.0, 190.0)), 210.0, 200.0)
        org.junit.Assert.assertNotNull(spots[0])
        org.junit.Assert.assertTrue(spots[0]!!.y < 130)
    }

    @Test
    fun hidesStreetWhenAvoidingItsPinWouldMoveItBeyondTheDrawnStreet() {
        val labels =
            listOf(MapLabelSpot(MapPoint(70.0, 100.0), 80.0, 12.0, 90.0, true, false, listOf(MapPoint(70.0, 50.0), MapPoint(70.0, 120.0))))
        val spots = placeMapLabels(labels, listOf(MapPoint(70.0, 100.0)), 210.0, 250.0)
        org.junit.Assert.assertNull(spots[0])
    }

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
