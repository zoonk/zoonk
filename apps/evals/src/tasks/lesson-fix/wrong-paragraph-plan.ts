import { type WriteLessonDraftParams } from "@zoonk/ai/tasks/lesson-writer";
import realLessons from "./real-lessons.json";

type LessonWriterInput = Omit<
  WriteLessonDraftParams,
  "analytics" | "model" | "reasoning" | "useFallback"
>;

const [recorded] = realLessons;

if (!recorded) {
  throw new Error("real-lessons.json lost its first lesson");
}

/** The production plan (8 Nov 2026) whose briefs cite art. 4º, § 1º of Lei 12.813/2013 for a rule in § 2º. */
export const WRONG_PARAGRAPH_PLAN = recorded.context as LessonWriterInput;

/** Arts. 3º to 5º as the Câmara's consolidated text states them (read 11 Nov 2026). */
export const LEI_12813_ARTICLES = `<page ref="S1:1" of="Lei nº 12.813/2013, Art. 3º">
Art. 3º Para os fins desta Lei, considera-se:
I - conflito de interesses: a situação gerada pelo confronto entre interesses públicos e privados, que possa comprometer o interesse coletivo ou influenciar, de maneira imprópria, o desempenho da função pública; e
II - informação privilegiada: a que diz respeito a assuntos sigilosos ou aquela relevante ao processo de decisão no âmbito do Poder Executivo federal que tenha repercussão econômica ou financeira e que não seja de amplo conhecimento público.
</page>
<page ref="S1:2" of="Lei nº 12.813/2013, Art. 4º">
Art. 4º O ocupante de cargo ou emprego no Poder Executivo federal deve agir de modo a prevenir ou a impedir possível conflito de interesses e a resguardar informação privilegiada.
§ 1º No caso de dúvida sobre como prevenir ou impedir situações que configurem conflito de interesses, o agente público deverá consultar a Comissão de Ética Pública, criada no âmbito do Poder Executivo federal, ou a Controladoria-Geral da União, conforme o disposto no parágrafo único do art. 8º desta Lei.
§ 2º A ocorrência de conflito de interesses independe da existência de lesão ao patrimônio público, bem como do recebimento de qualquer vantagem ou ganho pelo agente público ou por terceiro.
</page>
<page ref="S1:3" of="Lei nº 12.813/2013, Art. 5º">
Art. 5º Configura conflito de interesses no exercício de cargo ou emprego no âmbito do Poder Executivo federal:
I - divulgar ou fazer uso de informação privilegiada, em proveito próprio ou de terceiro, obtida em razão das atividades exercidas;
II - exercer atividade que implique a prestação de serviços ou a manutenção de relação de negócio com pessoa física ou jurídica que tenha interesse em decisão do agente público ou de colegiado do qual este participe;
III - exercer, direta ou indiretamente, atividade que em razão da sua natureza seja incompatível com as atribuições do cargo ou emprego, considerando-se como tal, inclusive, a atividade desenvolvida em áreas ou matérias correlatas;
IV - atuar, ainda que informalmente, como procurador, consultor, assessor ou intermediário de interesses privados nos órgãos ou entidades da administração pública direta ou indireta de qualquer dos Poderes da União, dos Estados, do Distrito Federal e dos Municípios;
V - praticar ato em benefício de interesse de pessoa jurídica de que participe o agente público, seu cônjuge, companheiro ou parentes, consanguíneos ou afins, em linha reta ou colateral, até o terceiro grau, e que possa ser por ele beneficiada ou influir em seus atos de gestão;
VI - receber presente de quem tenha interesse em decisão do agente público ou de colegiado do qual este participe fora dos limites e condições estabelecidos em regulamento; e
VII - prestar serviços, ainda que eventuais, a empresa cuja atividade seja controlada, fiscalizada ou regulada pelo ente ao qual o agente público está vinculado.
Parágrafo único. As situações que configuram conflito de interesses estabelecidas neste artigo aplicam-se aos ocupantes dos cargos ou empregos mencionados no art. 2º ainda que em gozo de licença ou em período de afastamento.
</page>`;

const PROVISION_CITATION = /\s*\((?:Lei nº|arts?\.)[^)]*\)/gu;

/** The same plan as a planner without the law's text now writes it: each rule by what it says. */
export const UNNUMBERED_PLAN: LessonWriterInput = {
  ...WRONG_PARAGRAPH_PLAN,
  spec: {
    ...WRONG_PARAGRAPH_PLAN.spec,
    screens: WRONG_PARAGRAPH_PLAN.spec.screens.map((screen) => ({
      ...screen,
      brief: screen.brief
        .replaceAll(PROVISION_CITATION, "")
        .replace("exigida pelo art. 20 da Lei nº 9.784/1999", "que a suspeição exige"),
    })),
  },
};
