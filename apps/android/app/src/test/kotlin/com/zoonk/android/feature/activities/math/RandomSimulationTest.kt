package com.zoonk.android.feature.activities.math

import com.zoonk.android.feature.activities.ActivityFixtures
import com.zoonk.android.feature.activities.hashSeed
import com.zoonk.api.ApiJson
import com.zoonk.api.models.PlayableLibraryStepAnyOfContentOneOf8Fields
import org.junit.Assert.assertEquals
import org.junit.Test
import com.zoonk.api.models.PlayableLibraryStepAnyOfContent.PlayableLibraryStepAnyOfContentOneOf8Value as RandomSimulationContent
import com.zoonk.api.models.PlayableLibraryStepAnyOfContentOneOf8Fields.PlayableLibraryStepAnyOfContentOneOf8FieldsOneOf1Value as SamplingFields
import com.zoonk.api.models.PlayableLibraryStepAnyOfContentOneOf8Fields.PlayableLibraryStepAnyOfContentOneOf8FieldsOneOfValue as ChanceFields

/** Expected values are what main's `chance.ts`, `sampling.ts` and core's chances return, from main's own seeds. */
class RandomSimulationTest {
    private fun fields(fixture: String) = (ActivityFixtures.content(fixture) as RandomSimulationContent).value.fields

    private fun seedOf(fields: PlayableLibraryStepAnyOfContentOneOf8Fields) =
        seedText(ApiJson.encodeToJsonElement(PlayableLibraryStepAnyOfContentOneOf8Fields.serializer(), fields))

    private fun model(json: String) = ApiJson.decodeFromString(ChanceModel.serializer(), json)

    private fun population(json: String) = ApiJson.decodeFromString(Population.serializer(), json)

    private val chance = (fields("randomSimulation") as ChanceFields).value
    private val sampling = (fields("randomSimulation.sampling") as SamplingFields).value

    @Test
    fun theSeedTextIsWhatTheWebStringifies() {
        assertEquals(
            """{"hitLabel":"Exactly 5 heads","mode":"chance","model":{"hit":{"comparison":"exactly","value":5},"kind":"binomial","probability":0.5,"trials":10},"runs":1000,"trialLabel":"10 flips"}""",
            seedOf(fields("randomSimulation")),
        )
        assertEquals(574_654_392L, hashSeed(seedOf(fields("randomSimulation"))))
        assertEquals(
            """{"mean":1e+21,"negative":-2e+22,"sd":100000000000000000000,"shortest":123456789012345680000,"small":1e-7}""",
            seedText(ApiJson.parseToJsonElement("""{"mean":1e21,"negative":-2e22,"sd":1e20,"shortest":123456789012345678901,"small":0.0000001}""")),
        )
        assertEquals(1_429_737_586L, hashSeed("${seedOf(fields("randomSimulation.sampling"))}:100"))
    }

    @Test
    fun aChanceRunDrawsTheWebsOutcomes() {
        val outcomes = runSimulation(chance.model, runs = 1000, seed = 574_654_392L)

        assertEquals(listOf(5, 6, 5, 2, 7, 7, 5, 5, 6, 5), outcomes.take(10))
        assertEquals(241, outcomes.count { isHit(chance.model, it) })
        assertEquals(
            listOf(0 to 1, 1 to 13, 2 to 54, 3 to 119, 4 to 224, 5 to 241, 6 to 199, 7 to 109, 8 to 33, 9 to 5, 10 to 2),
            outcomeCounts(outcomes),
        )
        assertEquals(
            listOf(3.0 to 0.6666666666666666, 6.0 to 0.3333333333333333, 7.0 to 0.42857142857142855),
            runningShare(outcomes.take(7).map { it == 5 }, 3),
        )
        assertEquals(0.24609375000000025, hitProbability(chance.model), 1e-12)
    }

    @Test
    fun diceAndBirthdaysDrawTheWebsOutcomes() {
        val dice = model("""{"kind":"diceSum","count":2,"sides":6,"hit":{"comparison":"atLeast","value":10}}""")
        val birthdays = model("""{"kind":"sharedBirthday","people":23,"days":365}""")

        assertEquals(listOf(6, 6, 9, 3, 7, 8, 7, 6), runSimulation(dice, runs = 8, seed = 7))
        assertEquals(listOf(1, 1, 0, 0, 1, 0, 1, 0), runSimulation(birthdays, runs = 8, seed = 7))
    }

    @Test
    fun aSamplingRunDrawsTheWebsPolls() {
        val polls = simulateSamples(sampling.population, runs = 200, seed = 1_429_737_586L, size = 100)
        val domain = samplingDomain(sampling.population, 100)

        assertEquals(listOf(0.48, 0.51, 0.48, 0.58, 0.53), polls.take(5))
        assertEquals(0.4 to 0.58, middleRange(polls))
        assertEquals(0.325, domain.start, 1e-12)
        assertEquals(0.675, domain.endInclusive, 1e-12)
        assertEquals(listOf(11, 16, 29), histogram(polls, domain).subList(12, 15).map { it.count })
        assertEquals(listOf(0, 1, 0), listOf(0.1, 0.005, 0.03).map { valueDigits(it, sampling.population) })
    }

    @Test
    fun bigPollsAndMeansDrawFromTheNormalCurveAsTheWebDoes() {
        val share = population("""{"kind":"proportion","proportion":0.3}""")
        val heights = population("""{"kind":"mean","mean":170,"sd":10}""")

        assertEquals(listOf(0.3, 0.308, 0.2894, 0.3014, 0.3028), simulateSamples(share, runs = 5, seed = 7, size = 5000))
        assertEquals(
            listOf(169.98390603123534, 172.44968413038748, 166.72003711330498, 170.4067068676869, 170.88450502700312),
            simulateSamples(heights, runs = 5, seed = 7, size = 25),
        )
        assertEquals(listOf(0, 1, 2), listOf(2.5, 0.5, 0.1).map { valueDigits(it, heights) })
    }
}
