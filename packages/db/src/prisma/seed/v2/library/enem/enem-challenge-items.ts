import { t } from "../../_utils/localize";
import { bankOption } from "../content";
import { type SeedItem } from "../types";

/**
 * Phase challenge questions on ENEM's subjects, in the exam's format. With the course's other items, every phase
 * on a seeded learner's plan has enough questions for its challenge, on any day of the plan.
 */
export const enemChallengeItems: SeedItem[] = [
  {
    content: {
      context: t(
        "A city places its buildings on a Cartesian plane, with distances in kilometers. A cell tower stands at the point (2, 3), and its signal reaches every place up to 5 km away from it.",
        "Uma prefeitura localiza seus prédios em um plano cartesiano, com distâncias em quilômetros. Uma antena de celular fica no ponto (2, 3), e seu sinal alcança todos os lugares a até 5 km dela.",
      ),
      options: [
        bankOption(
          t("The home at (6, 5)", "A casa no ponto (6, 5)"),
          t(
            "Its distance to the tower is √(4² + 2²) = √20, about 4.5 km, so it's inside the 5 km circle.",
            "A distância até a antena é √(4² + 2²) = √20, cerca de 4,5 km, então ela fica dentro do círculo de 5 km.",
          ),
        ),
        bankOption(
          t("The home at (6, 7)", "A casa no ponto (6, 7)"),
          t(
            "Each gap is 4 km, but the distance is √(4² + 4²) = √32, about 5.7 km: outside the signal.",
            "Cada diferença é de 4 km, mas a distância é √(4² + 4²) = √32, cerca de 5,7 km: fora do sinal.",
          ),
          t(
            "Treats the coverage as a square, checking each coordinate on its own",
            "Trata a cobertura como um quadrado, conferindo cada coordenada separadamente",
          ),
        ),
        bankOption(
          t("The home at (−3, 0)", "A casa no ponto (−3, 0)"),
          t(
            "It's 3 km from the origin, but √(5² + 3²) = √34, about 5.8 km, from the tower.",
            "Ela está a 3 km da origem, mas a √(5² + 3²) = √34, cerca de 5,8 km, da antena.",
          ),
          t(
            "Measured the distance from the origin instead of from the tower",
            "Mediu a distância a partir da origem em vez da antena",
          ),
        ),
        bankOption(
          t("The home at (−2, −3)", "A casa no ponto (−2, −3)"),
          t(
            "The circle is (x − 2)² + (y − 3)² ≤ 25. This home gives 16 + 36 = 52, far outside.",
            "O círculo é (x − 2)² + (y − 3)² ≤ 25. Essa casa dá 16 + 36 = 52, bem fora.",
          ),
          t(
            "Flipped the signs of the center's coordinates in the circle's equation",
            "Trocou os sinais das coordenadas do centro na equação da circunferência",
          ),
        ),
        bankOption(
          t("The home at (7, 0)", "A casa no ponto (7, 0)"),
          t(
            "The horizontal gap is exactly 5 km, but there's also a vertical gap of 3 km, so the distance is about 5.8 km.",
            "A diferença horizontal é exatamente 5 km, mas também há uma diferença vertical de 3 km, então a distância é cerca de 5,8 km.",
          ),
          t("Checked only the horizontal distance", "Conferiu só a distância horizontal"),
        ),
      ],
      question: t(
        "Which of these homes gets the tower's signal?",
        "Qual destas casas recebe o sinal da antena?",
      ),
    },
    difficulty: -1,
    exam: "enem",
    format: "multipleChoice",
    key: "circle-tower-coverage",
    skill: "cartesian-circles",
  },
  {
    content: {
      context: t(
        "An architect models the edge of a circular fountain in a square with the equation x² + y² − 6x + 4y − 12 = 0, with lengths in meters.",
        "Um arquiteto representa a borda de um chafariz circular em uma praça pela equação x² + y² − 6x + 4y − 12 = 0, com medidas em metros.",
      ),
      options: [
        bankOption(
          t("Center (3, −2) and radius 5 m", "Centro (3, −2) e raio 5 m"),
          t(
            "Completing the squares gives (x − 3)² + (y + 2)² = 9 + 4 + 12 = 25, so the radius is √25.",
            "Completando quadrados, fica (x − 3)² + (y + 2)² = 9 + 4 + 12 = 25, então o raio é √25.",
          ),
        ),
        bankOption(
          t("Center (−3, 2) and radius 5 m", "Centro (−3, 2) e raio 5 m"),
          t(
            "In (x − a)² + (y − b)², the center is (a, b): (x − 3) means a = 3, and (y + 2) means b = −2.",
            "Em (x − a)² + (y − b)², o centro é (a, b): (x − 3) dá a = 3, e (y + 2) dá b = −2.",
          ),
          t(
            "Flipped the signs of the center's coordinates",
            "Trocou os sinais das coordenadas do centro",
          ),
        ),
        bankOption(
          t("Center (3, −2) and radius 25 m", "Centro (3, −2) e raio 25 m"),
          t(
            "25 is the radius squared. The radius is its square root.",
            "25 é o raio ao quadrado. O raio é a raiz quadrada dele.",
          ),
          t("Took the radius squared as the radius", "Tomou o quadrado do raio como o raio"),
        ),
        bankOption(
          t("Center (3, −2) and radius 2√3 m", "Centro (3, −2) e raio 2√3 m"),
          t(
            "The 12 isn't the whole radius squared: completing the squares adds 9 and 4 to it.",
            "O 12 não é todo o quadrado do raio: completar os quadrados soma 9 e 4 a ele.",
          ),
          t(
            "Took the constant term as the radius squared without completing the squares",
            "Tomou o termo independente como o quadrado do raio sem completar quadrados",
          ),
        ),
        bankOption(
          t("Center (−6, 4) and radius 12 m", "Centro (−6, 4) e raio 12 m"),
          t(
            "The coefficients of x and y are −2a and −2b, not the center itself, and 12 isn't the radius.",
            "Os coeficientes de x e de y valem −2a e −2b, não são o próprio centro, e 12 não é o raio.",
          ),
          t(
            "Read the equation's coefficients as the center and the radius",
            "Leu os coeficientes da equação como o centro e o raio",
          ),
        ),
      ],
      question: t(
        "What are the center and the radius of the fountain's edge?",
        "Quais são o centro e o raio da borda do chafariz?",
      ),
    },
    difficulty: 0,
    exam: "enem",
    format: "multipleChoice",
    key: "circle-fountain-equation",
    skill: "cartesian-circles",
  },
  {
    content: {
      context: t(
        "A designer draws a wheel on a Cartesian plane in centimeters. Its center is at (4, 3), and it rests on the x-axis, touching it at a single point.",
        "Um designer desenha uma roda em um plano cartesiano, em centímetros. O centro dela fica em (4, 3), e ela está apoiada sobre o eixo x, tocando-o em um único ponto.",
      ),
      options: [
        bankOption(
          t("(x − 4)² + (y − 3)² = 9", "(x − 4)² + (y − 3)² = 9"),
          t(
            "Touching the x-axis means the radius is the center's height above it, 3 cm, and 3² = 9.",
            "Tocar o eixo x significa que o raio é a altura do centro acima dele, 3 cm, e 3² = 9.",
          ),
        ),
        bankOption(
          t("(x − 4)² + (y − 3)² = 16", "(x − 4)² + (y − 3)² = 16"),
          t(
            "4 cm is the distance to the y-axis. The wheel rests on the x-axis, so the height counts.",
            "4 cm é a distância até o eixo y. A roda está apoiada no eixo x, então o que conta é a altura.",
          ),
          t(
            "Took the distance to the y-axis as the radius",
            "Tomou a distância até o eixo y como o raio",
          ),
        ),
        bankOption(
          t("(x − 4)² + (y − 3)² = 3", "(x − 4)² + (y − 3)² = 3"),
          t(
            "The right side of the equation is the radius squared: 3² = 9.",
            "O lado direito da equação é o raio ao quadrado: 3² = 9.",
          ),
          t("Forgot to square the radius", "Esqueceu de elevar o raio ao quadrado"),
        ),
        bankOption(
          t("(x + 4)² + (y + 3)² = 9", "(x + 4)² + (y + 3)² = 9"),
          t(
            "That circle is centered at (−4, −3). A center at (4, 3) gives (x − 4) and (y − 3).",
            "Essa circunferência tem centro em (−4, −3). Um centro em (4, 3) dá (x − 4) e (y − 3).",
          ),
          t(
            "Flipped the signs of the center's coordinates",
            "Trocou os sinais das coordenadas do centro",
          ),
        ),
        bankOption(
          t("(x − 4)² + (y − 3)² = 25", "(x − 4)² + (y − 3)² = 25"),
          t(
            "5 cm is the distance from the center to the origin, but the wheel touches the x-axis, not the origin.",
            "5 cm é a distância do centro até a origem, mas a roda toca o eixo x, não a origem.",
          ),
          t("Measured the radius from the origin", "Mediu o raio a partir da origem"),
        ),
      ],
      question: t(
        "What is the equation of the wheel's edge?",
        "Qual é a equação da borda da roda?",
      ),
    },
    difficulty: 1,
    exam: "enem",
    format: "multipleChoice",
    key: "circle-wheel-tangent",
    skill: "cartesian-circles",
  },
  {
    content: {
      context: t(
        "On a farm, two center-pivot irrigation systems water circular areas. On a Cartesian plane in meters, the first pivot is at (0, 0) and waters up to 300 m away; the second is at (800, 600) and waters up to 400 m away. The farmer wants to plant another crop in the dry strip between the two watered areas, along the line joining the pivots.",
        "Em uma fazenda, dois pivôs centrais de irrigação molham áreas circulares. Em um plano cartesiano em metros, o primeiro pivô está em (0, 0) e molha até 300 m de distância; o segundo está em (800, 600) e molha até 400 m de distância. O fazendeiro quer plantar outra cultura na faixa seca entre as duas áreas irrigadas, ao longo da reta que liga os pivôs.",
      ),
      options: [
        bankOption(
          t("300 m", "300 m"),
          t(
            "The pivots are √(800² + 600²) = 1,000 m apart. Take away both radii: 1,000 − 300 − 400.",
            "Os pivôs estão a √(800² + 600²) = 1.000 m um do outro. Tire os dois raios: 1.000 − 300 − 400.",
          ),
        ),
        bankOption(
          t("1,000 m", "1.000 m"),
          t(
            "That's the distance between the pivots. Each watered circle covers part of it.",
            "Essa é a distância entre os pivôs. Cada círculo irrigado cobre uma parte dela.",
          ),
          t(
            "Gave the distance between the centers instead of between the edges",
            "Deu a distância entre os centros em vez da distância entre as bordas",
          ),
        ),
        bankOption(
          t("700 m", "700 m"),
          t(
            "700 m is what the two circles cover together along the line. The dry strip is what's left.",
            "700 m é o que os dois círculos cobrem juntos ao longo da reta. A faixa seca é o que sobra.",
          ),
          t("Answered with the sum of the radii", "Respondeu com a soma dos raios"),
        ),
        bankOption(
          t("600 m", "600 m"),
          t(
            "Both circles reach into the gap, so both radii come off the 1,000 m.",
            "Os dois círculos avançam sobre o espaço entre os pivôs, então os dois raios saem dos 1.000 m.",
          ),
          t("Subtracted only one of the radii", "Subtraiu só um dos raios"),
        ),
        bankOption(
          t("1,700 m", "1.700 m"),
          t(
            "The watered areas shrink the gap between the pivots; adding the radii makes it bigger.",
            "As áreas irrigadas diminuem o espaço entre os pivôs; somar os raios o aumentaria.",
          ),
          t(
            "Added the radii to the distance instead of subtracting them",
            "Somou os raios à distância em vez de subtraí-los",
          ),
        ),
      ],
      question: t(
        "What is the shortest distance between the edges of the two watered areas?",
        "Qual é a menor distância entre as bordas das duas áreas irrigadas?",
      ),
    },
    difficulty: 1,
    exam: "enem",
    format: "multipleChoice",
    key: "circle-irrigation-pivots",
    skill: "cartesian-circles",
  },
  {
    content: {
      context: t(
        "In a garden laid out on a Cartesian plane in meters, a sprinkler at the point (1, 2) wets a circular area. The edge of that area just reaches a tree at the point (4, 6).",
        "Em um jardim representado em um plano cartesiano em metros, um aspersor no ponto (1, 2) molha uma área circular. A borda dessa área alcança exatamente uma árvore no ponto (4, 6).",
      ),
      options: [
        bankOption(
          t("75 m²", "75 m²"),
          t(
            "The radius is √(3² + 4²) = 5 m, and the area is π × r² ≈ 3 × 25.",
            "O raio é √(3² + 4²) = 5 m, e a área é π × r² ≈ 3 × 25.",
          ),
        ),
        bankOption(
          t("30 m²", "30 m²"),
          t(
            "2 × π × r gives the length of the edge, not the area inside it.",
            "2 × π × r dá o comprimento da borda, não a área dentro dela.",
          ),
          t(
            "Calculated the circumference instead of the area",
            "Calculou o comprimento da circunferência em vez da área",
          ),
        ),
        bankOption(
          t("15 m²", "15 m²"),
          t(
            "The area uses the radius squared: 3 × 5², not 3 × 5.",
            "A área usa o raio ao quadrado: 3 × 5², não 3 × 5.",
          ),
          t(
            "Multiplied π by the radius without squaring it",
            "Multiplicou π pelo raio sem elevá-lo ao quadrado",
          ),
        ),
        bankOption(
          t("147 m²", "147 m²"),
          t(
            "The tree is 3 m across and 4 m up, but the straight-line distance is √(9 + 16) = 5 m, not 7 m.",
            "A árvore está 3 m para o lado e 4 m para cima, mas a distância em linha reta é √(9 + 16) = 5 m, não 7 m.",
          ),
          t(
            "Added the horizontal and vertical gaps instead of using the Pythagorean theorem",
            "Somou as diferenças horizontal e vertical em vez de usar o teorema de Pitágoras",
          ),
        ),
        bankOption(
          t("300 m²", "300 m²"),
          t(
            "The tree sits on the edge, so its distance to the sprinkler is the radius, not the diameter.",
            "A árvore fica na borda, então a distância dela até o aspersor é o raio, não o diâmetro.",
          ),
          t("Used the diameter in place of the radius", "Usou o diâmetro no lugar do raio"),
        ),
      ],
      question: t(
        "Using π ≈ 3, what is the area the sprinkler wets?",
        "Usando π ≈ 3, qual é a área molhada pelo aspersor?",
      ),
    },
    difficulty: 0,
    exam: "enem",
    format: "multipleChoice",
    key: "circle-sprinkler-area",
    skill: "cartesian-circles",
  },
  {
    content: {
      context: t(
        "On a Cartesian plane with distances in kilometers, two schools are at the points (1, 2) and (7, 10). The city wants to put a bus stop exactly halfway between them.",
        "Em um plano cartesiano com distâncias em quilômetros, duas escolas ficam nos pontos (1, 2) e (7, 10). A prefeitura quer instalar um ponto de ônibus exatamente no meio do caminho entre elas.",
      ),
      options: [
        bankOption(
          t("(4, 6)", "(4, 6)"),
          t(
            "The midpoint averages each coordinate: (1 + 7) ÷ 2 and (2 + 10) ÷ 2.",
            "O ponto médio é a média de cada coordenada: (1 + 7) ÷ 2 e (2 + 10) ÷ 2.",
          ),
        ),
        bankOption(
          t("(3, 4)", "(3, 4)"),
          t(
            "Half the gaps tells how far to walk from one school, so add them to (1, 2) to get the point.",
            "A metade das diferenças diz quanto andar a partir de uma escola, então some-as a (1, 2) para achar o ponto.",
          ),
          t(
            "Halved the differences instead of averaging the coordinates",
            "Dividiu as diferenças ao meio em vez de fazer a média das coordenadas",
          ),
        ),
        bankOption(
          t("(8, 12)", "(8, 12)"),
          t(
            "Adding the coordinates is only half the work: the midpoint divides each sum by 2.",
            "Somar as coordenadas é só metade do trabalho: o ponto médio divide cada soma por 2.",
          ),
          t(
            "Added the coordinates without dividing by 2",
            "Somou as coordenadas sem dividir por 2",
          ),
        ),
        bankOption(
          t("(6, 8)", "(6, 8)"),
          t(
            "Those are the gaps between the schools, not a place between them.",
            "Essas são as diferenças entre as escolas, não um lugar entre elas.",
          ),
          t(
            "Subtracted the coordinates instead of averaging them",
            "Subtraiu as coordenadas em vez de fazer a média",
          ),
        ),
        bankOption(
          t("(6, 4)", "(6, 4)"),
          t(
            "The x-values average to 4 and the y-values to 6, in that order.",
            "Os valores de x têm média 4 e os de y, média 6, nessa ordem.",
          ),
          t("Swapped the x and y coordinates", "Trocou as coordenadas x e y de lugar"),
        ),
      ],
      question: t(
        "At which point should the bus stop go?",
        "Em qual ponto o ponto de ônibus deve ser instalado?",
      ),
    },
    difficulty: -1,
    exam: "enem",
    format: "multipleChoice",
    key: "line-bus-stop-midpoint",
    skill: "cartesian-lines",
  },
  {
    content: {
      context: t(
        "A city maps the streets of a neighborhood on a Cartesian plane. Flower Street follows the line y = 2x + 1. A new street must run parallel to Flower Street and pass through the point (3, 4), where a school stands.",
        "Uma prefeitura representa as ruas de um bairro em um plano cartesiano. A Rua das Flores segue a reta y = 2x + 1. Uma nova rua deve ser paralela à Rua das Flores e passar pelo ponto (3, 4), onde fica uma escola.",
      ),
      options: [
        bankOption(
          t("y = 2x − 2", "y = 2x − 2"),
          t(
            "Parallel lines share the slope 2. Through (3, 4): 4 = 2 × 3 + b, so b = −2.",
            "Retas paralelas têm a mesma inclinação, 2. Pelo ponto (3, 4): 4 = 2 × 3 + b, então b = −2.",
          ),
        ),
        bankOption(
          t("y = −x/2 + 11/2", "y = −x/2 + 11/2"),
          t(
            "A slope of −1/2 makes the street cross Flower Street at a right angle.",
            "Uma inclinação de −1/2 faz a rua cruzar a Rua das Flores em ângulo reto.",
          ),
          t(
            "Used the perpendicular slope instead of the same slope",
            "Usou a inclinação perpendicular em vez da mesma inclinação",
          ),
        ),
        bankOption(
          t("y = 2x + 1", "y = 2x + 1"),
          t(
            "That's Flower Street itself, and it doesn't pass through (3, 4): 2 × 3 + 1 = 7.",
            "Essa é a própria Rua das Flores, e ela não passa por (3, 4): 2 × 3 + 1 = 7.",
          ),
          t(
            "Thinks parallel lines have the same equation",
            "Acha que retas paralelas têm a mesma equação",
          ),
        ),
        bankOption(
          t("y = 2x + 4", "y = 2x + 4"),
          t(
            "The intercept is where the line crosses the y-axis, at x = 0, not the y of the school's point.",
            "O coeficiente linear é onde a reta corta o eixo y, em x = 0, não o y do ponto da escola.",
          ),
          t(
            "Used the point's y-coordinate as the intercept",
            "Usou a coordenada y do ponto como coeficiente linear",
          ),
        ),
        bankOption(
          t("y = 4x/3", "y = 4x/3"),
          t(
            "That line goes from the origin to the school, with slope 4/3, so it isn't parallel to Flower Street.",
            "Essa reta vai da origem até a escola, com inclinação 4/3, então não é paralela à Rua das Flores.",
          ),
          t(
            "Drew the line from the origin through the point, ignoring the slope",
            "Traçou a reta da origem até o ponto, ignorando a inclinação",
          ),
        ),
      ],
      question: t("What is the equation of the new street?", "Qual é a equação da nova rua?"),
    },
    difficulty: 1,
    exam: "enem",
    format: "multipleChoice",
    key: "line-parallel-street",
    skill: "cartesian-lines",
  },
  {
    content: {
      context: t(
        "Since the 1980s, people with diabetes have used human insulin made by bacteria. Before that, insulin came from the pancreas of cattle and pigs, which caused allergies in some patients.",
        "Desde a década de 1980, pessoas com diabetes usam insulina humana produzida por bactérias. Antes disso, a insulina vinha do pâncreas de bois e porcos, o que causava alergia em alguns pacientes.",
      ),
      options: [
        bankOption(
          t(
            "Inserting the human insulin gene into the bacteria's DNA, so they make the human protein",
            "A inserção do gene humano da insulina no DNA das bactérias, que passam a produzir a proteína humana",
          ),
          t(
            "That's recombinant DNA: the bacteria read the human gene with the same genetic code and make the same hormone.",
            "É o DNA recombinante: as bactérias leem o gene humano com o mesmo código genético e produzem o mesmo hormônio.",
          ),
        ),
        bankOption(
          t(
            "Growing human pancreas cells inside the bacteria",
            "O cultivo de células do pâncreas humano dentro das bactérias",
          ),
          t(
            "A bacterium is a single cell, far smaller than a human cell. Only a gene goes into it.",
            "Uma bactéria é uma única célula, muito menor que uma célula humana. Só um gene entra nela.",
          ),
          t(
            "Thinks bacteria can host whole human cells",
            "Acha que bactérias podem abrigar células humanas inteiras",
          ),
        ),
        bankOption(
          t(
            "Selecting bacteria that naturally make insulin identical to the human one",
            "A seleção de bactérias que produzem naturalmente insulina idêntica à humana",
          ),
          t(
            "Bacteria don't have an insulin gene. It had to be put there.",
            "Bactérias não têm o gene da insulina. Ele precisou ser colocado nelas.",
          ),
          t(
            "Thinks bacteria already carry the human gene",
            "Acha que as bactérias já tinham o gene humano",
          ),
        ),
        bankOption(
          t(
            "Crossing bacteria with human cells to form a hybrid",
            "O cruzamento de bactérias com células humanas para formar um híbrido",
          ),
          t(
            "Bacteria don't reproduce sexually with human cells. Genetic engineering moves one gene, not a whole genome.",
            "Bactérias não se reproduzem sexuadamente com células humanas. A engenharia genética transfere um gene, não um genoma inteiro.",
          ),
          t(
            "Confuses genetic engineering with crossbreeding",
            "Confunde engenharia genética com cruzamento entre espécies",
          ),
        ),
        bankOption(
          t(
            "Exposing bacteria to radiation until they mutate and start making insulin",
            "A exposição das bactérias à radiação até que elas sofram mutação e passem a produzir insulina",
          ),
          t(
            "Random mutations don't write a specific human gene. The gene was cut from human DNA and inserted.",
            "Mutações ao acaso não escrevem um gene humano específico. O gene foi recortado do DNA humano e inserido.",
          ),
          t(
            "Thinks random mutation can create a specific gene on demand",
            "Acha que mutações ao acaso podem criar um gene específico sob encomenda",
          ),
        ),
      ],
      question: t("What made this production possible?", "O que tornou essa produção possível?"),
    },
    difficulty: -1,
    exam: "enem",
    format: "multipleChoice",
    key: "biotech-bacterial-insulin",
    skill: "biotechnology",
  },
  {
    content: {
      context: t(
        "Bt corn carries a gene from the bacterium Bacillus thuringiensis that makes a protein toxic to some caterpillars. Farmers who plant it are advised to keep a refuge: a share of the field sown with conventional corn, without the gene.",
        "O milho Bt carrega um gene da bactéria Bacillus thuringiensis que produz uma proteína tóxica para algumas lagartas. Quem o planta é orientado a manter um refúgio: uma parte da lavoura semeada com milho convencional, sem o gene.",
      ),
      options: [
        bankOption(
          t(
            "To keep caterpillars that the toxin kills in the population, slowing the spread of resistant ones",
            "Manter na população lagartas sensíveis à toxina, retardando a disseminação das resistentes",
          ),
          t(
            "Rare resistant caterpillars that survive mate with sensitive ones from the refuge, so resistance spreads more slowly.",
            "As raras lagartas resistentes que sobrevivem cruzam com as sensíveis do refúgio, e a resistência se espalha mais devagar.",
          ),
        ),
        bankOption(
          t(
            "To stop caterpillars from becoming transgenic when they eat the modified corn",
            "Impedir que as lagartas se tornem transgênicas ao comer o milho modificado",
          ),
          t(
            "Eating a plant doesn't put its genes into the animal's DNA. Digestion breaks the DNA down.",
            "Comer uma planta não coloca os genes dela no DNA do animal. A digestão degrada o DNA.",
          ),
          t(
            "Thinks eating a transgenic plant transfers its genes",
            "Acha que comer uma planta transgênica transfere seus genes",
          ),
        ),
        bankOption(
          t(
            "To give caterpillars a break from the toxin so they don't get used to it",
            "Dar às lagartas uma pausa da toxina para que elas não se acostumem a ela",
          ),
          t(
            "The toxin doesn't teach caterpillars to resist. It selects those that already carry resistance genes.",
            "A toxina não ensina as lagartas a resistir. Ela seleciona as que já carregam genes de resistência.",
          ),
          t(
            "Thinks the toxin itself makes each caterpillar resistant over time",
            "Acha que a própria toxina torna cada lagarta resistente com o tempo",
          ),
        ),
        bankOption(
          t(
            "To make up for the harvest that Bt corn loses",
            "Compensar a colheita que o milho Bt perde",
          ),
          t(
            "The refuge has nothing to do with yield: Bt corn is planted to lose less to pests.",
            "O refúgio não tem a ver com produtividade: o milho Bt é plantado justamente para perder menos para as pragas.",
          ),
          t(
            "Confuses the refuge with a way to raise the harvest",
            "Confunde o refúgio com uma forma de aumentar a colheita",
          ),
        ),
        bankOption(
          t(
            "To shelter natural predators that kill every caterpillar the toxin misses",
            "Abrigar predadores naturais que matam todas as lagartas que a toxina não alcança",
          ),
          t(
            "Predators help, but the refuge is meant to keep sensitive caterpillars alive, not to kill them.",
            "Predadores ajudam, mas o refúgio serve para manter vivas as lagartas sensíveis, não para matá-las.",
          ),
          t(
            "Confuses resistance management with biological control",
            "Confunde o manejo da resistência com o controle biológico",
          ),
        ),
      ],
      question: t(
        "What is the main purpose of the refuge?",
        "Qual é a principal finalidade do refúgio?",
      ),
    },
    difficulty: 1,
    exam: "enem",
    format: "multipleChoice",
    key: "biotech-bt-corn-refuge",
    skill: "biotechnology",
  },
  {
    content: {
      context: t(
        "In an 18th-century experiment, a mouse in a sealed glass jar soon died. A mouse sealed in a jar with a green plant, kept in the light, lived much longer.",
        "Em um experimento do século XVIII, um camundongo em um pote de vidro fechado logo morreu. Um camundongo fechado em um pote com uma planta verde, mantido na luz, viveu muito mais tempo.",
      ),
      options: [
        bankOption(
          t(
            "The plant's photosynthesis released oxygen for the mouse's respiration, and the mouse released carbon dioxide the plant used",
            "A fotossíntese da planta liberou oxigênio para a respiração do camundongo, e o camundongo liberou gás carbônico que a planta usou",
          ),
          t(
            "In the light, photosynthesis makes more oxygen than the plant's own respiration uses, so the gases cycle between them.",
            "Na luz, a fotossíntese produz mais oxigênio do que a própria respiração da planta consome, e os gases circulam entre os dois.",
          ),
        ),
        bankOption(
          t(
            "The plant does only photosynthesis and never respires, so all its oxygen went to the mouse",
            "A planta só faz fotossíntese e nunca respira, então todo o oxigênio dela foi para o camundongo",
          ),
          t(
            "Plants respire all the time, day and night. In the light they simply make more oxygen than they use.",
            "As plantas respiram o tempo todo, de dia e de noite. Na luz, elas só produzem mais oxigênio do que consomem.",
          ),
          t("Thinks plants don't respire", "Acha que as plantas não respiram"),
        ),
        bankOption(
          t(
            "The mouse's respiration produced glucose that fed the plant",
            "A respiração do camundongo produziu glicose que alimentou a planta",
          ),
          t(
            "Respiration breaks glucose down. Glucose is made by photosynthesis.",
            "A respiração quebra a glicose. Quem produz glicose é a fotossíntese.",
          ),
          t("Thinks respiration makes glucose", "Acha que a respiração produz glicose"),
        ),
        bankOption(
          t(
            "Photosynthesis used up the jar's oxygen, and the mouse's respiration replaced it",
            "A fotossíntese consumiu o oxigênio do pote, e a respiração do camundongo o repôs",
          ),
          t(
            "It's the other way around: photosynthesis releases oxygen and respiration consumes it.",
            "É o contrário: a fotossíntese libera oxigênio e a respiração o consome.",
          ),
          t(
            "Swaps the gases photosynthesis and respiration take in and give off",
            "Inverte os gases que a fotossíntese e a respiração consomem e liberam",
          ),
        ),
        bankOption(
          t(
            "The plant used the heat of the mouse's body as energy for photosynthesis",
            "A planta usou o calor do corpo do camundongo como energia para a fotossíntese",
          ),
          t(
            "Photosynthesis runs on light, which is why the jar had to stay lit.",
            "A fotossíntese funciona com luz, e por isso o pote precisava ficar iluminado.",
          ),
          t("Thinks heat can power photosynthesis", "Acha que calor pode alimentar a fotossíntese"),
        ),
      ],
      question: t(
        "What explains the second mouse's longer survival?",
        "O que explica a sobrevivência mais longa do segundo camundongo?",
      ),
    },
    difficulty: 0,
    exam: "enem",
    format: "multipleChoice",
    key: "cell-energy-plant-and-mouse",
    skill: "cell-energy",
  },
  {
    content: {
      context: t(
        "Between 1894 and 1930, most presidents of Brazil came from São Paulo, the largest coffee producer, or from Minas Gerais, a coffee and dairy state with the largest number of voters. Votes were cast openly, and in the countryside local bosses, the coronéis, told voters whom to choose.",
        "Entre 1894 e 1930, a maioria dos presidentes do Brasil veio de São Paulo, o maior produtor de café, ou de Minas Gerais, estado de café e de laticínios com o maior eleitorado do país. O voto era aberto, e no interior os chefes locais, os coronéis, indicavam aos eleitores em quem votar.",
      ),
      options: [
        bankOption(
          t(
            "An informal alliance between the agrarian elites of São Paulo and Minas Gerais, sustained by the coronéis' control of rural votes",
            "Uma aliança informal entre as elites agrárias de São Paulo e de Minas Gerais, sustentada pelo controle dos coronéis sobre o voto rural",
          ),
          t(
            "The two richest and most populous states agreed on candidates, and open voting under the coronéis delivered the results.",
            "Os dois estados mais ricos e populosos combinavam candidatos, e o voto aberto sob os coronéis garantia os resultados.",
          ),
        ),
        bankOption(
          t(
            "Direct elections by secret ballot, which favored the two most populous states",
            "Eleições diretas com voto secreto, que favoreciam os dois estados mais populosos",
          ),
          t(
            "The vote was open, which let the coronéis watch how people voted. The secret ballot came only in 1932.",
            "O voto era aberto, o que permitia aos coronéis vigiar como as pessoas votavam. O voto secreto só veio em 1932.",
          ),
          t(
            "Thinks the First Republic already had the secret ballot",
            "Acha que a Primeira República já tinha voto secreto",
          ),
        ),
        bankOption(
          t(
            "A clause in the Constitution requiring the presidency to alternate between the two states",
            "Uma cláusula da Constituição que obrigava a presidência a se alternar entre os dois estados",
          ),
          t(
            "No law required it. It was a political arrangement between oligarchies, and it broke down in 1930.",
            "Nenhuma lei exigia isso. Era um acordo político entre oligarquias, e ele se rompeu em 1930.",
          ),
          t(
            "Thinks the arrangement was a formal legal rule",
            "Acha que o arranjo era uma regra legal formal",
          ),
        ),
        bankOption(
          t(
            "Army rule, with generals appointing presidents from the two states",
            "Um governo do Exército, com generais nomeando presidentes dos dois estados",
          ),
          t(
            "Military presidents ruled only in the Republic's first years, until 1894. Civilian oligarchies ruled after that.",
            "Presidentes militares governaram só nos primeiros anos da República, até 1894. Depois disso, governaram as oligarquias civis.",
          ),
          t(
            "Confuses the oligarchic republic with military rule",
            "Confunde a república oligárquica com um governo militar",
          ),
        ),
        bankOption(
          t(
            "The vote of industrial workers, organized in unions in São Paulo and Minas Gerais",
            "O voto dos operários industriais, organizados em sindicatos em São Paulo e Minas Gerais",
          ),
          t(
            "Brazil was mostly rural, and power rested with landowners. Workers' movements were repressed, not in charge.",
            "O Brasil era sobretudo rural, e o poder estava com os proprietários de terra. Os movimentos operários eram reprimidos, não estavam no comando.",
          ),
          t(
            "Thinks urban workers drove the politics of the time",
            "Acha que os trabalhadores urbanos comandavam a política da época",
          ),
        ),
      ],
      question: t(
        "The arrangement known as coffee-with-milk politics rested mainly on:",
        "O arranjo conhecido como política do café com leite se apoiava principalmente em:",
      ),
    },
    difficulty: 0,
    exam: "enem",
    format: "multipleChoice",
    key: "coffee-with-milk-alliance",
    skill: "coffee-with-milk",
  },
  {
    content: {
      context: t(
        'A student\'s ENEM essay has correct grammar, stays on the theme, builds a well-organized argument and links its paragraphs well. It ends with: "Therefore, something must be done about this problem."',
        'A redação de um estudante no ENEM tem gramática correta, respeita o tema, constrói uma argumentação bem organizada e liga bem os parágrafos. Ela termina assim: "Portanto, algo precisa ser feito em relação a esse problema."',
      ),
      options: [
        bankOption(
          t(
            "Competency 5, because the proposal doesn't say who should act, what to do, how, or what for",
            "A competência 5, porque a proposta não diz quem deve agir, o que fazer, como nem com que finalidade",
          ),
          t(
            "Competency 5 scores the intervention proposal by its elements: agent, action, means, purpose and detail.",
            "A competência 5 avalia a proposta de intervenção por seus elementos: agente, ação, meio, finalidade e detalhamento.",
          ),
        ),
        bankOption(
          t(
            "Competency 1, because the ending is too informal",
            "A competência 1, porque o final é informal demais",
          ),
          t(
            "The sentence is grammatically correct and formal. Its problem is that it proposes nothing concrete.",
            "A frase está gramaticalmente correta e é formal. O problema dela é não propor nada concreto.",
          ),
          t(
            "Thinks the grammar competency judges the content of the proposal",
            "Acha que a competência de gramática avalia o conteúdo da proposta",
          ),
        ),
        bankOption(
          t(
            "Competency 2, because a vague ending means the essay ran away from the theme",
            "A competência 2, porque um final vago significa que a redação fugiu do tema",
          ),
          t(
            "The essay stays on the theme all the way through. A vague proposal costs points in competency 5, not 2.",
            "A redação respeita o tema do começo ao fim. Uma proposta vaga perde pontos na competência 5, não na 2.",
          ),
          t(
            "Confuses a vague proposal with escaping the theme",
            "Confunde uma proposta vaga com fuga ao tema",
          ),
        ),
        bankOption(
          t(
            'Competency 4, because "therefore" is the wrong connective for a conclusion',
            'A competência 4, porque "portanto" é o conectivo errado para uma conclusão',
          ),
          t(
            '"Therefore" fits a conclusion well. Cohesion isn\'t the problem here.',
            '"Portanto" combina bem com uma conclusão. A coesão não é o problema aqui.',
          ),
          t(
            "Blames the connective instead of the missing proposal",
            "Culpa o conectivo em vez da proposta que falta",
          ),
        ),
        bankOption(
          t(
            "None: the intervention proposal is optional, so the essay loses no points",
            "Nenhuma: a proposta de intervenção é opcional, então a redação não perde pontos",
          ),
          t(
            "The proposal is required and has its own competency, worth up to 200 points.",
            "A proposta é obrigatória e tem uma competência própria, que vale até 200 pontos.",
          ),
          t(
            "Thinks the intervention proposal is optional",
            "Acha que a proposta de intervenção é opcional",
          ),
        ),
      ],
      question: t(
        "In which competency does this essay lose the most points?",
        "Em qual competência essa redação perde mais pontos?",
      ),
    },
    difficulty: -1,
    exam: "enem",
    format: "multipleChoice",
    key: "essay-vague-proposal",
    skill: "essay-competencies",
  },
  {
    content: {
      context: t(
        "In 1913, Henry Ford's factory introduced the moving assembly line: the car moved along a conveyor, and each worker repeated one simple task all day. The time to assemble a Model T fell from about 12 hours to about an hour and a half.",
        "Em 1913, a fábrica de Henry Ford introduziu a linha de montagem móvel: o carro avançava por uma esteira, e cada operário repetia uma única tarefa simples o dia inteiro. O tempo para montar um Modelo T caiu de cerca de 12 horas para cerca de uma hora e meia.",
      ),
      options: [
        bankOption(
          t(
            "Work split into simple, repetitive tasks, with workers losing control over the whole production process",
            "O trabalho dividido em tarefas simples e repetitivas, com os operários perdendo o controle sobre o processo de produção como um todo",
          ),
          t(
            "Each worker did one small step at the line's pace, so knowing how to build the whole car no longer mattered.",
            "Cada operário fazia uma pequena etapa no ritmo da esteira, e saber montar o carro inteiro deixou de importar.",
          ),
        ),
        bankOption(
          t(
            "A return to workshops where each craftsman built a whole car",
            "A volta das oficinas em que cada artesão montava um carro inteiro",
          ),
          t(
            "The assembly line did the opposite: it broke the craftsman's whole job into many small tasks.",
            "A linha de montagem fez o contrário: dividiu o trabalho completo do artesão em muitas tarefas pequenas.",
          ),
          t(
            "Reverses the change from craft work to mass production",
            "Inverte a passagem do trabalho artesanal para a produção em massa",
          ),
        ),
        bankOption(
          t(
            "More freedom for workers to set the pace of their work",
            "Mais liberdade para os operários definirem o ritmo do próprio trabalho",
          ),
          t(
            "The conveyor set the pace, and workers had to keep up with it.",
            "Quem definia o ritmo era a esteira, e os operários tinham de acompanhá-la.",
          ),
          t(
            "Thinks the assembly line gave workers control over their pace",
            "Acha que a linha de montagem deu aos operários controle sobre o ritmo",
          ),
        ),
        bankOption(
          t(
            "The end of wage labor, replaced by workers owning the factories",
            "O fim do trabalho assalariado, substituído pela posse das fábricas pelos operários",
          ),
          t(
            "Workers stayed wage earners. The factory and the line belonged to the company.",
            "Os operários continuaram assalariados. A fábrica e a esteira pertenciam à empresa.",
          ),
          t(
            "Thinks mass production ended wage labor",
            "Acha que a produção em massa acabou com o trabalho assalariado",
          ),
        ),
        bankOption(
          t(
            "The replacement of every worker by robots",
            "A substituição de todos os operários por robôs",
          ),
          t(
            "Ford's line used many workers. Industrial robots came decades later, with automation.",
            "A linha de Ford usava muitos operários. Os robôs industriais vieram décadas depois, com a automação.",
          ),
          t(
            "Confuses Fordism with later automation",
            "Confunde o fordismo com a automação posterior",
          ),
        ),
      ],
      question: t(
        "For workers, a lasting effect of this way of organizing production was:",
        "Para os trabalhadores, um efeito duradouro dessa forma de organizar a produção foi:",
      ),
    },
    difficulty: 0,
    exam: "enem",
    format: "multipleChoice",
    key: "industrial-assembly-line",
    skill: "industrial-production",
  },
  {
    content: {
      context: t(
        "In many Brazilian cities, neighborhood libraries have become much more than places to borrow books. They host homework help, job-search workshops and free internet access. On weekends, families come for storytelling and chess clubs. When a library closes, a neighborhood loses not just a collection of books but one of its few free public spaces where people meet.",
        "Em muitas cidades brasileiras, as bibliotecas de bairro se tornaram muito mais do que lugares para pegar livros emprestados. Elas oferecem reforço escolar, oficinas de busca de emprego e internet gratuita. Nos fins de semana, famílias vão às rodas de leitura e aos clubes de xadrez. Quando uma biblioteca fecha, o bairro perde não só um acervo, mas um dos poucos espaços públicos e gratuitos onde as pessoas se encontram.",
      ),
      options: [
        bankOption(
          t(
            "Neighborhood libraries have become free community spaces, valued for much more than lending books",
            "As bibliotecas de bairro se tornaram espaços comunitários gratuitos, valiosos por muito mais do que o empréstimo de livros",
          ),
          t(
            "Every sentence serves this idea: the activities show it, and the closing warns what is lost without it.",
            "Todas as frases servem a essa ideia: as atividades a mostram, e o fim alerta para o que se perde sem ela.",
          ),
        ),
        bankOption(
          t(
            "Libraries should stop lending books and focus on internet access",
            "As bibliotecas deveriam parar de emprestar livros e se dedicar ao acesso à internet",
          ),
          t(
            "The text adds services to lending; it never suggests dropping books.",
            "O texto soma serviços ao empréstimo; em nenhum momento sugere abandonar os livros.",
          ),
          t(
            "Turns a detail into a proposal the text doesn't make",
            "Transforma um detalhe em uma proposta que o texto não faz",
          ),
        ),
        bankOption(
          t(
            "Chess clubs are the main reason families visit libraries",
            "Os clubes de xadrez são o principal motivo das visitas das famílias às bibliotecas",
          ),
          t(
            "Chess is one example among many activities, mentioned once.",
            "O xadrez é um exemplo entre várias atividades, citado uma vez.",
          ),
          t("Takes a detail as the main idea", "Toma um detalhe como a ideia central"),
        ),
        bankOption(
          t(
            "Brazilians read fewer books than they used to",
            "Os brasileiros leem menos livros do que antes",
          ),
          t(
            "The text says nothing about how much people read. That's outside knowledge, not the text's point.",
            "O texto não diz nada sobre quanto as pessoas leem. Isso é conhecimento externo, não a ideia do texto.",
          ),
          t(
            "Answers from outside knowledge instead of the text",
            "Responde com conhecimento externo em vez do texto",
          ),
        ),
        bankOption(
          t(
            "Closing libraries saves public money that cities need",
            "Fechar bibliotecas economiza dinheiro público de que as cidades precisam",
          ),
          t(
            "The text treats a closing as a loss for the neighborhood, the opposite of this view.",
            "O texto trata o fechamento como uma perda para o bairro, o contrário dessa visão.",
          ),
          t(
            "Picks a view that contradicts the author's",
            "Escolhe uma visão que contradiz a do autor",
          ),
        ),
      ],
      question: t("The main idea of the text is that:", "A ideia central do texto é que:"),
    },
    difficulty: 0,
    exam: "enem",
    format: "multipleChoice",
    key: "main-idea-neighborhood-library",
    skill: "main-idea",
  },
  {
    content: {
      context: t(
        "A bus makes a 240 km trip between two cities. It covers the first 120 km at an average of 60 km/h and, because of road works, the last 120 km at an average of 40 km/h.",
        "Um ônibus faz uma viagem de 240 km entre duas cidades. Ele percorre os primeiros 120 km a uma média de 60 km/h e, por causa de obras na estrada, os últimos 120 km a uma média de 40 km/h.",
      ),
      options: [
        bankOption(
          t("48 km/h", "48 km/h"),
          t(
            "The trip takes 2 h + 3 h = 5 h, and 240 km ÷ 5 h gives the average speed.",
            "A viagem leva 2 h + 3 h = 5 h, e 240 km ÷ 5 h dá a velocidade média.",
          ),
        ),
        bankOption(
          t("50 km/h", "50 km/h"),
          t(
            "The bus spends more time at 40 km/h than at 60 km/h, so the average leans toward 40.",
            "O ônibus passa mais tempo a 40 km/h do que a 60 km/h, então a média fica mais perto de 40.",
          ),
          t(
            "Averaged the two speeds instead of dividing distance by time",
            "Fez a média das duas velocidades em vez de dividir a distância pelo tempo",
          ),
        ),
        bankOption(
          t("100 km/h", "100 km/h"),
          t(
            "Speeds on different stretches don't add up. The average is total distance over total time.",
            "Velocidades em trechos diferentes não se somam. A média é a distância total pelo tempo total.",
          ),
          t("Added the two speeds", "Somou as duas velocidades"),
        ),
        bankOption(
          t("20 km/h", "20 km/h"),
          t(
            "The difference between the speeds says how much slower the second stretch was, not the trip's average.",
            "A diferença entre as velocidades diz quanto o segundo trecho foi mais lento, não a média da viagem.",
          ),
          t("Subtracted the two speeds", "Subtraiu as duas velocidades"),
        ),
        bankOption(
          t("24 km/h", "24 km/h"),
          t(
            "The 5 hours cover the whole 240 km, so divide the whole distance by them.",
            "As 5 horas cobrem os 240 km inteiros, então divida a distância toda por elas.",
          ),
          t(
            "Divided only half the distance by the total time",
            "Dividiu só metade da distância pelo tempo total",
          ),
        ),
      ],
      question: t(
        "What was the bus's average speed for the whole trip?",
        "Qual foi a velocidade média do ônibus na viagem inteira?",
      ),
    },
    difficulty: 1,
    exam: "enem",
    format: "multipleChoice",
    key: "motion-bus-average-speed",
    skill: "motion-problems",
  },
  {
    content: {
      context: t(
        "Vinegar owes its sour taste to acetic acid, CH₃COOH. The alcohol in cachaça, a Brazilian sugarcane spirit, is ethanol, CH₃CH₂OH.",
        "O vinagre deve seu gosto azedo ao ácido acético, CH₃COOH. O álcool da cachaça é o etanol, CH₃CH₂OH.",
      ),
      options: [
        bankOption(
          t("Carboxylic acid and alcohol", "Ácido carboxílico e álcool"),
          t(
            "Acetic acid has the carboxyl group, −COOH. Ethanol has an −OH on a saturated carbon, the mark of an alcohol.",
            "O ácido acético tem o grupo carboxila, −COOH. O etanol tem um −OH em carbono saturado, a marca de um álcool.",
          ),
        ),
        bankOption(
          t("Alcohol and carboxylic acid", "Álcool e ácido carboxílico"),
          t(
            "The order matters: the −COOH belongs to acetic acid, which comes first.",
            "A ordem importa: o −COOH pertence ao ácido acético, que vem primeiro.",
          ),
          t("Swapped the two functions", "Trocou as duas funções"),
        ),
        bankOption(
          t("Ketone and ether", "Cetona e éter"),
          t(
            "A ketone's C=O sits between two carbons, and an ether's oxygen sits between two carbons. Neither happens here.",
            "O C=O de uma cetona fica entre dois carbonos, e o oxigênio de um éter fica entre dois carbonos. Nada disso acontece aqui.",
          ),
          t(
            "Reads any C=O as a ketone and any oxygen as an ether",
            "Lê qualquer C=O como cetona e qualquer oxigênio como éter",
          ),
        ),
        bankOption(
          t("Aldehyde and phenol", "Aldeído e fenol"),
          t(
            "An aldehyde ends in −CHO, without the −OH of −COOH, and a phenol has its −OH on a benzene ring.",
            "Um aldeído termina em −CHO, sem o −OH do −COOH, e um fenol tem o −OH ligado a um anel benzênico.",
          ),
          t(
            "Takes a carbonyl at the end of a chain as an aldehyde and any −OH as a phenol",
            "Toma uma carbonila no fim da cadeia como aldeído e qualquer −OH como fenol",
          ),
        ),
        bankOption(
          t("Ester and alcohol", "Éster e álcool"),
          t(
            "An ester's COO links two carbon chains. Acetic acid's ends in −OH, which makes it an acid.",
            "O COO de um éster liga duas cadeias de carbono. O do ácido acético termina em −OH, o que o torna um ácido.",
          ),
          t(
            "Confuses a carboxylic acid with an ester because both have COO",
            "Confunde ácido carboxílico com éster porque os dois têm COO",
          ),
        ),
      ],
      question: t(
        "The organic functions of acetic acid and ethanol are, respectively:",
        "As funções orgânicas do ácido acético e do etanol são, respectivamente:",
      ),
    },
    difficulty: 0,
    exam: "enem",
    format: "multipleChoice",
    key: "organic-vinegar-cachaca",
    skill: "organic-functions",
  },
  {
    content: {
      context: t(
        "A phone's battery indicator shows 35%. The battery holds 4,000 mAh when full.",
        "O indicador de bateria de um celular mostra 35%. A bateria tem capacidade de 4.000 mAh quando está cheia.",
      ),
      options: [
        bankOption(
          t("1,400 mAh", "1.400 mAh"),
          t(
            "35% is 35/100 = 0.35, and 0.35 × 4,000 gives the charge left.",
            "35% é 35/100 = 0,35, e 0,35 × 4.000 dá a carga que resta.",
          ),
        ),
        bankOption(
          t("140 mAh", "140 mAh"),
          t(
            "35% is 0.35, not 0.035. Moving the decimal point one place too far divides the answer by 10.",
            "35% é 0,35, não 0,035. Andar uma casa a mais com a vírgula divide a resposta por 10.",
          ),
          t(
            "Misplaced the decimal point when turning the percent into a decimal",
            "Errou a posição da vírgula ao transformar a porcentagem em decimal",
          ),
        ),
        bankOption(
          t("14,000 mAh", "14.000 mAh"),
          t(
            "35% is less than the whole, so the answer must be less than 4,000 mAh.",
            "35% é menos que o todo, então a resposta precisa ser menor que 4.000 mAh.",
          ),
          t("Multiplied by 3.5 instead of 0.35", "Multiplicou por 3,5 em vez de 0,35"),
        ),
        bankOption(
          t("3,965 mAh", "3.965 mAh"),
          t(
            "35% is a share of the total, not 35 units to take away from it.",
            "35% é uma parte do total, não 35 unidades para tirar dele.",
          ),
          t(
            "Subtracted the percent from the total as if it were a number of units",
            "Subtraiu a porcentagem do total como se fosse um número de unidades",
          ),
        ),
        bankOption(
          t("2,600 mAh", "2.600 mAh"),
          t(
            "That's the 65% already used. The indicator shows what's left.",
            "Esses são os 65% já usados. O indicador mostra o que resta.",
          ),
          t(
            "Calculated the part used instead of the part left",
            "Calculou a parte usada em vez da parte que resta",
          ),
        ),
      ],
      question: t(
        "How much charge is left in the battery?",
        "Quanta carga ainda resta na bateria?",
      ),
    },
    difficulty: -1,
    exam: "enem",
    format: "multipleChoice",
    key: "percent-phone-battery",
    skill: "percent-basics",
  },
  {
    content: {
      context: t(
        "An electric shower rated at 5,500 W is used for 10 minutes a day for 30 days. The power company bills energy in kilowatt-hours (kWh).",
        "Um chuveiro elétrico de 5.500 W é usado 10 minutos por dia durante 30 dias. A distribuidora de energia cobra o consumo em quilowatt-hora (kWh).",
      ),
      options: [
        bankOption(
          t("27.5 kWh", "27,5 kWh"),
          t(
            "5,500 W is 5.5 kW, and 10 minutes a day for 30 days is 300 minutes, or 5 hours: 5.5 × 5.",
            "5.500 W são 5,5 kW, e 10 minutos por dia durante 30 dias somam 300 minutos, ou 5 horas: 5,5 × 5.",
          ),
        ),
        bankOption(
          t("1,650 kWh", "1.650 kWh"),
          t(
            "A kWh counts hours, so the 10 minutes must become 1/6 of an hour first.",
            "O kWh conta horas, então os 10 minutos precisam virar 1/6 de hora antes.",
          ),
          t("Used minutes as if they were hours", "Usou minutos como se fossem horas"),
        ),
        bankOption(
          t("27,500 kWh", "27.500 kWh"),
          t(
            "With the power in watts, the result is 27,500 Wh. Dividing by 1,000 turns it into kWh.",
            "Com a potência em watts, o resultado é 27.500 Wh. Dividir por 1.000 transforma em kWh.",
          ),
          t(
            "Kept the power in watts but wrote the result in kilowatt-hours",
            "Manteve a potência em watts, mas escreveu o resultado em quilowatt-hora",
          ),
        ),
        bankOption(
          t("0.92 kWh", "0,92 kWh"),
          t(
            "That's a single day's use. The question asks about all 30 days.",
            "Esse é o consumo de um único dia. A pergunta pede os 30 dias.",
          ),
          t("Counted only one day", "Contou só um dia"),
        ),
        bankOption(
          t("165 kWh", "165 kWh"),
          t(
            "Each shower lasts 10 minutes, a sixth of an hour, not a full hour.",
            "Cada banho dura 10 minutos, um sexto de hora, não uma hora inteira.",
          ),
          t(
            "Counted each 10-minute shower as one hour",
            "Contou cada banho de 10 minutos como uma hora",
          ),
        ),
      ],
      question: t(
        "How much energy does the shower use over this period?",
        "Quanta energia o chuveiro consome nesse período?",
      ),
    },
    difficulty: 0,
    exam: "enem",
    format: "multipleChoice",
    key: "units-electric-shower",
    skill: "physical-units",
  },
  {
    content: {
      context: t(
        "A designer transforms a triangle on a Cartesian plane. The original triangle has vertices (0, 0), (3, 1) and (1, 2). After the transformation, its vertices are (0, 0), (−1, 3) and (−2, 1).",
        "Um designer transforma um triângulo em um plano cartesiano. O triângulo original tem vértices (0, 0), (3, 1) e (1, 2). Depois da transformação, seus vértices são (0, 0), (−1, 3) e (−2, 1).",
      ),
      options: [
        bankOption(
          t(
            "A 90° counterclockwise rotation about the origin",
            "Uma rotação de 90° no sentido anti-horário em torno da origem",
          ),
          t(
            "A quarter turn counterclockwise sends (x, y) to (−y, x): (3, 1) goes to (−1, 3) and (1, 2) to (−2, 1).",
            "Um quarto de volta no sentido anti-horário leva (x, y) a (−y, x): (3, 1) vai para (−1, 3) e (1, 2) para (−2, 1).",
          ),
        ),
        bankOption(
          t(
            "A 90° clockwise rotation about the origin",
            "Uma rotação de 90° no sentido horário em torno da origem",
          ),
          t(
            "Clockwise sends (x, y) to (y, −x), so (3, 1) would go to (1, −3).",
            "No sentido horário, (x, y) vai para (y, −x), então (3, 1) iria para (1, −3).",
          ),
          t(
            "Mixes up clockwise and counterclockwise",
            "Confunde os sentidos horário e anti-horário",
          ),
        ),
        bankOption(
          t("A reflection across the y-axis", "Uma reflexão em relação ao eixo y"),
          t(
            "That reflection only changes the sign of x, so (3, 1) would go to (−3, 1).",
            "Essa reflexão só troca o sinal de x, então (3, 1) iria para (−3, 1).",
          ),
          t(
            "Saw negative x-values and assumed a reflection",
            "Viu valores negativos de x e supôs uma reflexão",
          ),
        ),
        bankOption(
          t("A reflection across the line y = x", "Uma reflexão em relação à reta y = x"),
          t(
            "That reflection swaps the coordinates without changing signs: (3, 1) would go to (1, 3).",
            "Essa reflexão troca as coordenadas sem mudar sinais: (3, 1) iria para (1, 3).",
          ),
          t(
            "Noticed the swapped coordinates but ignored the sign change",
            "Notou a troca das coordenadas, mas ignorou a mudança de sinal",
          ),
        ),
        bankOption(
          t("A 180° rotation about the origin", "Uma rotação de 180° em torno da origem"),
          t(
            "A half turn changes both signs and keeps the order: (3, 1) would go to (−3, −1).",
            "Meia volta troca os dois sinais e mantém a ordem: (3, 1) iria para (−3, −1).",
          ),
          t(
            "Confuses a quarter turn with a half turn",
            "Confunde um quarto de volta com meia volta",
          ),
        ),
      ],
      question: t(
        "Which transformation did the designer apply?",
        "Qual transformação o designer aplicou?",
      ),
    },
    difficulty: 0,
    exam: "enem",
    format: "multipleChoice",
    key: "transform-triangle-rotation",
    skill: "plane-transformations",
  },
  {
    content: {
      context: t(
        "The Sun is about 1.5 × 10⁸ km from Earth, and light travels about 3 × 10⁵ km per second.",
        "O Sol fica a cerca de 1,5 × 10⁸ km da Terra, e a luz percorre cerca de 3 × 10⁵ km por segundo.",
      ),
      options: [
        bankOption(
          t("5 × 10² s", "5 × 10² s"),
          t(
            "Divide distance by speed: 1.5 ÷ 3 = 0.5 and 10⁸ ÷ 10⁵ = 10³, so 0.5 × 10³ = 5 × 10² s, about 8 minutes.",
            "Divida a distância pela velocidade: 1,5 ÷ 3 = 0,5 e 10⁸ ÷ 10⁵ = 10³, então 0,5 × 10³ = 5 × 10² s, cerca de 8 minutos.",
          ),
        ),
        bankOption(
          t("5 × 10³ s", "5 × 10³ s"),
          t(
            "Turning 0.5 into 5 multiplies it by 10, so the power must drop by one: 10³ becomes 10².",
            "Transformar 0,5 em 5 multiplica por 10, então a potência precisa cair um: 10³ vira 10².",
          ),
          t(
            "Rewrote 0.5 × 10³ as 5 × 10³ without lowering the exponent",
            "Reescreveu 0,5 × 10³ como 5 × 10³ sem diminuir o expoente",
          ),
        ),
        bankOption(
          t("1.5 × 10³ s", "1,5 × 10³ s"),
          t(
            "The leading numbers divide too: 1.5 ÷ 3 = 0.5.",
            "Os números da frente também se dividem: 1,5 ÷ 3 = 0,5.",
          ),
          t(
            "Divided the powers of ten but not the leading numbers",
            "Dividiu as potências de dez, mas não os números da frente",
          ),
        ),
        bankOption(
          t("4.5 × 10¹³ s", "4,5 × 10¹³ s"),
          t(
            "Time is distance divided by speed. Multiplying them gives no time at all.",
            "Tempo é distância dividida pela velocidade. Multiplicá-las não dá um tempo.",
          ),
          t("Multiplied the distance by the speed", "Multiplicou a distância pela velocidade"),
        ),
        bankOption(
          t("2 × 10⁻³ s", "2 × 10⁻³ s"),
          t(
            "That's speed divided by distance. The time is distance divided by speed.",
            "Isso é velocidade dividida pela distância. O tempo é a distância dividida pela velocidade.",
          ),
          t("Divided the speed by the distance", "Dividiu a velocidade pela distância"),
        ),
      ],
      question: t(
        "About how long does sunlight take to reach Earth?",
        "Aproximadamente quanto tempo a luz do Sol leva para chegar à Terra?",
      ),
    },
    difficulty: 0,
    exam: "enem",
    format: "multipleChoice",
    key: "powers-sunlight-travel",
    skill: "powers-magnitudes",
  },
  {
    content: {
      context: t(
        'A school newsletter printed: "The students, who took the practice test, received their report cards." The coordinator meant that only some students had taken the test.',
        'O informativo de uma escola publicou: "Os alunos, que fizeram o simulado, receberam o boletim." A coordenadora queria dizer que só alguns alunos tinham feito o simulado.',
      ),
      options: [
        bankOption(
          t(
            "The commas say every student took the test; without them, the sentence would refer only to those who took it",
            "As vírgulas dizem que todos os alunos fizeram o simulado; sem elas, a frase se referiria só aos que o fizeram",
          ),
          t(
            "Between commas, the clause only explains something about all the students. Without commas, it restricts the group.",
            "Entre vírgulas, a oração só explica algo sobre todos os alunos. Sem vírgulas, ela restringe o grupo.",
          ),
        ),
        bankOption(
          t(
            "The commas only mark a pause for breath and don't change the meaning",
            "As vírgulas só marcam uma pausa para respirar e não mudam o sentido",
          ),
          t(
            "These commas change who the sentence talks about: all the students or only some.",
            "Essas vírgulas mudam de quem a frase fala: de todos os alunos ou só de alguns.",
          ),
          t(
            "Thinks commas only mark breathing pauses",
            "Acha que vírgulas só marcam pausas para respirar",
          ),
        ),
        bankOption(
          t(
            "The commas limit the group to the students who took the test, as the coordinator wanted",
            "As vírgulas limitam o grupo aos alunos que fizeram o simulado, como a coordenadora queria",
          ),
          t(
            "It's the other way around: the clause restricts the group only when there are no commas.",
            "É o contrário: a oração restringe o grupo só quando não há vírgulas.",
          ),
          t(
            "Swaps the restrictive and the explanatory clause",
            "Inverte a oração restritiva e a explicativa",
          ),
        ),
        bankOption(
          t(
            'The commas are an error, since a comma can never come before "who"',
            'As vírgulas são um erro, pois nunca se usa vírgula antes de "que"',
          ),
          t(
            'A comma before "who" is correct when the clause explains rather than restricts.',
            'A vírgula antes de "que" é correta quando a oração explica em vez de restringir.',
          ),
          t("Overgeneralizes a punctuation rule", "Generaliza demais uma regra de pontuação"),
        ),
        bankOption(
          t(
            "The commas stress that the report cards arrived late",
            "As vírgulas reforçam que os boletins chegaram atrasados",
          ),
          t(
            "Nothing in the sentence is about time. The commas act only on the clause they enclose.",
            "Nada na frase fala de tempo. As vírgulas agem só sobre a oração que isolam.",
          ),
          t(
            "Gives the commas a meaning the sentence doesn't support",
            "Atribui às vírgulas um sentido que a frase não sustenta",
          ),
        ),
      ],
      question: t(
        "What do the commas do in the printed sentence?",
        "Qual é o efeito das vírgulas na frase publicada?",
      ),
    },
    difficulty: 1,
    exam: "enem",
    format: "multipleChoice",
    key: "punctuation-explanatory-clause",
    skill: "punctuation-syntax",
  },
  {
    content: {
      context: t(
        "A car travels 180 km on 15 liters of ethanol. The driver plans a 300 km trip on the same kind of road.",
        "Um carro percorre 180 km com 15 litros de etanol. O motorista planeja uma viagem de 300 km no mesmo tipo de estrada.",
      ),
      options: [
        bankOption(
          t("25 liters", "25 litros"),
          t(
            "Distance and fuel grow together: 15 × 300 ÷ 180 = 25.",
            "Distância e combustível crescem juntos: 15 × 300 ÷ 180 = 25.",
          ),
        ),
        bankOption(
          t("9 liters", "9 litros"),
          t(
            "A longer trip needs more fuel, not less: the proportion was set up upside down.",
            "Uma viagem mais longa precisa de mais combustível, não menos: a proporção foi montada invertida.",
          ),
          t("Set up the proportion upside down", "Montou a proporção invertida"),
        ),
        bankOption(
          t("12 liters", "12 litros"),
          t(
            "180 ÷ 15 = 12 is the car's mileage in km per liter, not the fuel the trip needs.",
            "180 ÷ 15 = 12 é o rendimento do carro em km por litro, não o combustível que a viagem pede.",
          ),
          t(
            "Answered with the mileage instead of the liters needed",
            "Respondeu com o rendimento em vez dos litros necessários",
          ),
        ),
        bankOption(
          t("20 liters", "20 litros"),
          t(
            "Dividing the new distance by the old liters mixes the two quantities. Use the mileage of 12 km per liter.",
            "Dividir a nova distância pelos litros antigos mistura as duas grandezas. Use o rendimento de 12 km por litro.",
          ),
          t(
            "Divided the new distance by the liters given",
            "Dividiu a nova distância pelos litros dados",
          ),
        ),
        bankOption(
          t("135 liters", "135 litros"),
          t(
            "120 more kilometers doesn't mean 120 more liters: each liter covers 12 km.",
            "120 quilômetros a mais não significam 120 litros a mais: cada litro rende 12 km.",
          ),
          t(
            "Added the extra distance to the liters as if both changed by the same amount",
            "Somou a distância extra aos litros como se as duas grandezas mudassem na mesma quantidade",
          ),
        ),
      ],
      question: t(
        "Keeping the same consumption, how much ethanol will the trip use?",
        "Mantendo o mesmo consumo, quanto etanol a viagem vai gastar?",
      ),
    },
    difficulty: 1,
    exam: "enem",
    format: "multipleChoice",
    key: "rule-of-three-ethanol-trip",
    skill: "rule-of-three",
  },
];
