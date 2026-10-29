package com.zoonk.android.feature.activities

/**
 * `@zoonk/utils/seeded-random`: the Park-Miller generator and main's text seed, so a shuffle lays
 * cards out in the same order on every platform.
 */
fun seededRandom(seed: Long): () -> Double {
    var state = Math.abs(seed) % (MODULUS - 1) + 1
    return {
        state = state * MULTIPLIER % MODULUS
        (state - 1).toDouble() / (MODULUS - 1)
    }
}

fun hashSeed(text: String): Long = text.indices.fold(0L) { hash, index -> (hash * HASH_MULTIPLIER + text.codePointAt(index)) % MODULUS }

fun <T> seededShuffle(
    items: List<T>,
    seedText: String,
): List<T> {
    val random = seededRandom(hashSeed(seedText))
    return items.map { it to random() }.sortedBy { it.second }.map { it.first }
}

private const val MODULUS = 2_147_483_647L
private const val MULTIPLIER = 48_271L
private const val HASH_MULTIPLIER = 31L
