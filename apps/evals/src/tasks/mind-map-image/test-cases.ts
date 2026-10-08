import { type MindMapStructure } from "@zoonk/ai/tasks/v2/mind-maps/schema";

export type MindMapImageInput = {
  /** Names the saved image file. */
  caseId: string;
  language: string;
  structure: MindMapStructure;
};

const EXPECTATIONS =
  "A square hand-drawn mind map on a plain white background: the title in a central cloud, the central idea near the top, every branch numbered in its own color with its sentence, bullets and a small sketch, the comparison table when there is one and the summary line at the bottom. Every word is lettered exactly as the structure says, legible at full size; sketches carry no words.";

function branch(
  title: string,
  explanation: string,
  points: string[],
  drawing: string,
): MindMapStructure["branches"][number] {
  return { drawing, explanation, points, title };
}

/**
 * Four real chapters' maps as Haiku 5.5 wrote them from the lessons (7 Oct 2026): fixed structures,
 * so the comparison isolates the image model. Dense Portuguese with accents, math notation (f(x),
 * x², ÷, R$), a three-column comparison and a six-branch English map.
 */
export const TEST_CASES = [
  {
    expectations: EXPECTATIONS,
    id: "pt-solar-energy",
    userInput: {
      caseId: "pt-solar-energy",
      language: "pt",
      structure: {
        branches: [
          branch(
            "Células fotovoltaicas",
            "A luz solar movimenta cargas elétricas e gera corrente contínua.",
            ["A luz põe cargas em movimento", "Corrente elétrica acende uma lâmpada"],
            "a solar cell",
          ),
          branch(
            "Painel fotovoltaico",
            "Reúne células para gerarem eletricidade juntas, sob proteção.",
            ["Reúne células como ladrilhos", "Protege contra chuva e sujeira"],
            "a solar panel",
          ),
          branch(
            "Inversor",
            "Adapta a corrente contínua em alternada para a edificação.",
            ["Painéis produzem corrente contínua", "Instalação predial usa corrente alternada"],
            "an inverter box",
          ),
          branch(
            "Componentes do sistema",
            "Sustentam, conduzem, protegem e medem a energia do sistema.",
            ["Estrutura fixa painéis no telhado", "Medidor registra a eletricidade"],
            "an electric meter",
          ),
        ],
        centralIdea: "A luz do sol vira eletricidade por células, painéis, inversor e componentes.",
        comparison: {
          columns: [
            { name: "Painel fotovoltaico", points: ["Recebe luz do sol", "Fornece eletricidade"] },
            { name: "Aquecedor solar", points: ["Recebe calor do sol", "Entrega água quente"] },
          ],
          title: "Uso da energia solar",
        },
        summary:
          "Células no painel transformam luz em corrente contínua, que o inversor adapta para a edificação.",
        title: "Da luz à eletricidade",
      },
    },
  },
  {
    expectations: EXPECTATIONS,
    id: "pt-functions",
    userInput: {
      caseId: "pt-functions",
      language: "pt",
      structure: {
        branches: [
          branch(
            "Entrada e saída",
            "A entrada é o que você informa; a saída é a resposta.",
            ["Tamanho do lanche leva ao preço", "Cada entrada, uma única saída"],
            "a vending machine",
          ),
          branch(
            "Notação f(x)",
            "f(x) indica a saída quando a entrada é x.",
            ["f(4) é a saída para entrada 4", "Coloque a entrada no lugar de x"],
            "a box with an arrow in and an arrow out",
          ),
          branch(
            "Taxa constante",
            "A saída cresce sempre a mesma quantidade por unidade.",
            ["Taxa: mudança na saída ÷ mudança na entrada", "Reta mais íngreme sobe mais"],
            "a ramp",
          ),
          branch(
            "Valor inicial",
            "O preço quando a entrada é zero, antes de qualquer uso.",
            ["Assinatura R$ 12,00; uso R$ 3,00", "O valor inicial muda o preço"],
            "a membership card",
          ),
          branch(
            "Parábola",
            "Uma altura que sobe e desce muda de forma curva.",
            ["x² na regra: função quadrática", "a positivo abre para cima"],
            "an arc of water from a fountain",
          ),
        ],
        centralIdea:
          "Uma função dá uma única saída para cada entrada, e o padrão de variação revela sua forma.",
        comparison: {
          columns: [
            {
              name: "Função linear",
              points: ["Mesma mudança a cada unidade", "Gráfico é uma reta"],
            },
            {
              name: "Função quadrática",
              points: ["Mudança não é sempre igual", "Gráfico é uma parábola"],
            },
          ],
          title: "Variação constante ou quadrática",
        },
        summary:
          "Funções ligam entradas a saídas únicas; o ritmo de variação, constante ou quadrático, mostra o padrão.",
        title: "Funções e relações entre variáveis",
      },
    },
  },
  {
    expectations: EXPECTATIONS,
    id: "pt-user-research",
    userInput: {
      caseId: "pt-user-research",
      language: "pt",
      structure: {
        branches: [
          branch(
            "Pergunta de pesquisa",
            "Orienta o que descobrir, sem escolher a causa antes de ouvir.",
            ["Retire reações ainda não confirmadas", "Indique ação e momento a investigar"],
            "a magnifying glass",
          ),
          branch(
            "Participantes",
            "Convide quem viveu a tarefa, mesmo sem concluí-la.",
            ["Critério é o que a pessoa viveu", "Inclua tentativas interrompidas"],
            "a blank name badge",
          ),
          branch(
            "Roteiro de entrevista",
            "Um caminho curto de perguntas abertas, sem suposições.",
            ["Comece por um episódio real", "Evite presumir dificuldade ou etapa"],
            "a trail of footprints",
          ),
          branch(
            "Registro responsável",
            "Anote ações e falas com permissão e sem dados desnecessários.",
            ["Use código no lugar do nome", "Combine acesso e data de exclusão"],
            "a locked filing cabinet",
          ),
        ],
        centralIdea:
          "Investigue uma dúvida sem presumir a causa, com método, participantes e registros adequados.",
        comparison: {
          columns: [
            { name: "Observação", points: ["Mostra o que a pessoa faz", "Vê a ação na rotina"] },
            { name: "Entrevista", points: ["Ouve a versão da pessoa", "Não substitui ver a ação"] },
            {
              name: "Teste de usabilidade",
              points: ["Verifica se conclui a tarefa", "Mostra onde avança ou trava"],
            },
          ],
          title: "Três métodos de pesquisa",
        },
        summary:
          "Pergunte com foco em ação e momento, escolha método e participantes certos, e registre com responsabilidade.",
        title: "Planejamento de pesquisa com usuários",
      },
    },
  },
  {
    expectations: EXPECTATIONS,
    id: "en-cell-structure",
    userInput: {
      caseId: "en-cell-structure",
      language: "en",
      structure: {
        branches: [
          branch(
            "Cell as unit",
            "The smallest unit that can carry out life's work.",
            ["A pond organism is one cell", "You are made of many cells"],
            "a round cell",
          ),
          branch(
            "Prokaryotic vs eukaryotic",
            "Cells differ in how they organize their DNA.",
            ["Bacteria: DNA sits in cytoplasm", "Animal cells: DNA sits in a nucleus"],
            "a rod-shaped bacterium",
          ),
          branch(
            "Protein builders",
            "Parts that build proteins and prepare them for delivery.",
            ["The nucleus keeps the recipe", "Ribosomes build; Golgi packages"],
            "a small conveyor belt",
          ),
          branch(
            "Recycling and support",
            "Parts that clean up worn-out material and shape the cell.",
            ["Lysosomes break down worn-out parts", "Cytoskeleton fibers act as tracks"],
            "a recycling bin",
          ),
          branch(
            "Plant cell structures",
            "Features that set plant cells apart from other cells.",
            ["A cell wall frames the membrane", "Chloroplasts capture sunlight for sugar"],
            "a green leaf",
          ),
          branch(
            "Reading cell scale",
            "Estimating real cell size from a microscope photo.",
            ["Magnification changes photo size, not cell", "Count bar lengths, then multiply"],
            "a ruler",
          ),
        ],
        centralIdea: "Cell structures do jobs that build, maintain and power living things.",
        comparison: {
          columns: [
            { name: "Bacterial cell", points: ["Prokaryotic cell", "DNA sits in cytoplasm"] },
            { name: "Animal cell", points: ["Eukaryotic cell", "DNA sits in a nucleus"] },
          ],
          title: "Bacterial and animal cells",
        },
        summary:
          "Cell structures build, maintain and identify cells; a scale bar shows their true size.",
        title: "Cell structure and work",
      },
    },
  },
] satisfies { expectations: string; id: string; userInput: MindMapImageInput }[];
