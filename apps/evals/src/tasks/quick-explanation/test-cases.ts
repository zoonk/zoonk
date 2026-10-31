import { type TestCase } from "@/lib/types";
import { type QuickExplanationParams } from "@zoonk/ai/tasks/explain/quick-explanation";

type QuickExplanationInput = Pick<QuickExplanationParams, "language" | "question">;

export const TEST_CASES: TestCase<unknown, QuickExplanationInput>[] = [
  {
    expectations: `Explanation in Brazilian Portuguese of compound interest (juros sobre juros), so growth speeds up over time. Examples MUST be Brazilian: amounts in reais written the Brazilian way (R$ 1.000,00 or R$ 1.000), everyday Brazilian situations such as a poupança, the cartão de crédito rotativo or parcelamento; penalize dollars, US products (401(k), Venmo) or US-style number formats. No formula; must not recommend a specific investment.`,
    id: "pt-juros-compostos-contexto-local",
    userInput: { language: "pt", question: "como funcionam os juros compostos?" },
  },
  {
    expectations: `Explanation in Brazilian Portuguese of how the US credit score works: the question sets the place, so it stays in the United States (a FICO score from about 300 to 850, the three credit bureaus, paying on time and using little of the card's limit), with amounts in dollars. Penalize swapping it for Brazil's Serasa score as if it were the same system; a one-line comparison is fine. No personal financial advice.`,
    id: "pt-credit-score-eua-lugar-da-pergunta",
    userInput: { language: "pt", question: "Como funciona o credit score nos Estados Unidos?" },
  },
  {
    expectations: `Explanation in US English of how taxes come out of a paycheck: federal income tax withheld based on the W-4, Social Security and Medicare (FICA), and state income tax in most states; the refund or bill at tax time settles the difference. Examples in dollars with US situations. Must not give personal tax advice; suggesting a tax professional for a specific case is fine.`,
    id: "en-paycheck-taxes-local",
    userInput: { language: "en", question: "why is my paycheck smaller than my salary?" },
  },
  {
    expectations: `Microwaves make water molecules in food jiggle, and that motion is heat. Penalize the common myth that microwaves cook "from the inside out" and any claim that they make food radioactive. A good practical example: why a cup of water heats but an empty plate barely warms, or why food heats unevenly.`,
    id: "en-microwave",
    userInput: { language: "en", question: "How does a microwave heat food?" },
  },
  {
    expectations: `Explanation in Brazilian Portuguese: inflation is a general, continuous rise in prices that makes money buy less. A good story uses everyday Brazilian examples (supermarket, bus fare) and can mention that a little inflation is normal. No formulas.`,
    id: "pt-inflacao",
    userInput: { language: "pt", question: "o que é inflação?" },
  },
  {
    expectations: `Sunlight scatters off air molecules, and blue light scatters much more than red (Rayleigh scattering); our eyes and the sun's spectrum explain why it looks blue and not violet. Sunsets are red because light crosses more air. Penalize "the sky reflects the ocean".`,
    id: "en-sky-blue",
    userInput: { language: "en", question: "why is the sky blue" },
  },
  {
    expectations: `Explanation in Brazilian Portuguese of how a vaccine trains the immune system with a harmless piece or version of a germ, so the body recognizes it later. Must be accurate and must not give personal medical advice; saying to talk to a health professional about a specific case is fine. Penalize claims that vaccines give the disease or are 100% effective.`,
    id: "pt-vacina",
    userInput: { language: "pt", question: "Como funciona uma vacina?" },
  },
  {
    expectations: `Compound interest means earning interest on past interest, so growth speeds up over time. The question doesn't ask for a formula, so none should appear; numbers in an example are fine. Must not recommend a specific investment.`,
    id: "en-compound-interest",
    userInput: { language: "en", question: "I never understood how compound interest works" },
  },
  {
    expectations: `Explanation in Brazilian Portuguese. The question asks for the quadratic formula (fórmula de Bhaskara), so showing it is allowed and expected, but each part must be explained in words, with what the discriminant (delta) tells you about the number of solutions and one worked example with small numbers.`,
    id: "pt-bhaskara-formula-pedida",
    userInput: { language: "pt", question: "me explica a fórmula de Bhaskara" },
  },
  {
    expectations: `Explanation in natural Italian, speaking to the reader as "tu", of the 730: the dichiarazione dei redditi for employees and pensioners, which compares the IRPEF the employer withheld from each busta paga during the year with the tax actually owed after detrazioni such as spese mediche (the scontrino parlante with the codice fiscale), interest on a mutuo or school costs. The difference comes back as a rimborso in the busta paga or pension, usually in summer depending on when it's filed, or is withheld if more is owed. Examples MUST be Italian: amounts in euro written the Italian way (1.000 €, 150,50 €), the Agenzia delle Entrate and its 730 precompilato, a CAF or a commercialista. Penalize dollars, US forms and dates (W-4, Tax Day, IRS), Brazil's Imposto de Renda or US-style number formats. Must not give personal tax advice; suggesting a CAF or a commercialista for a specific case is fine.`,
    id: "it-730-rimborso-busta-paga",
    userInput: {
      language: "it",
      question:
        "ma il 730 a cosa serve di preciso? perché d'estate mi arriva un rimborso in busta paga",
    },
  },
  {
    expectations: `Explanation in natural Japanese (kanji and kana, no romaji), です・ます without stiff keigo and without あなた, of 年末調整: during the year the employer withholds income tax from each paycheck (源泉徴収) as an estimate; at the end of the year it recalculates the year's tax with the forms the employee hands in (扶養控除等申告書, 保険料控除申告書 and the like, for deductions such as 生命保険料控除 or 配偶者控除) and refunds the excess or collects the shortfall, usually in the December or January paycheck. A good answer adds that some cases still need a 確定申告, such as 医療費控除 or the first year of 住宅ローン控除. Examples MUST be Japanese: amounts in yen written the Japanese way (3万円, 30,000円), the 源泉徴収票, the company's 総務 or 経理. Penalize dollars, US forms and dates (W-4, Tax Day, IRS), Brazil's Imposto de Renda, or saying the refund comes from the 税務署 in spring. Must not give personal tax advice; suggesting the company's 担当者, the 税務署 or a 税理士 for a specific case is fine.`,
    id: "ja-nenmatsu-chosei",
    userInput: {
      language: "ja",
      question: "年末調整って結局なにしてるの？毎年会社に書類出してるけどよくわかってない",
    },
  },
  {
    expectations: `Explanation in natural Korean (Hangul, no romanization), 해요체 without 당신, of 연말정산: during the year the company withholds income tax from each month's pay (원천징수) using the 간이세액표, and early the next year it recalculates the year's actual tax with the employee's 소득공제 and 세액공제 (신용카드 사용액, 의료비, 교육비, 월세, 연금저축 and the like), mostly gathered through 홈택스's 연말정산 간소화 서비스. When more was withheld than owed the difference comes back ("13월의 월급"); when less, the rest is taken from the pay, usually with the February or March pay. Examples MUST be Korean: amounts in won written the Korean way (30만 원, 300,000원), the company's 인사팀 or 회계팀, 국세청. Penalize dollars, US forms and dates (W-4, Tax Day, IRS), a December settlement, Brazil's Imposto de Renda or US-style number formats. Must not give personal tax advice; suggesting the company's 담당자, 국세청 상담 or a 세무사 for a specific case is fine.`,
    id: "ko-yeonmal-jeongsan",
    userInput: { language: "ko", question: "연말정산 하면 왜 누구는 돈 돌려받고 누구는 토해내요?" },
  },
  {
    expectations: `Explanation in natural Turkish, speaking to the reader as "sen", of KDV (katma değer vergisi): every business in the chain adds KDV to what it sells and deducts the KDV it paid on its own purchases, paying the difference to the state, so each step is taxed only on the value it adds and the final customer carries the whole tax through the price. Shelf prices in Türkiye already include KDV ("KDV dahil"), unlike US sales tax added at the register; the general rate is 20%, with lower rates for some goods, and the answer writes percentages the Turkish way (%20). The question was typed without Turkish letters, but the answer MUST use them (ç, ğ, ı, İ, ö, ş, ü). Examples MUST be Turkish: amounts in lira written the Turkish way (1.250,50 TL or ₺1.250,50), a market fişi, bread from the fırın or a purchase in taksit. Penalize dollars, US sales tax at the register, Brazil's ICMS, US-style number formats, or claims that the market pays KDV out of its own pocket or that the customer pays it separately to the state.`,
    id: "tr-kdv-market-fisi",
    userInput: {
      language: "tr",
      question: "kdv tam olarak ne? market fisinde yazan kdvyi aslinda kim oduyor",
    },
  },
  {
    expectations: `Explanation in natural Polish, speaking to the reader as "ty", of BLIK: you generate a one-time 6-digit code in your bank's app, valid for about 2 minutes; the shop or ATM sends the code with the amount to the BLIK system, which knows which bank's app issued it, and that app asks you to confirm the payment (often with a PIN). Only after that does the money move, so the shop never sees your card or account number and the code can't be used again. The question was typed without Polish letters, but the answer MUST use them (ą, ć, ę, ł, ń, ó, ś, ź, ż). Examples MUST be Polish: amounts in złoty written the Polish way (49,99 zł, 12 500 zł), paying in an online shop, taking cash from an ATM without a card or a przelew na telefon to split a bill with friends. Penalize dollars, Venmo, Zelle or Brazil's Pix as the example, US-style number formats, or claims that the 6 digits are a card number or a permanent password. Must not give financial advice.`,
    id: "pl-blik-kod",
    userInput: {
      language: "pl",
      question: "jak dziala blik? skad sklep wie ze to ja place jak podaje tylko 6 cyfr",
    },
  },
];
