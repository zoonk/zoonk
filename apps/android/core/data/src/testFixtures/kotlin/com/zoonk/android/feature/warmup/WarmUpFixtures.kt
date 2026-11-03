package com.zoonk.android.feature.warmup

import com.zoonk.api.models.WarmUpDeck
import com.zoonk.api.models.WarmUpDeckCardsInner
import com.zoonk.api.models.WarmUpDeckCardsInnerOptionsInner
import java.util.UUID

const val WARM_UP_ID = "019a482c-6a00-7000-8000-000000000001"

fun beekeepingDeck(): WarmUpDeck =
    WarmUpDeck(
        cards =
            listOf(
                card(
                    "smoke",
                    "Why do beekeepers puff smoke into a hive before opening it?",
                    listOf("To put the bees to sleep", "To hide the bees' alarm scent", "To warm up the hive"),
                    right = 1,
                    "Smoke masks the alarm scent that guard bees release, so fewer bees join in. Many also fill up on honey, which makes them calmer.",
                ),
                card(
                    "eyes",
                    "How many eyes does a honey bee have?",
                    listOf("2", "5", "8"),
                    right = 1,
                    "Five: two big compound eyes on the sides of the head, and three small simple eyes on top that mostly sense light.",
                ),
                card(
                    "lifespan",
                    "Who lives longer?",
                    listOf("A summer worker", "A queen"),
                    right = 1,
                    "The queen, by far: she can live for several years. A worker born in summer lives only a few weeks, worn out by foraging.",
                ),
            ),
        id = UUID.fromString(WARM_UP_ID),
        language = "en",
    )

private fun card(
    id: String,
    question: String,
    options: List<String>,
    right: Int,
    reveal: String,
) = WarmUpDeckCardsInner(
    id = id,
    options =
        options.mapIndexed {
            index,
            text,
            ->
            WarmUpDeckCardsInnerOptionsInner(correct = index == right, id = "$id-$index", text = text)
        },
    question = question,
    reveal = reveal,
)
