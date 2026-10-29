package com.zoonk.android.feature.player.language

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/** The cases come from main's tests of the same rules, so both platforms read text alike. */
class LanguageTextTest {
    private fun option(
        word: String,
        translation: String?,
    ) = WordBankOption(audioUrl = null, romanization = null, translation = translation, word = word)

    @Test
    fun aSentenceInQuotesLosesThemUnlessQuotesInsideWouldStandAlone() {
        assertEquals("hello there", stripWrappingQuotes("  \"hello there\"  "))
        assertEquals("hello there", stripWrappingQuotes("“hello there”"))
        assertEquals("\"hello there", stripWrappingQuotes("\"hello there"))
        assertEquals("He said \"wait\" and left.", stripWrappingQuotes("He said \"wait\" and left."))
        assertEquals("\"", stripWrappingQuotes("\""))
        assertEquals("It's ready", stripWrappingQuotes("'It's ready'"))
        assertEquals("It’s ready", stripWrappingQuotes("‘It’s ready’"))
        val quoted = "\"this\" should preserve quotes in the first and last \"words\""
        assertEquals(quoted, stripWrappingQuotes(quoted))
    }

    @Test
    fun wordsKeepTheirPunctuationAndTextWithoutSpacesSplitsAtWordBoundaries() {
        assertEquals(listOf("Yo", "veo", "un", "gato."), segmentWords("Yo veo un gato."))
        assertEquals(listOf("a", "b", "c"), segmentWords("a  b  c"))
        assertEquals(listOf("Comment", "allez-vous?"), segmentWords("Comment allez-vous ?"))
        assertEquals(listOf("Oui,", "je", "suis", "là!"), segmentWords("Oui , je suis là !"))
        assertEquals(listOf("gato-prueba"), segmentWords("gato-prueba"))
        assertEquals(listOf("l'heure"), segmentWords("l'heure"))
        assertEquals(listOf("¿Hola?"), segmentWords("¿Hola?"))
        assertEquals(listOf("猫"), segmentWords("猫"))
        assertEquals(emptyList<String>(), segmentWords(""))
        val japanese = segmentWords("あのきれいな花")
        assertTrue(japanese.toString(), japanese.size > 1 && japanese.joinToString("") == "あのきれいな花")
    }

    @Test
    fun theRomanizationHidesOnlyTheAnswersWholeWord() {
        assertNull(templateRomanization("o", null))
        assertEquals("okane o onegai shimasu.", templateRomanization(null, "okane o onegai shimasu."))
        assertEquals("okane ____ onegai shimasu.", templateRomanization("o", "okane o onegai shimasu."))
        assertEquals("____ okane onegai shimasu.", templateRomanization("o", "o okane onegai shimasu."))
        assertEquals("watashi wa ____.", templateRomanization("o", "watashi wa o."))
        assertEquals("____, sore wa ii desu.", templateRomanization("o", "o, sore wa ii desu."))
        assertEquals("____ o shimasu", templateRomanization("o", "o o shimasu"))
        assertEquals("say hello ____ now", templateRomanization("(world)", "say hello (world) now"))
        assertEquals("say ____ smith now", templateRomanization("mr.", "say mr. smith now"))
    }

    @Test
    fun readingHintsPairPromptWordsWithTheSentenceWordsTheyTranslate() {
        assertEquals(
            listOf(
                PromptWordHint("Oi,", "Hi"),
                PromptWordHint("como", "how"),
                PromptWordHint("você", "you"),
                PromptWordHint("está?", "are"),
            ),
            readingPromptHints(
                "Oi, como você está?",
                listOf(option("Hi,", "oi"), option("how", "como"), option("are", "são"), option("you?", "você")),
            ),
        )
        assertEquals(listOf(PromptWordHint("Olá!", "Hello")), readingPromptHints("Olá!", listOf(option("Hello!", "ola"))))
        assertEquals(
            listOf(PromptWordHint("um", "a"), PromptWordHint("um", "one")),
            readingPromptHints("um um", listOf(option("a", "um"), option("one", "um"))),
        )
        assertEquals(
            listOf(
                PromptWordHint("Tenha", "Have"),
                PromptWordHint("um", "a"),
                PromptWordHint("bom", "nice"),
                PromptWordHint("dia!", "day"),
            ),
            readingPromptHints(
                "Tenha um bom dia!",
                listOf(option("Have", "ter"), option("a", "um"), option("nice", "legal"), option("day!", "dia")),
            ),
        )
    }
}
