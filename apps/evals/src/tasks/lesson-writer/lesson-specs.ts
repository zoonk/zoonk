import { type LessonSpec } from "@zoonk/ai/tasks/v2/lesson-spec/rules";

/**
 * Lesson specs from the lesson-spec eval (26 Sep 2026), so the writer is
 * judged on the plans production makes: Sol's plans, and Opus's where they
 * use an activity the player can draw.
 */
export const LESSON_SPECS = {
  "en-particle-in-a-box-advanced": {
    canDo: "Derive and use the quantized energy levels of a particle in a box",
    description:
      "Solve the time-independent Schrödinger equation for an infinite 1D well, show how the boundary conditions force discrete energies E_n = n²h²/(8mL²), and use them to predict real spectra.",
    estimatedMinutes: 5,
    screens: [
      {
        activityTemplate: null,
        brief:
          "Show vials of CdSe quantum dots made of the same material but different sizes: the 2 nm dots glow blue and the 6 nm dots glow red. Ask the learner to guess, without scoring, why size alone would set the color of emitted light.",
        kind: "hook",
        skills: [],
        visual:
          "A row of glowing vials from blue to red, each labeled with its dot diameter from about 2 nm to 6 nm.",
      },
      {
        activityTemplate: null,
        brief:
          "Set up the model: V(x) = 0 for 0 < x < L and V = ∞ outside, so ψ = 0 outside the box. Continuity of ψ then gives the boundary conditions ψ(0) = 0 and ψ(L) = 0, just like a guitar string pinned at both ends.",
        kind: "explanation",
        skills: [0],
        visual:
          "Potential diagram: a flat floor from 0 to L with infinitely tall walls, with ψ = 0 marked outside and pinned points at x = 0 and x = L.",
      },
      {
        activityTemplate: null,
        brief:
          "Inside the box the equation becomes −(ħ²/2m)ψ'' = Eψ, which is ψ'' = −k²ψ with k = √(2mE)/ħ. Its general solution is ψ(x) = A sin kx + B cos kx, the same oscillation as a vibrating string.",
        kind: "explanation",
        skills: [0],
        visual: null,
      },
      {
        activityTemplate: null,
        brief:
          "The learner applies ψ(0) = 0 to ψ = A sin kx + B cos kx and chooses which term survives. Include the tempting wrong answer 'the cos term survives because cos is maximal at 0', and give feedback that cos 0 = 1 forces B = 0.",
        kind: "check",
        skills: [0],
        visual: null,
      },
      {
        activityTemplate: null,
        brief:
          "Work through ψ(L) = 0: A sin kL = 0, and A ≠ 0 (otherwise there is no particle), so kL = nπ. Exclude n = 0 because ψ would vanish, and exclude negative n because they give the same state up to a sign. Substitute k_n = nπ/L into E = ħ²k²/2m to get E_n = n²π²ħ²/(2mL²) = n²h²/(8mL²).",
        kind: "workedExample",
        skills: [0, 1],
        visual:
          "A step-by-step derivation column with the key condition sin kL = 0 highlighted and the allowed k_n shown as evenly spaced points on a k axis.",
      },
      {
        activityTemplate: null,
        brief:
          "Ask why the lowest state is n = 1 rather than n = 0. Include the tempting wrong answer 'n = 0 is the ground state with zero energy', and explain that n = 0 gives ψ ≡ 0, so the particle can never be at rest and has a zero-point energy E_1 > 0.",
        kind: "check",
        skills: [0, 1],
        visual: null,
      },
      {
        activityTemplate: null,
        brief:
          "Normalizing ∫|ψ|²dx = 1 over the box gives A = √(2/L), so ψ_n(x) = √(2/L) sin(nπx/L). These are standing waves: ψ_n fits n half-wavelengths into L and has n − 1 interior nodes, and the level spacing grows as E_n ∝ n².",
        kind: "explanation",
        skills: [2],
        visual:
          "Energy ladder with levels at 1, 4, 9 and 16 times E_1, with ψ_1 to ψ_4 drawn on each rung and their nodes marked.",
      },
      {
        activityTemplate: "sliderGraph",
        brief:
          "The learner moves a slider for n from 1 to 6 and watches ψ_n(x) and |ψ_n|² redraw, with E_n/E_1 displayed. Then ask how many nodes ψ_4 has (3) and what E_3/E_1 is (9, not 3).",
        kind: "activity",
        skills: [1, 2],
        visual:
          "Graph of ψ_n(x) and |ψ_n(x)|² on 0 to L with an n slider and a live readout of E_n/E_1.",
      },
      {
        activityTemplate: null,
        brief:
          "Treat an electron in a box with L = 1.0 nm: E_1 = h²/(8m_eL²) ≈ 6.0 × 10⁻²⁰ J ≈ 0.38 eV, and E_2 = 4E_1 ≈ 1.50 eV. The 2 → 1 photon has ΔE = 3E_1 ≈ 1.13 eV, so λ = hc/ΔE ≈ 1100 nm, in the near infrared.",
        kind: "workedExample",
        skills: [1],
        visual: null,
      },
      {
        activityTemplate: null,
        brief:
          "The learner calculates E_1 for the same electron in a box half as wide, with L = 0.5 nm, and picks the answer ≈ 1.5 eV. Include the tempting wrong answer ≈ 0.75 eV, which assumes E ∝ 1/L instead of 1/L².",
        kind: "check",
        skills: [1],
        visual: null,
      },
      {
        activityTemplate: null,
        brief:
          "Return to the quantum dots and model the confinement energy as a particle in a box, E ∝ 1/L². The learner predicts by what factor the confinement contribution grows from a 6 nm dot to a 3 nm dot (a factor of 4) and explains why smaller dots emit bluer light.",
        kind: "application",
        skills: [0, 1, 2],
        visual:
          "Side-by-side energy ladders for a 6 nm and a 3 nm box drawn to scale, with the emitted photon arrows colored red and blue.",
      },
    ],
    skills: [
      {
        description:
          "Impose the conditions ψ(0) = ψ(L) = 0 on the general solution inside an infinite well to show that only discrete wavenumbers k_n = nπ/L are allowed.",
        example:
          "From ψ = A sin kx + B cos kx, ψ(0) = 0 gives B = 0, and ψ(L) = 0 gives kL = nπ with n = 1, 2, 3, …",
        hard: true,
        name: "Apply boundary conditions to an infinite well",
        topic: "Infinite square well",
        useCase:
          "Setting up any confined quantum system, from electrons in nanowires to modes in optical cavities.",
      },
      {
        description:
          "Combine the quantized wavenumbers with E = ħ²k²/2m to get E_n = n²h²/(8mL²) and use it to compute level energies and transition photons.",
        example:
          "An electron in a 1.0 nm box has E_1 ≈ 0.38 eV, and its 2 → 1 transition emits a photon near 1100 nm.",
        hard: true,
        name: "Calculate particle-in-a-box energy levels",
        topic: "Energy quantization",
        useCase:
          "Estimating absorption and emission wavelengths of quantum dots, dyes and nanostructures.",
      },
      {
        description:
          "The stationary states ψ_n = √(2/L) sin(nπx/L) are normalized standing waves with n − 1 interior nodes, and the lowest energy is never zero.",
        example: "ψ_3 fits three half-wavelengths in the box, has 2 nodes, and has energy 9E_1.",
        hard: false,
        name: "Describe the stationary states of a box",
        topic: "Stationary states",
        useCase:
          "Reading probability densities and node patterns in molecular orbitals and semiconductor devices.",
      },
    ],
    supportMode: "explanationFirst",
    title: "Particle in a box",
  },
  "en-percent-change-beginner": {
    canDo: "Calculate how much a price changed in percent",
    description:
      "Learn to work out how much a price or salary went up or down in percent, and why a 50% drop needs a 100% rise to recover.",
    estimatedMinutes: 5,
    screens: [
      {
        activityTemplate: null,
        brief:
          "Pose a quick guess that doesn't count: a $100 sneaker drops 50% in a sale, then its price rises 50%. Is it back to $100? Options: yes, more than $100, less than $100. Don't reveal the answer yet; say we'll find out.",
        kind: "hook",
        skills: [],
        visual:
          "A price tag reading $100, an arrow down labeled -50%, then an arrow up labeled +50% ending at a tag with a question mark.",
      },
      {
        activityTemplate: null,
        brief:
          "Start concrete: a movie ticket went from $20 to $25. The change is new minus old: $25 - $20 = $5. Explain that $5 alone doesn't tell us if that's a big jump, because $5 on a $20 ticket feels bigger than $5 on a $500 TV.",
        kind: "explanation",
        skills: [0],
        visual:
          "Two bars side by side: a $20 bar and a $25 bar, with the extra $5 piece highlighted on top.",
      },
      {
        activityTemplate: null,
        brief:
          "Introduce percent change: compare the change to the ORIGINAL price, like asking 'how many cents of change per dollar we started with?' Show the recipe piece by piece: change ÷ original × 100. Stress that 'original' means the starting value, before the change.",
        kind: "explanation",
        skills: [0],
        visual:
          "The formula 'percent change = (new − old) ÷ old × 100' with each piece labeled: 'the change', 'the starting value', 'turn into percent'.",
      },
      {
        activityTemplate: null,
        brief:
          "Work the ticket example step by step: change = 25 - 20 = 5; divide by original 20: 5 ÷ 20 = 0.25; times 100 = 25%. So the price went up 25%.",
        kind: "workedExample",
        skills: [0],
        visual: null,
      },
      {
        activityTemplate: null,
        brief:
          "Learner calculates: a salary rose from $2,000 to $2,300 a month. What's the percent increase? Correct: 15%. Include the tempting wrong answer 13% (dividing $300 by the new salary $2,300).",
        kind: "check",
        skills: [0],
        visual: null,
      },
      {
        activityTemplate: null,
        brief:
          "Show a decrease: a jacket goes from $80 to $60. Change = 60 - 80 = -20; -20 ÷ 80 = -0.25; × 100 = -25%. A minus sign means the price went down 25%. Point out we still divide by the starting price, $80.",
        kind: "workedExample",
        skills: [0],
        visual:
          "A bar for $80 with the top $20 section shaded and crossed out, leaving $60, labeled '20 out of 80 = 25% off'.",
      },
      {
        activityTemplate: null,
        brief:
          "Learner calculates: a video game drops from $50 to $40. What's the percent change? Correct: a 20% decrease. Include the tempting wrong answer 25% (dividing $10 by the new price $40).",
        kind: "check",
        skills: [0],
        visual: null,
      },
      {
        activityTemplate: null,
        brief:
          "Return to the hook: $100 drops 50% to $50. A 50% rise from $50 is only $25, giving $75, not $100. To get back, the price must rise $50 on a base of $50: 50 ÷ 50 = 100%. The starting value changed, so the same dollar amount is a bigger percent.",
        kind: "explanation",
        skills: [1],
        visual:
          "Before-and-after: left, $100 bar with half removed (−50% of 100); right, $50 bar doubled back to $100 (+100% of 50).",
      },
      {
        activityTemplate: "estimateReveal",
        brief:
          "A stock falls 20%, from $100 to $80. Learner commits to an estimate of the percent rise needed to get back to $100, then sees the real answer: $20 ÷ $80 = 25%. Many will guess 20%; show how far off they were and why.",
        kind: "activity",
        skills: [0, 1],
        visual: null,
      },
      {
        activityTemplate: null,
        brief:
          "Your monthly pay of $3,000 is cut 10% during a slow season, then raised 10% later. Learner calculates each step ($3,000 → $2,700 → $2,970), finds they're still $30 short, and works out the percent rise actually needed from $2,700 to get back to $3,000 (about 11.1%).",
        kind: "application",
        skills: [0, 1],
        visual: null,
      },
    ],
    skills: [
      {
        description:
          "Find how much a value went up or down compared to where it started, as a percent.",
        example: "A ticket going from $20 to $25 is a (25 − 20) ÷ 20 × 100 = 25% increase.",
        hard: true,
        name: "Calculate a percent change",
        topic: "Percent change",
        useCase: "Checking how much your rent, salary or grocery prices really went up or down.",
      },
      {
        description:
          "A drop and the rise needed to undo it are different percents, because the rise is measured from the smaller, lower value.",
        example: "After $100 drops 50% to $50, it needs a 100% rise to get back to $100.",
        hard: false,
        name: "Explain why drops and recoveries differ",
        topic: "Reversing a percent change",
        useCase: "Understanding why a stock or pay cut takes a bigger percent rise to recover.",
      },
    ],
    supportMode: "explanationFirst",
    title: "Percent change",
  },
  "pt-eletron-nucleo-overview": {
    canDo: "Explicar por que o elétron não cai no núcleo",
    description:
      "Mostra por que a atração pelo núcleo não concentra o elétron ali e como isso permite que os átomos permaneçam estáveis.",
    estimatedMinutes: 3,
    screens: [
      {
        activityTemplate: null,
        brief:
          "O núcleo atrai o elétron. Peça um palpite, sem valer ponto: por que o elétron não termina espremido no núcleo?",
        kind: "hook",
        skills: [],
        visual:
          "Núcleo no centro e elétron representado por uma região ao redor, com uma seta indicando a atração.",
      },
      {
        activityTemplate: null,
        brief:
          "Troque a imagem de uma bolinha dando voltas pela de uma região onde o elétron pode ser encontrado. Essa região é chamada de nuvem eletrônica; ela não é uma trilha nem uma nuvem de matéria comum.",
        kind: "explanation",
        skills: [0],
        visual:
          "Lado a lado: órbita de bolinha riscada e região difusa ao redor do núcleo identificada como nuvem eletrônica.",
      },
      {
        activityTemplate: null,
        brief:
          "Explique que a atração puxa o elétron para perto, mas concentrar sua nuvem num espaço minúsculo exige mais energia. Compare com apertar algo que resiste a ficar confinado, sem sugerir que exista uma mola dentro do átomo.",
        kind: "explanation",
        skills: [0],
        visual:
          "A mesma nuvem em dois tamanhos: espalhada ao redor do núcleo e muito comprimida junto a ele, com indicação de que comprimir exige energia.",
      },
      {
        activityTemplate: null,
        brief:
          "Pergunte por que a atração do núcleo não basta para deixar o elétron espremido nele. Inclua a resposta tentadora, mas errada, de que o elétron escapa porque gira rápido como um planeta.",
        kind: "check",
        skills: [0],
        visual: null,
      },
      {
        activityTemplate: null,
        brief:
          "Mostre que o arranjo mais estável combina a atração pelo núcleo com o custo de confinar demais o elétron. Mesmo no estado de menor energia, a nuvem ocupa uma região ao redor do núcleo.",
        kind: "explanation",
        skills: [0],
        visual:
          "Núcleo cercado por uma nuvem de tamanho definido, contrastada com um ponto minúsculo no centro marcado como concentração excessiva.",
      },
      {
        activityTemplate: null,
        brief:
          "Peça ao aprendiz que identifique o erro na frase: «O elétron não cai porque o núcleo o empurra para longe». Inclua como alternativa correta que o núcleo atrai o elétron, mas concentrá-lo demais exige energia.",
        kind: "check",
        skills: [0],
        visual: null,
      },
      {
        activityTemplate: null,
        brief:
          "Um celular é feito de átomos que não desabam sobre seus núcleos. Peça ao aprendiz que explique isso a alguém que imagina os elétrons como bolinhas prestes a cair, usando as ideias de atração, nuvem e custo de confinamento.",
        kind: "application",
        skills: [0],
        visual: null,
      },
    ],
    skills: [
      {
        description:
          "O elétron é atraído pelo núcleo, mas concentrá-lo demais exige energia; por isso, seu arranjo mais estável ocupa uma região ao redor do núcleo.",
        example:
          "Mesmo no estado de menor energia de um átomo, o elétron não fica espremido num ponto no núcleo.",
        hard: false,
        name: "Explicar por que o elétron não cai no núcleo",
        topic: "Estabilidade do átomo",
        useCase:
          "Entender por que os átomos que formam objetos cotidianos, como um celular, permanecem estáveis.",
      },
    ],
    supportMode: "explanationFirst",
    title: "Por que o elétron não cai no núcleo",
  },
  "pt-regra-de-tres-intermediate": {
    canDo: "Resolver regras de três simples e compostas com grandezas diretas e inversas",
    description:
      "Use a relação entre grandezas para calcular prazos quando mudam a quantidade de trabalho e a capacidade de produção.",
    estimatedMinutes: 5,
    screens: [
      {
        activityTemplate: null,
        brief:
          "Uma gráfica recebe um pedido maior e contrata mais gente para ajudar. O prazo vai aumentar ou diminuir? Peça um palpite sem avaliar a resposta.",
        kind: "hook",
        skills: [],
        visual: null,
      },
      {
        activityTemplate: null,
        brief:
          "Peça que o aluno escolha o que acontece com o prazo em dois casos: dobrar a equipe para fazer o mesmo pedido; dobrar o pedido com a mesma equipe. Inclua a opção tentadora de que o prazo dobra nos dois casos.",
        kind: "check",
        skills: [0],
        visual: null,
      },
      {
        activityTemplate: null,
        brief:
          "Compare os dois casos: para o mesmo pedido, mais trabalhadores significam menos tempo, uma relação inversa; com a mesma equipe, mais trabalho significa mais tempo, uma relação direta. Destaque que é preciso dizer o que permanece fixo.",
        kind: "explanation",
        skills: [0],
        visual:
          "Dois pares de cenas da gráfica: pedido fixo com equipes de tamanhos diferentes; equipe fixa com pedidos de tamanhos diferentes.",
      },
      {
        activityTemplate: null,
        brief:
          "Apresente a regra de três simples como um cálculo com duas grandezas e uma condição fixa. Para um mesmo muro, se a equipe dobra, o tempo cai pela metade; a relação é inversa.",
        kind: "explanation",
        skills: [1],
        visual: null,
      },
      {
        activityTemplate: null,
        brief:
          "Resolva passo a passo: 4 trabalhadores terminam um muro em 6 dias; 8 trabalhadores, no mesmo ritmo, levam quantos dias? Mantenha fixa a obra, monte 6 × 4/8 e obtenha 3 dias.",
        kind: "workedExample",
        skills: [0, 1],
        visual: null,
      },
      {
        activityTemplate: null,
        brief:
          "Peça que calcule: 2 impressoras fazem 80 etiquetas em 2 horas; quanto tempo levam para fazer 200 etiquetas, mantendo as mesmas impressoras? A relação é direta e a resposta é 5 horas; inclua 0,8 hora como erro tentador de inverter a razão.",
        kind: "check",
        skills: [0, 1],
        visual: null,
      },
      {
        activityTemplate: null,
        brief:
          "Agora duas grandezas mudam: a quantidade de etiquetas e o número de impressoras. Para achar o novo tempo, multiplique o tempo inicial pela razão entre as quantidades de etiquetas e pela razão inversa entre os números de impressoras.",
        kind: "explanation",
        skills: [2],
        visual: null,
      },
      {
        activityTemplate: null,
        brief:
          "Resolva passo a passo: 3 impressoras fazem 240 etiquetas em 4 horas; quanto tempo 5 impressoras levam para fazer 600? Mostre o efeito direto das etiquetas e o inverso das impressoras: 4 × (600/240) × (3/5) = 6 horas.",
        kind: "workedExample",
        skills: [0, 2],
        visual: null,
      },
      {
        activityTemplate: null,
        brief:
          "Peça que calcule: 2 máquinas fazem 120 peças em 3 horas; quanto tempo 4 máquinas levam para fazer 320 peças? A resposta é 4 horas; inclua 16 horas como erro tentador de tratar o número de máquinas como diretamente proporcional ao tempo.",
        kind: "check",
        skills: [0, 2],
        visual: null,
      },
      {
        activityTemplate: null,
        brief:
          "Uma padaria assa 120 pães em 3 horas usando 2 fornos iguais. Peça que o aluno calcule quanto tempo levará para assar 300 pães com 3 fornos, no mesmo ritmo: 5 horas.",
        kind: "application",
        skills: [0, 1, 2],
        visual: null,
      },
    ],
    skills: [
      {
        description:
          "Determine se duas grandezas variam no mesmo sentido ou em sentidos opostos, mantendo as demais condições fixas.",
        example: "Para o mesmo pedido, dobrar a equipe reduz o prazo pela metade.",
        hard: false,
        name: "Identificar grandezas direta e inversamente proporcionais",
        topic: "Grandezas proporcionais",
        useCase: "Prever como uma mudança na equipe ou no tamanho de um pedido afeta um prazo.",
      },
      {
        description:
          "Calcule um valor desconhecido a partir de duas grandezas diretamente ou inversamente proporcionais.",
        example: "Se 4 pessoas terminam um muro em 6 dias, 8 pessoas levam 3 dias.",
        hard: true,
        name: "Resolver regra de três simples",
        topic: "Regra de três simples",
        useCase: "Estimar o tempo de um serviço quando muda a equipe ou a quantidade produzida.",
      },
      {
        description:
          "Calcule um valor desconhecido quando duas ou mais grandezas mudam, considerando o sentido de cada relação.",
        example:
          "Se 3 impressoras fazem 240 etiquetas em 4 horas, 5 impressoras fazem 600 em 6 horas.",
        hard: true,
        name: "Resolver regra de três composta",
        topic: "Regra de três composta",
        useCase:
          "Planejar prazos quando mudam ao mesmo tempo o tamanho do pedido e os recursos disponíveis.",
      },
    ],
    supportMode: "questionFirst",
    title: "Regra de três simples e composta",
  },
} satisfies Record<string, LessonSpec>;
