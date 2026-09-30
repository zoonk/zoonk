import { type TestCase } from "@/lib/types";
import { type StatuteDrillParams } from "@zoonk/ai/tasks/v2/items/statute-drills";

type StatuteDrillsInput = Omit<StatuteDrillParams, "model" | "useFallback" | "reasoning">;

/**
 * Article texts are copied from the official sources in each case's `law.url`
 * (Sep 2026), without the site's editorial notes such as "(Redação dada pela
 * Emenda Constitucional nº 19, de 1998)". congress.gov blocks scripted reads,
 * so the Fifth Amendment comes from the National Archives transcript.
 */
const CF88 = {
  shortName: "CF/88",
  title: "Constituição da República Federativa do Brasil de 1988",
  url: "https://www.planalto.gov.br/ccivil_03/constituicao/constituicao.htm",
};

/** Cases run in this order, so a small `--limit` still covers Cebraspe and the generic mix. */
export const TEST_CASES: TestCase<unknown, StatuteDrillsInput>[] = [
  {
    expectations: `Cebraspe-style right/wrong statements in Brazilian Portuguese on article 5 of the Brazilian Constitution (caput and items II, III, XI and XLII). True statements repeat or faithfully paraphrase the given text; false ones change exactly one element, as Cebraspe does (for example "todos" to "quase todos", "durante o dia" to "a qualquer hora", "determinação judicial" to "determinação policial", "inafiançável" to "afiançável"), and their misconception names that trap. Check every statement against the given text, not memory, and that roughly half are false.`,
    id: "pt-cebraspe-cf88-art5-direitos-fundamentais",
    userInput: {
      articles: [
        {
          reference: "Art. 5º, caput",
          text: "Art. 5º Todos são iguais perante a lei, sem distinção de qualquer natureza, garantindo-se aos brasileiros e aos estrangeiros residentes no País a inviolabilidade do direito à vida, à liberdade, à igualdade, à segurança e à propriedade, nos termos seguintes:",
        },
        {
          reference: "Art. 5º, II",
          text: "II - ninguém será obrigado a fazer ou deixar de fazer alguma coisa senão em virtude de lei;",
        },
        {
          reference: "Art. 5º, III",
          text: "III - ninguém será submetido a tortura nem a tratamento desumano ou degradante;",
        },
        {
          reference: "Art. 5º, XI",
          text: "XI - a casa é asilo inviolável do indivíduo, ninguém nela podendo penetrar sem consentimento do morador, salvo em caso de flagrante delito ou desastre, ou para prestar socorro, ou, durante o dia, por determinação judicial;",
        },
        {
          reference: "Art. 5º, XLII",
          text: "XLII - a prática do racismo constitui crime inafiançável e imprescritível, sujeito à pena de reclusão, nos termos da lei;",
        },
      ],
      count: 6,
      language: "pt",
      law: CF88,
      style: "cebraspe",
    },
  },
  {
    expectations: `A generic mix of drills in US English on GDPR Article 33 (paragraphs 1, 2 and 5): true/false statements, fill-in-the-blank passages copied word for word with one load-bearing gap (such as "72 hours", "controller", "processor", "without undue delay") and 4-option multiple choice on the literal text. False statements and wrong options change exactly one element (the 72-hour deadline, who notifies whom, the "unlikely to result in a risk" exception, the duty to document every breach). Check every drill against the given text.`,
    id: "en-generic-gdpr-art33-breach-notification",
    userInput: {
      articles: [
        {
          reference: "Article 33(1)",
          text: "1. In the case of a personal data breach, the controller shall without undue delay and, where feasible, not later than 72 hours after having become aware of it, notify the personal data breach to the supervisory authority competent in accordance with Article 55, unless the personal data breach is unlikely to result in a risk to the rights and freedoms of natural persons. Where the notification to the supervisory authority is not made within 72 hours, it shall be accompanied by reasons for the delay.",
        },
        {
          reference: "Article 33(2)",
          text: "2. The processor shall notify the controller without undue delay after becoming aware of a personal data breach.",
        },
        {
          reference: "Article 33(5)",
          text: "5. The controller shall document any personal data breaches, comprising the facts relating to the personal data breach, its effects and the remedial action taken. That documentation shall enable the supervisory authority to verify compliance with this Article.",
        },
      ],
      count: 6,
      language: "en",
      law: {
        shortName: "GDPR",
        title: "Regulation (EU) 2016/679 (General Data Protection Regulation)",
        url: "https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:32016R0679",
      },
      style: "generic",
    },
  },
  {
    expectations: `FGV-style multiple choice in Brazilian Portuguese on the deadlines for taking office (posse) and starting work (exercício) in Law 8.112/1990. Each item has 4 options, one reproducing the text and the others changing one element: thirty days for posse counted from the publication of the appointment, fifteen days for exercício counted from the posse, the appointment made void or the servant dismissed when a deadline is missed. Check every option against the given text.`,
    id: "pt-fgv-lei8112-posse-exercicio",
    userInput: {
      articles: [
        {
          reference: "Art. 13, § 1º",
          text: "§ 1º A posse ocorrerá no prazo de trinta dias contados da publicação do ato de provimento.",
        },
        {
          reference: "Art. 13, § 6º",
          text: "§ 6º Será tornado sem efeito o ato de provimento se a posse não ocorrer no prazo previsto no § 1º deste artigo.",
        },
        {
          reference: "Art. 15, § 1º",
          text: "§ 1º É de quinze dias o prazo para o servidor empossado em cargo público entrar em exercício, contados da data da posse.",
        },
        {
          reference: "Art. 15, § 2º",
          text: "§ 2º O servidor será exonerado do cargo ou será tornado sem efeito o ato de sua designação para função de confiança, se não entrar em exercício nos prazos previstos neste artigo, observado o disposto no art. 18.",
        },
      ],
      count: 4,
      language: "pt",
      law: {
        shortName: "Lei nº 8.112/1990",
        title:
          "Lei nº 8.112, de 11 de dezembro de 1990 (regime jurídico dos servidores públicos civis da União)",
        url: "https://www.planalto.gov.br/ccivil_03/leis/l8112cons.htm",
      },
      style: "fgv",
    },
  },
  {
    expectations: `Cebraspe-style right/wrong statements in Brazilian Portuguese on article 37 of the Brazilian Constitution: the five principles in the caput, access by public examination (II), validity of up to two years extendable once for an equal period (III), priority of approved candidates (IV) and the nullity of acts that ignore II and III (§ 2º). False statements change one element (such as "prorrogável uma vez" to "prorrogável duas vezes", "de até dois anos" to "de dois anos", dropping the exception for commissioned posts). Check every statement against the given text.`,
    id: "pt-cebraspe-cf88-art37-concurso-publico",
    userInput: {
      articles: [
        {
          reference: "Art. 37, caput",
          text: "Art. 37. A administração pública direta e indireta de qualquer dos Poderes da União, dos Estados, do Distrito Federal e dos Municípios obedecerá aos princípios de legalidade, impessoalidade, moralidade, publicidade e eficiência e, também, ao seguinte:",
        },
        {
          reference: "Art. 37, II",
          text: "II - a investidura em cargo ou emprego público depende de aprovação prévia em concurso público de provas ou de provas e títulos, de acordo com a natureza e a complexidade do cargo ou emprego, na forma prevista em lei, ressalvadas as nomeações para cargo em comissão declarado em lei de livre nomeação e exoneração;",
        },
        {
          reference: "Art. 37, III",
          text: "III - o prazo de validade do concurso público será de até dois anos, prorrogável uma vez, por igual período;",
        },
        {
          reference: "Art. 37, IV",
          text: "IV - durante o prazo improrrogável previsto no edital de convocação, aquele aprovado em concurso público de provas ou de provas e títulos será convocado com prioridade sobre novos concursados para assumir cargo ou emprego, na carreira;",
        },
        {
          reference: "Art. 37, § 2º",
          text: "§ 2º A não observância do disposto nos incisos II e III implicará a nulidade do ato e a punição da autoridade responsável, nos termos da lei.",
        },
      ],
      count: 6,
      language: "pt",
      law: CF88,
      style: "cebraspe",
    },
  },
  {
    expectations: `A generic mix of drills in Brazilian Portuguese on embezzlement (peculato) in article 312 of the Brazilian Penal Code: the caput and its penalty, § 1º (peculato-furto), § 2º (culpable form) and § 3º (repairing the damage). Traps should change one element, such as "reclusão" to "detenção", "dois a doze anos" to another range, "precede à sentença irrecorrível" to "posterior", "extingue a punibilidade" to "reduz de metade a pena". Fill-in-the-blank passages must be copied word for word.`,
    id: "pt-generic-codigo-penal-art312-peculato",
    userInput: {
      articles: [
        {
          reference: "Art. 312, caput",
          text: "Art. 312 - Apropriar-se o funcionário público de dinheiro, valor ou qualquer outro bem móvel, público ou particular, de que tem a posse em razão do cargo, ou desviá-lo, em proveito próprio ou alheio: Pena - reclusão, de dois a doze anos, e multa.",
        },
        {
          reference: "Art. 312, § 1º",
          text: "§ 1º - Aplica-se a mesma pena, se o funcionário público, embora não tendo a posse do dinheiro, valor ou bem, o subtrai, ou concorre para que seja subtraído, em proveito próprio ou alheio, valendo-se de facilidade que lhe proporciona a qualidade de funcionário.",
        },
        {
          reference: "Art. 312, § 2º",
          text: "§ 2º - Se o funcionário concorre culposamente para o crime de outrem: Pena - detenção, de três meses a um ano.",
        },
        {
          reference: "Art. 312, § 3º",
          text: "§ 3º - No caso do parágrafo anterior, a reparação do dano, se precede à sentença irrecorrível, extingue a punibilidade; se lhe é posterior, reduz de metade a pena imposta.",
        },
      ],
      count: 5,
      language: "pt",
      law: {
        shortName: "Código Penal",
        title: "Decreto-Lei nº 2.848, de 7 de dezembro de 1940 (Código Penal)",
        url: "https://www.planalto.gov.br/ccivil_03/decreto-lei/del2848compilado.htm",
      },
      style: "generic",
    },
  },
  {
    expectations: `A generic mix of drills in US English on the Fifth Amendment to the US Constitution: grand jury indictment for capital or infamous crimes with the military exception, double jeopardy, self-incrimination "in any criminal case", due process and just compensation for takings "for public use". Traps change one element (such as "in time of War or public danger" dropped or swapped, "civil case" for "criminal case", "fair market value" for "just compensation"). Check every drill against the given text.`,
    id: "en-generic-us-constitution-fifth-amendment",
    userInput: {
      articles: [
        {
          reference: "Amendment V",
          text: "No person shall be held to answer for a capital, or otherwise infamous crime, unless on a presentment or indictment of a Grand Jury, except in cases arising in the land or naval forces, or in the Militia, when in actual service in time of War or public danger; nor shall any person be subject for the same offence to be twice put in jeopardy of life or limb; nor shall be compelled in any criminal case to be a witness against himself, nor be deprived of life, liberty, or property, without due process of law; nor shall private property be taken for public use, without just compensation.",
        },
      ],
      count: 5,
      language: "en",
      law: {
        shortName: "US Constitution",
        title: "Constitution of the United States",
        url: "https://www.archives.gov/founding-docs/bill-of-rights-transcript",
      },
      style: "generic",
    },
  },
];
