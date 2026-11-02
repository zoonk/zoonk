import { t } from "../../_utils/localize";
import { bankOption } from "../content";
import { type SeedItem } from "../types";

/** With the course's other items, every phase of a seeded plan has enough for its challenge. */
export const foundationsChallengeItems: SeedItem[] = [
  {
    content: {
      context: null,
      options: [
        bankOption(
          t("It's moving at its top speed", "Ele está na sua maior velocidade"),
          t(
            "Steepness is how fast the position changes: the steepest moment is the fastest one.",
            "A inclinação é a rapidez com que a posição muda: o momento mais inclinado é o mais rápido.",
          ),
        ),
        bankOption(
          t(
            "It's the farthest it gets from the start",
            "Ele está o mais longe possível da partida",
          ),
          t(
            "Distance from the start is the value of the position, not its steepness. The car keeps going after 3 s.",
            "A distância da partida é o valor da posição, não sua inclinação. O carro continua andando depois de 3 s.",
          ),
          t(
            "Confuses a function's value with its slope",
            "Confunde o valor da função com sua inclinação",
          ),
        ),
        bankOption(
          t("It's speeding up the hardest", "Ele está acelerando com mais força"),
          t(
            "The steepness of the position gives the speed. How fast the speed changes is another rate, the acceleration.",
            "A inclinação da posição dá a velocidade. A rapidez com que a velocidade muda é outra taxa, a aceleração.",
          ),
          t("Confuses speed with acceleration", "Confunde velocidade com aceleração"),
        ),
        bankOption(
          t(
            "Its speed equals its average speed over the first 3 s",
            "Sua velocidade é igual à velocidade média nos primeiros 3 s",
          ),
          t(
            "The average covers all 3 seconds. The steepness at t = 3 s is the speed at that one instant.",
            "A média cobre os 3 segundos inteiros. A inclinação em t = 3 s é a velocidade naquele instante.",
          ),
          t(
            "Confuses the speed at an instant with the average speed",
            "Confunde a velocidade num instante com a velocidade média",
          ),
        ),
      ],
      question: t(
        "Over a 10-second drive, a car's position over time is steepest at t = 3 s. What does that tell you about the car at that moment?",
        "Num trajeto de 10 segundos, a posição de um carro ao longo do tempo tem a maior inclinação em t = 3 s. O que isso diz sobre o carro nesse instante?",
      ),
    },
    difficulty: -1,
    format: "multipleChoice",
    key: "derivative-steepest-moment",
    skill: "derivative",
  },
  {
    content: {
      context: null,
      math: {
        answer: 16,
        commonMistakes: [
          {
            expression: "a * time^2",
            misconception: t(
              "Gave the distance instead of the speed",
              "Deu a distância em vez da velocidade",
            ),
            reason: t(
              "That's how far the ball has gone. Speed is how fast the distance grows, which is its derivative.",
              "Isso é quanto a bola já percorreu. A velocidade é a rapidez com que a distância cresce, ou seja, a derivada.",
            ),
          },
          {
            expression: "a * time",
            misconception: t(
              "Divided the distance by the time, which gives the average speed",
              "Dividiu a distância pelo tempo, o que dá a velocidade média",
            ),
            reason: t(
              "Distance over time is the average since the start. The ball keeps speeding up, so at that instant it's twice as fast.",
              "Distância sobre tempo é a média desde o início. A bola vai acelerando, então nesse instante ela está duas vezes mais rápida.",
            ),
          },
        ],
        solution: "2 * a * time",
        steps: [
          {
            expression: null,
            text: t(
              "Speed is the derivative of the distance: the derivative of {a}t² is 2 × {a} × t.",
              "A velocidade é a derivada da distância: a derivada de {a}t² é 2 × {a} × t.",
            ),
          },
          {
            expression: "2 * a * time",
            text: t(
              "At t = {time} s: 2 × {a} × {time} = {result} m/s",
              "Em t = {time} s: 2 × {a} × {time} = {result} m/s",
            ),
          },
        ],
        tolerance: { kind: "relative", value: 0.01 },
        unit: "m/s",
        variables: [
          { max: 5, min: 1, name: "a", step: 0.5, unit: null, value: 2 },
          { max: 10, min: 1, name: "time", step: 1, unit: "s", value: 4 },
        ],
      },
      question: t(
        "A ball rolls down a ramp, and the distance it has covered after t seconds is d = {a}t² meters. How fast is it moving at t = {time} s, in m/s?",
        "Uma bola desce uma rampa, e a distância percorrida depois de t segundos é d = {a}t² metros. Qual é a velocidade dela em t = {time} s, em m/s?",
      ),
    },
    difficulty: 0,
    format: "numeric",
    key: "derivative-ramp-speed",
    skill: "derivative",
  },
  {
    content: {
      context: null,
      options: [
        bankOption(
          t(
            "At that moment, it's cooling by 2 °C each minute",
            "Naquele momento, ele está esfriando 2 °C por minuto",
          ),
          t(
            "A rate at one instant says how fast the temperature is changing right then; the minus sign means it's going down.",
            "Uma taxa num instante diz quão rápido a temperatura está mudando naquele momento; o sinal de menos indica que ela está caindo.",
          ),
        ),
        bankOption(
          t("The coffee is at −2 °C", "O café está a −2 °C"),
          t(
            "−2 is how fast the temperature changes, not the temperature itself. Hot coffee is far above zero.",
            "−2 é a rapidez com que a temperatura muda, não a própria temperatura. Café quente está bem acima de zero.",
          ),
          t(
            "Confuses the rate of change with the value",
            "Confunde a taxa de variação com o valor",
          ),
        ),
        bankOption(
          t(
            "It has cooled 2 °C in total since it was poured",
            "Ele esfriou 2 °C no total desde que foi servido",
          ),
          t(
            "The total drop over five minutes is a different number. The rate is how fast it's cooling at minute five.",
            "A queda total em cinco minutos é outro número. A taxa é a rapidez do resfriamento no minuto cinco.",
          ),
          t(
            "Confuses a rate at one instant with the total change",
            "Confunde a taxa num instante com a variação total",
          ),
        ),
        bankOption(
          t(
            "It will keep losing 2 °C every minute until it's cold",
            "Ele vai continuar perdendo 2 °C por minuto até esfriar",
          ),
          t(
            "Coffee cools more slowly as it nears room temperature, so the rate changes from moment to moment.",
            "O café esfria mais devagar conforme se aproxima da temperatura ambiente, então a taxa muda de um momento para outro.",
          ),
          t(
            "Thinks a rate at one instant stays the same forever",
            "Acha que a taxa de um instante vale para sempre",
          ),
        ),
      ],
      question: t(
        "A cup of coffee cools on a table. Five minutes after it's poured, the rate of change of its temperature is −2 °C per minute. What does that mean?",
        "Uma xícara de café esfria sobre a mesa. Cinco minutos depois de servido, a taxa de variação da temperatura dele é de −2 °C por minuto. O que isso significa?",
      ),
    },
    difficulty: 0,
    format: "multipleChoice",
    key: "derivative-cooling-rate",
    skill: "derivative",
  },
  {
    content: {
      context: null,
      options: [
        bankOption(
          t(
            "Take the average speed over shorter and shorter intervals starting at t = 2 s, and see what it settles on",
            "Calcular a velocidade média em intervalos cada vez menores a partir de t = 2 s e ver de que valor ela se aproxima",
          ),
          t(
            "As the interval shrinks toward nothing, the average speed closes in on the speed at that instant: the derivative.",
            "Quando o intervalo encolhe até quase nada, a velocidade média se aproxima da velocidade naquele instante: a derivada.",
          ),
        ),
        bankOption(
          t("Divide the position at t = 2 s by 2 s", "Dividir a posição em t = 2 s por 2 s"),
          t(
            "That's the average speed over the first 2 seconds. The runner may be faster or slower right at t = 2 s.",
            "Isso é a velocidade média nos 2 primeiros segundos. O corredor pode estar mais rápido ou mais lento exatamente em t = 2 s.",
          ),
          t(
            "Uses the average since the start as the speed at an instant",
            "Usa a média desde a largada como velocidade num instante",
          ),
        ),
        bankOption(
          t(
            "Subtract the position at t = 1 s from the position at t = 2 s",
            "Subtrair a posição em t = 1 s da posição em t = 2 s",
          ),
          t(
            "That's the average over a whole second. The speed can change a lot within it.",
            "Isso é a média num segundo inteiro. A velocidade pode mudar bastante dentro dele.",
          ),
          t(
            "Thinks the change over a whole second is the speed at an instant",
            "Acha que a variação num segundo inteiro é a velocidade num instante",
          ),
        ),
        bankOption(
          t(
            "You can't: at a single instant the runner covers no distance",
            "Não dá: num único instante o corredor não percorre distância nenhuma",
          ),
          t(
            "Zero distance over zero time means nothing on its own, but the averages over shrinking intervals approach a definite number.",
            "Zero de distância em zero de tempo não diz nada sozinho, mas as médias em intervalos cada vez menores se aproximam de um número definido.",
          ),
          t(
            "Thinks speed at an instant can't exist",
            "Acha que não existe velocidade num instante",
          ),
        ),
      ],
      question: t(
        "You know a runner's position at every moment. How do you find their exact speed at t = 2 s?",
        "Você sabe a posição de um corredor em cada momento. Como achar a velocidade exata dele em t = 2 s?",
      ),
    },
    difficulty: 1,
    format: "multipleChoice",
    key: "derivative-shrinking-intervals",
    skill: "derivative",
  },
  {
    content: {
      context: null,
      options: [
        bankOption(
          t("5x⁴", "5x⁴"),
          t(
            "Bring the power down as a factor and lower it by one: 5x⁴.",
            "Desça o expoente como fator e diminua-o em um: 5x⁴.",
          ),
        ),
        bankOption(
          t("5x⁵", "5x⁵"),
          t(
            "The power must also drop by one, from 5 to 4.",
            "O expoente também precisa cair um, de 5 para 4.",
          ),
          t(
            "Multiplied by the power but didn't lower it",
            "Multiplicou pelo expoente mas não o diminuiu",
          ),
        ),
        bankOption(
          t("x⁴", "x⁴"),
          t(
            "The old power, 5, becomes a factor in front.",
            "O expoente antigo, 5, vira um fator na frente.",
          ),
          t(
            "Lowered the power but didn't multiply by it",
            "Diminuiu o expoente mas não multiplicou por ele",
          ),
        ),
        bankOption(
          t("5x⁶", "5x⁶"),
          t(
            "Differentiating lowers the power by one. Raising it is what integrating does.",
            "Derivar diminui o expoente em um. Aumentá-lo é o que a integral faz.",
          ),
          t("Raised the power instead of lowering it", "Aumentou o expoente em vez de diminuí-lo"),
        ),
      ],
      question: t("What is the derivative of f(x) = x⁵?", "Qual é a derivada de f(x) = x⁵?"),
    },
    difficulty: -1,
    format: "multipleChoice",
    key: "power-rule-x-fifth",
    skill: "derivative-rules",
  },
  {
    content: {
      context: null,
      isTrue: false,
      misconception: t(
        "Thinks a constant survives differentiation",
        "Acha que a constante continua depois de derivar",
      ),
      reason: t(
        "A constant never changes, so its rate of change is 0. The derivative is just 2x.",
        "Uma constante nunca muda, então sua taxa de variação é 0. A derivada é só 2x.",
      ),
      statement: t("The derivative of x² + 7 is 2x + 7.", "A derivada de x² + 7 é 2x + 7."),
    },
    difficulty: 0,
    format: "trueFalse",
    key: "power-rule-constant-term",
    skill: "derivative-rules",
  },
  {
    content: {
      context: null,
      math: {
        answer: 96,
        commonMistakes: [
          {
            expression: "a * point^3",
            misconception: t(
              "Gave the function's value instead of its slope",
              "Deu o valor da função em vez da inclinação",
            ),
            reason: t(
              "Plugging x into f gives the function's value. The slope comes from the derivative.",
              "Substituir x em f dá o valor da função. A inclinação vem da derivada.",
            ),
          },
          {
            expression: "3 * a * point^3",
            misconception: t(
              "Multiplied by the power but didn't lower it",
              "Multiplicou pelo expoente mas não o diminuiu",
            ),
            reason: t(
              "The power rule also lowers the power by one: x³ becomes 3x².",
              "A regra da potência também diminui o expoente em um: x³ vira 3x².",
            ),
          },
        ],
        solution: "3 * a * point^2",
        steps: [
          {
            expression: null,
            text: t(
              "Power rule: the derivative of {a}x³ is 3 × {a}x².",
              "Regra da potência: a derivada de {a}x³ é 3 × {a}x².",
            ),
          },
          {
            expression: "3 * a * point^2",
            text: t(
              "At x = {point}: 3 × {a} × {point}² = {result}",
              "Em x = {point}: 3 × {a} × {point}² = {result}",
            ),
          },
        ],
        tolerance: { kind: "relative", value: 0.01 },
        unit: null,
        variables: [
          { max: 5, min: 1, name: "a", step: 1, unit: null, value: 2 },
          { max: 8, min: 4, name: "point", step: 1, unit: null, value: 4 },
        ],
      },
      question: t(
        "What is the slope of f(x) = {a}x³ at x = {point}?",
        "Qual é a inclinação de f(x) = {a}x³ em x = {point}?",
      ),
    },
    difficulty: 1,
    format: "numeric",
    key: "power-rule-slope-at-point",
    skill: "derivative-rules",
  },
  {
    content: {
      context: null,
      options: [
        bankOption(
          t("The distance it traveled", "A distância que ele percorreu"),
          t(
            "Speed times time is distance, and that's exactly the area: a height of 80 times a width of 3.",
            "Velocidade vezes tempo é distância, e essa é exatamente a área: altura 80 vezes largura 3.",
          ),
        ),
        bankOption(
          t("Its average speed", "A velocidade média dele"),
          t(
            "The speed is the height of the line. The area adds that speed up over the whole trip.",
            "A velocidade é a altura da linha. A área soma essa velocidade ao longo de toda a viagem.",
          ),
          t("Confuses the area with the height", "Confunde a área com a altura"),
        ),
        bankOption(
          t("Its acceleration", "A aceleração dele"),
          t(
            "Acceleration is the slope of the speed line, which is flat here: zero.",
            "A aceleração é a inclinação da linha da velocidade, que aqui é plana: zero.",
          ),
          t("Confuses the area with the slope", "Confunde a área com a inclinação"),
        ),
        bankOption(
          t("How long the trip took", "Quanto tempo a viagem levou"),
          t(
            "The trip's length in time is only the width, 3 hours. The area multiplies it by the speed.",
            "A duração da viagem é só a largura, 3 horas. A área multiplica isso pela velocidade.",
          ),
          t("Takes the width for the whole area", "Toma a largura pela área inteira"),
        ),
      ],
      question: t(
        "A train runs at a steady 80 km/h for 3 hours. Take the area under its speed over time, from 0 to 3 hours. What does that area stand for?",
        "Um trem anda a 80 km/h constantes por 3 horas. Considere a área sob a velocidade dele ao longo do tempo, de 0 a 3 horas. O que essa área representa?",
      ),
    },
    difficulty: -1,
    format: "multipleChoice",
    key: "integral-area-meaning",
    skill: "integral",
  },
  {
    content: {
      context: null,
      isTrue: false,
      misconception: t(
        "Confuses an accumulated total with a final value",
        "Confunde o total acumulado com o valor final",
      ),
      reason: t(
        "The integral adds up speed over time, which gives the distance covered in those 10 seconds, not the speed at the end.",
        "A integral soma a velocidade ao longo do tempo, o que dá a distância percorrida nesses 10 segundos, não a velocidade no fim.",
      ),
      statement: t(
        "Integrating a car's speed from t = 0 to t = 10 s gives its speed at t = 10 s.",
        "Integrar a velocidade de um carro de t = 0 a t = 10 s dá a velocidade dele em t = 10 s.",
      ),
    },
    difficulty: 0,
    format: "trueFalse",
    key: "integral-speed-total",
    skill: "integral",
  },
  {
    content: {
      context: null,
      math: {
        answer: 40,
        commonMistakes: [
          {
            expression: "speed * time",
            misconception: t(
              "Used the final speed for the whole ride",
              "Usou a velocidade final no percurso todo",
            ),
            reason: t(
              "The cyclist only reaches that speed at the end. The area under the speed is a triangle, half of the rectangle.",
              "O ciclista só chega a essa velocidade no fim. A área sob a velocidade é um triângulo, metade do retângulo.",
            ),
          },
          {
            expression: "speed / time",
            misconception: t(
              "Found the acceleration instead of the distance",
              "Calculou a aceleração em vez da distância",
            ),
            reason: t(
              "Speed divided by time is how much the speed grows each second. Distance is the area under the speed.",
              "Velocidade dividida pelo tempo é quanto a velocidade cresce por segundo. Distância é a área sob a velocidade.",
            ),
          },
        ],
        solution: "speed * time / 2",
        steps: [
          {
            expression: null,
            text: t(
              "The distance is the area under the speed over time: a triangle with base {time} s and height {speed} m/s.",
              "A distância é a área sob a velocidade ao longo do tempo: um triângulo de base {time} s e altura {speed} m/s.",
            ),
          },
          {
            expression: "speed * time / 2",
            text: t(
              "Half of base times height: {speed} × {time} ÷ 2 = {result} m",
              "Metade de base vezes altura: {speed} × {time} ÷ 2 = {result} m",
            ),
          },
        ],
        tolerance: { kind: "relative", value: 0.01 },
        unit: "m",
        variables: [
          { max: 12, min: 4, name: "speed", step: 1, unit: "m/s", value: 8 },
          { max: 20, min: 4, name: "time", step: 2, unit: "s", value: 10 },
        ],
      },
      question: t(
        "A cyclist starts from rest and speeds up steadily, reaching {speed} m/s after {time} s. How far does the cyclist travel in that time, in meters?",
        "Um ciclista parte do repouso e acelera de forma constante, chegando a {speed} m/s depois de {time} s. Que distância ele percorre nesse tempo, em metros?",
      ),
    },
    difficulty: 1,
    format: "numeric",
    key: "integral-cyclist-distance",
    skill: "integral",
  },
  {
    content: {
      context: null,
      options: [
        bankOption(
          t(
            "Each positive number goes to a number that, squared, gives it back",
            "Cada número positivo vai para um número que, elevado ao quadrado, resulta nele",
          ),
          t(
            "4 could go to 2 or to −2. A function gives each input exactly one output.",
            "O 4 poderia ir para 2 ou para −2. Uma função dá exatamente uma saída para cada entrada.",
          ),
        ),
        bankOption(
          t(
            "Each person goes to their biological mother",
            "Cada pessoa vai para sua mãe biológica",
          ),
          t(
            "Siblings share a mother, and that's fine: each person still has exactly one.",
            "Irmãos têm a mesma mãe, e tudo bem: cada pessoa continua tendo exatamente uma.",
          ),
          t(
            "Thinks two inputs can't share an output",
            "Acha que duas entradas não podem ter a mesma saída",
          ),
        ),
        bankOption(
          t("Each number goes to its square", "Cada número vai para o seu quadrado"),
          t(
            "2 and −2 both give 4, but each input still has only one square.",
            "2 e −2 dão 4, mas cada entrada continua tendo um único quadrado.",
          ),
          t(
            "Thinks a function can't give the same output twice",
            "Acha que uma função não pode repetir uma saída",
          ),
        ),
        bankOption(
          t(
            "Each hour of a day goes to the temperature outside at that hour",
            "Cada hora do dia vai para a temperatura lá fora naquela hora",
          ),
          t(
            "No formula is needed: each hour has exactly one temperature.",
            "Não precisa de fórmula: cada hora tem exatamente uma temperatura.",
          ),
          t("Thinks a function needs a formula", "Acha que uma função precisa de uma fórmula"),
        ),
      ],
      question: t(
        "Which of these rules is not a function?",
        "Qual destas regras não é uma função?",
      ),
    },
    difficulty: 0,
    format: "multipleChoice",
    key: "function-which-is-not",
    skill: "function-concept",
  },
  {
    content: {
      context: null,
      options: [
        bankOption(
          t("50 + 80m = 450", "50 + 80m = 450"),
          t(
            "The fee is paid once and the $80 once a month, so the total is 50 plus 80 times m.",
            "A matrícula é paga uma vez e os R$ 80 uma vez por mês, então o total é 50 mais 80 vezes m.",
          ),
        ),
        bankOption(
          t("80 + 50m = 450", "80 + 50m = 450"),
          t(
            "The $50 is paid once; it's the $80 that repeats every month.",
            "Os R$ 50 são pagos uma vez; são os R$ 80 que se repetem todo mês.",
          ),
          t(
            "Swapped the one-time fee and the monthly price",
            "Trocou a taxa única pelo preço mensal",
          ),
        ),
        bankOption(
          t("80m = 450", "80m = 450"),
          t(
            "The $450 also includes the $50 sign-up fee.",
            "Os R$ 450 também incluem os R$ 50 da matrícula.",
          ),
          t("Left out the one-time fee", "Deixou a taxa única de fora"),
        ),
        bankOption(
          t("(50 + 80)m = 450", "(50 + 80)m = 450"),
          t(
            "The sign-up fee is paid only once, not with each month.",
            "A matrícula é paga só uma vez, não a cada mês.",
          ),
          t("Charged the sign-up fee every month", "Cobrou a matrícula todo mês"),
        ),
      ],
      question: t(
        "A gym charges a $50 sign-up fee plus $80 a month. You've paid $450 in total. Which equation gives the number of months, m?",
        "Uma academia cobra R$ 50 de matrícula mais R$ 80 por mês. Você já pagou R$ 450 no total. Qual equação dá o número de meses, m?",
      ),
    },
    difficulty: 0,
    format: "multipleChoice",
    key: "equation-gym-months",
    skill: "model-equation",
  },
  {
    content: {
      context: t(
        "A phone's battery level falls along a straight line: 100% at the start and 20% after 8 hours.",
        "O nível de bateria de um celular cai em linha reta: 100% no início e 20% depois de 8 horas.",
      ),
      options: [
        bankOption(
          t("60%", "60%"),
          t(
            "Halfway in time is halfway down the line, and halfway between 100% and 20% is 60%.",
            "Na metade do tempo, a linha está na metade da descida, e a metade entre 100% e 20% é 60%.",
          ),
        ),
        bankOption(
          t("50%", "50%"),
          t(
            "The line ends at 20%, not 0%, so halfway is between 100% and 20%.",
            "A linha termina em 20%, não em 0%, então a metade fica entre 100% e 20%.",
          ),
          t(
            "Took half of 100% instead of reading the line",
            "Pegou metade de 100% em vez de ler a linha",
          ),
        ),
        bankOption(
          t("40%", "40%"),
          t(
            "By 4 hours it has dropped 40 points, so the level is 100% minus that.",
            "Em 4 horas ela caiu 40 pontos, então o nível é 100% menos isso.",
          ),
          t("Read how much it fell instead of the level", "Leu quanto caiu em vez do nível"),
        ),
        bankOption(
          t("10%", "10%"),
          t(
            "20% is where the line ends, after 8 hours. At 4 hours it's much higher.",
            "20% é onde a linha termina, depois de 8 horas. Em 4 horas ela está bem mais alta.",
          ),
          t(
            "Halved the final level instead of reading the line",
            "Dividiu o nível final ao meio em vez de ler a linha",
          ),
        ),
      ],
      question: t(
        "Reading that line at 4 hours, what battery level do you get?",
        "Lendo essa linha em 4 horas, qual nível de bateria você encontra?",
      ),
    },
    difficulty: -1,
    format: "multipleChoice",
    key: "graph-battery-level",
    skill: "read-graph",
  },
  {
    content: {
      context: t(
        "Taxi A charges $5 to start plus $2 per km. Taxi B charges $10 to start plus $1.50 per km.",
        "O táxi A cobra R$ 5 de bandeirada mais R$ 2 por km. O táxi B cobra R$ 10 de bandeirada mais R$ 1,50 por km.",
      ),
      isTrue: false,
      misconception: t(
        "Confuses the starting value with the slope",
        "Confunde o valor inicial com a inclinação",
      ),
      reason: t(
        "The slope is how much the fare rises per km: $2 for A and $1.50 for B. A's fare rises faster, even though B starts higher.",
        "A inclinação é quanto o preço sobe por km: R$ 2 no A e R$ 1,50 no B. O preço do A sobe mais rápido, mesmo o B começando mais alto.",
      ),
      statement: t(
        "Taxi B's fare rises faster with distance, because it starts higher.",
        "O preço do táxi B sobe mais rápido com a distância, porque começa mais alto.",
      ),
    },
    difficulty: 0,
    format: "trueFalse",
    key: "slope-taxi-start-fee",
    skill: "slope",
  },
  {
    content: {
      context: null,
      math: {
        answer: 6,
        commonMistakes: [
          {
            expression: "(c + b) / a",
            misconception: t(
              "Added the number instead of subtracting it from both sides",
              "Somou o número em vez de subtraí-lo dos dois lados",
            ),
            reason: t(
              "To undo the addition on the left, subtract that number from both sides.",
              "Para desfazer a soma do lado esquerdo, subtraia esse número dos dois lados.",
            ),
          },
          {
            expression: "c / a - b",
            misconception: t(
              "Divided only one side's term before subtracting",
              "Dividiu só um dos termos antes de subtrair",
            ),
            reason: t(
              "Dividing first means dividing every term, the added number too. Subtracting first is simpler.",
              "Dividir primeiro exige dividir todos os termos, inclusive o número somado. Subtrair primeiro é mais simples.",
            ),
          },
          {
            expression: "c - b",
            misconception: t(
              "Forgot to divide by the number in front of x",
              "Esqueceu de dividir pelo número que multiplica o x",
            ),
            reason: t(
              "After subtracting, x is still multiplied, so divide both sides by that number.",
              "Depois de subtrair, o x ainda está multiplicado, então divida os dois lados por esse número.",
            ),
          },
        ],
        solution: "(c - b) / a",
        steps: [
          {
            expression: "c - b",
            text: t(
              "Subtract {b} from both sides: {a}x = {result}",
              "Subtraia {b} dos dois lados: {a}x = {result}",
            ),
          },
          {
            expression: "(c - b) / a",
            text: t(
              "Divide both sides by {a}: x = {result}",
              "Divida os dois lados por {a}: x = {result}",
            ),
          },
        ],
        tolerance: { kind: "relative", value: 0.01 },
        unit: null,
        variables: [
          { max: 9, min: 2, name: "a", step: 1, unit: null, value: 4 },
          { max: 20, min: 1, name: "b", step: 1, unit: null, value: 6 },
          { max: 90, min: 21, name: "c", step: 1, unit: null, value: 30 },
        ],
      },
      question: t("Solve {a}x + {b} = {c}. What is x?", "Resolva {a}x + {b} = {c}. Quanto vale x?"),
    },
    difficulty: -1,
    format: "numeric",
    key: "linear-solve-for-x",
    skill: "solve-linear",
  },
  {
    content: {
      context: null,
      math: {
        answer: 9.9,
        commonMistakes: [
          {
            expression: "2 * 9.8 * height",
            misconception: t("Forgot the square root", "Esqueceu a raiz quadrada"),
            reason: t(
              "2 × g × h gives the speed squared; take the square root to get the speed.",
              "2 × g × h dá a velocidade ao quadrado; tire a raiz quadrada para achar a velocidade.",
            ),
          },
          {
            expression: "sqrt(9.8 * height)",
            misconception: t(
              "Dropped the ½ from the motion energy",
              "Esqueceu o ½ da energia de movimento",
            ),
            reason: t(
              "m·g·h = ½·m·v², so v² = 2·g·h, not g·h.",
              "m·g·h = ½·m·v², então v² = 2·g·h, e não g·h.",
            ),
          },
        ],
        solution: "sqrt(2 * 9.8 * height)",
        steps: [
          {
            expression: null,
            text: t(
              "Height energy turns into motion energy: m·g·h = ½·m·v², and the mass cancels.",
              "A energia da altura vira energia de movimento: m·g·h = ½·m·v², e a massa se cancela.",
            ),
          },
          {
            expression: "2 * 9.8 * height",
            text: t("v² = 2 × 9.8 × {height} = {result}", "v² = 2 × 9,8 × {height} = {result}"),
          },
          { expression: "sqrt(2 * 9.8 * height)", text: t("v = {result} m/s", "v = {result} m/s") },
        ],
        tolerance: { kind: "relative", value: 0.02 },
        unit: "m/s",
        variables: [{ max: 20, min: 1, name: "height", step: 1, unit: "m", value: 5 }],
      },
      question: t(
        "A skateboarder starts from rest at the top of a ramp {height} m high. Ignoring friction, how fast are they going at the bottom, in m/s? Use g = 9.8 m/s².",
        "Um skatista parte do repouso no alto de uma rampa de {height} m de altura. Sem atrito, qual é a velocidade dele lá embaixo, em m/s? Use g = 9,8 m/s².",
      ),
    },
    difficulty: 0,
    format: "numeric",
    key: "energy-skateboard-ramp",
    skill: "energy-conservation",
  },
  {
    content: {
      context: null,
      options: [
        bankOption(
          t(
            "They're the same: both turned the same height into motion",
            "São iguais: as duas transformaram a mesma altura em movimento",
          ),
          t(
            "Without friction, the speed at the bottom depends only on the height dropped, not on the path.",
            "Sem atrito, a velocidade lá embaixo depende só da altura descida, não do caminho.",
          ),
        ),
        bankOption(
          t(
            "The falling box is faster, because it goes straight down",
            "A caixa que cai é mais rápida, porque desce em linha reta",
          ),
          t(
            "The path changes how long the trip takes, not how much height energy becomes speed.",
            "O caminho muda quanto tempo a descida leva, não quanta energia da altura vira velocidade.",
          ),
          t(
            "Thinks the path changes the final speed",
            "Acha que o caminho muda a velocidade final",
          ),
        ),
        bankOption(
          t(
            "The ramp box is faster, because it has longer to speed up",
            "A caixa da rampa é mais rápida, porque tem mais tempo para acelerar",
          ),
          t(
            "On the ramp it speeds up more gently for longer. It ends with the same energy, so the same speed.",
            "Na rampa ela acelera mais devagar por mais tempo. Termina com a mesma energia, então com a mesma velocidade.",
          ),
          t(
            "Thinks a longer path builds more speed",
            "Acha que um caminho mais longo dá mais velocidade",
          ),
        ),
        bankOption(
          t(
            "The falling box is faster, because it gets there first",
            "A caixa que cai é mais rápida, porque chega primeiro",
          ),
          t(
            "It does arrive first, but the ramp box arrives with the same speed, just later.",
            "Ela chega primeiro, sim, mas a caixa da rampa chega com a mesma velocidade, só que depois.",
          ),
          t(
            "Confuses arriving first with arriving faster",
            "Confunde chegar primeiro com chegar mais rápido",
          ),
        ),
      ],
      question: t(
        "Two identical boxes start from rest at the same height. One falls straight down; the other slides down a long, frictionless ramp. Ignoring air, how do their speeds compare at the bottom?",
        "Duas caixas iguais partem do repouso na mesma altura. Uma cai em linha reta; a outra desliza por uma rampa longa e sem atrito. Desprezando o ar, como se comparam as velocidades delas lá embaixo?",
      ),
    },
    difficulty: 1,
    format: "multipleChoice",
    key: "energy-fall-or-slide",
    skill: "energy-conservation",
  },
  {
    content: {
      context: null,
      math: {
        answer: 2.5,
        commonMistakes: [
          {
            expression: "force * mass",
            misconception: t("Multiplied force by mass", "Multiplicou a força pela massa"),
            reason: t(
              "F = m·a, so a = F ÷ m: a heavier cart speeds up less, not more.",
              "F = m·a, então a = F ÷ m: um carrinho mais pesado acelera menos, não mais.",
            ),
          },
          {
            expression: "mass / force",
            misconception: t("Divided mass by force", "Dividiu a massa pela força"),
            reason: t(
              "Acceleration grows with the push, so the force goes on top.",
              "A aceleração cresce com o empurrão, então a força vai no numerador.",
            ),
          },
        ],
        solution: "force / mass",
        steps: [
          {
            expression: "force / mass",
            text: t(
              "a = F ÷ m = {force} ÷ {mass} = {result} m/s²",
              "a = F ÷ m = {force} ÷ {mass} = {result} m/s²",
            ),
          },
        ],
        tolerance: { kind: "relative", value: 0.01 },
        unit: "m/s²",
        variables: [
          { max: 100, min: 20, name: "force", step: 10, unit: "N", value: 50 },
          { max: 40, min: 10, name: "mass", step: 5, unit: "kg", value: 20 },
        ],
      },
      question: t(
        "A net force of {force} N pushes a {mass} kg shopping cart. What is its acceleration, in m/s²?",
        "Uma força resultante de {force} N empurra um carrinho de supermercado de {mass} kg. Qual é a aceleração dele, em m/s²?",
      ),
    },
    difficulty: -1,
    format: "numeric",
    key: "newton-cart-acceleration",
    skill: "newton-second-law",
  },
  {
    content: {
      context: null,
      options: [
        bankOption(
          t("Zero: your push just balances friction", "Zero: seu empurrão só equilibra o atrito"),
          t(
            "Constant speed means zero acceleration, and F = m·a then gives zero net force.",
            "Velocidade constante significa aceleração zero, e F = m·a então dá força resultante zero.",
          ),
        ),
        bankOption(
          t(
            "Equal to your push, in the direction it moves",
            "Igual ao seu empurrão, no sentido do movimento",
          ),
          t(
            "Friction pushes back as hard as you push. If your push were the net force, the box would keep speeding up.",
            "O atrito empurra de volta com a mesma força. Se o seu empurrão fosse a força resultante, a caixa continuaria acelerando.",
          ),
          t(
            "Ignores friction and thinks motion needs a net force",
            "Ignora o atrito e acha que movimento exige força resultante",
          ),
        ),
        bankOption(
          t(
            "A little more than friction, to keep it moving",
            "Um pouco mais que o atrito, para mantê-la em movimento",
          ),
          t(
            "Any extra force would make it speed up. Keeping a speed needs no net force.",
            "Qualquer força a mais faria a caixa acelerar. Manter a velocidade não exige força resultante.",
          ),
          t(
            "Thinks steady motion needs an unbalanced force",
            "Acha que movimento constante precisa de força desequilibrada",
          ),
        ),
        bankOption(
          t("It grows the faster the box moves", "Ela cresce quanto mais rápido a caixa anda"),
          t(
            "Net force sets the acceleration, not the speed. At any steady speed it's zero.",
            "A força resultante define a aceleração, não a velocidade. Em qualquer velocidade constante, ela é zero.",
          ),
          t(
            "Thinks force is proportional to speed",
            "Acha que a força é proporcional à velocidade",
          ),
        ),
      ],
      question: t(
        "You push a heavy box across the floor at a constant speed. What is the net force on the box?",
        "Você empurra uma caixa pesada pelo chão com velocidade constante. Qual é a força resultante sobre a caixa?",
      ),
    },
    difficulty: 1,
    format: "multipleChoice",
    key: "newton-constant-speed-push",
    skill: "newton-second-law",
  },
  {
    content: {
      context: null,
      options: [
        bankOption(
          t(
            "Yes: its charge creates the field, whether or not anything is there to feel it",
            "Sim: a carga dele cria o campo, haja ou não algo ali para senti-lo",
          ),
          t(
            "A field belongs to the space around a charge. Another charge only reveals it by being pushed or pulled.",
            "O campo pertence ao espaço em volta da carga. Outra carga só o revela ao ser empurrada ou puxada.",
          ),
        ),
        bankOption(
          t(
            "No: a field only appears when another charge comes close",
            "Não: o campo só aparece quando outra carga chega perto",
          ),
          t(
            "The field is there all along; a second charge just feels a push or pull from it.",
            "O campo está lá o tempo todo; uma segunda carga só sente o empurrão ou o puxão dele.",
          ),
          t(
            "Thinks a field exists only when something feels it",
            "Acha que o campo só existe quando algo o sente",
          ),
        ),
        bankOption(
          t(
            "Only on the balloon's surface, where the charge sits",
            "Só na superfície do balão, onde a carga está",
          ),
          t(
            "The field spreads through the space around the balloon, weaker the farther you go.",
            "O campo se espalha pelo espaço em volta do balão, mais fraco quanto mais longe.",
          ),
          t(
            "Thinks the field stays on the charged object",
            "Acha que o campo fica preso ao objeto carregado",
          ),
        ),
        bankOption(
          t("Only if the balloon is moving", "Só se o balão estiver se movendo"),
          t(
            "A charge at rest already has an electric field. A moving charge adds a magnetic one.",
            "Uma carga parada já tem campo elétrico. Uma carga em movimento acrescenta um campo magnético.",
          ),
          t(
            "Confuses electric fields with magnetic ones",
            "Confunde campo elétrico com campo magnético",
          ),
        ),
      ],
      question: t(
        "A charged balloon hangs alone in a room, with no other charges nearby. Is there an electric field around it?",
        "Um balão carregado está sozinho numa sala, sem outras cargas por perto. Existe campo elétrico em volta dele?",
      ),
    },
    difficulty: 0,
    format: "multipleChoice",
    key: "field-charged-balloon",
    skill: "electric-field",
  },
  {
    content: {
      context: null,
      options: [
        bankOption(
          t(
            "Its electric and magnetic fields keep creating each other, so it needs no material",
            "Seus campos elétrico e magnético se criam um ao outro, então ela não precisa de matéria",
          ),
          t(
            "A changing electric field makes a magnetic one and the other way around, so the wave carries itself.",
            "Um campo elétrico variável cria um magnético e vice-versa, então a onda se sustenta sozinha.",
          ),
        ),
        bankOption(
          t(
            "Space is full of thin air that carries it",
            "O espaço está cheio de um ar rarefeito que a transporta",
          ),
          t(
            "Space is almost a perfect vacuum, and light doesn't need a medium anyway.",
            "O espaço é quase um vácuo perfeito, e a luz nem precisa de meio.",
          ),
          t(
            "Thinks light needs a medium, like sound",
            "Acha que a luz precisa de um meio, como o som",
          ),
        ),
        bankOption(
          t(
            "In space it stops being a wave and travels only as particles",
            "No espaço ela deixa de ser onda e viaja só como partícula",
          ),
          t(
            "Light is an electromagnetic wave everywhere, in a vacuum too.",
            "A luz é uma onda eletromagnética em todo lugar, no vácuo também.",
          ),
          t(
            "Thinks light switches between wave and particle depending on where it is",
            "Acha que a luz alterna entre onda e partícula conforme o lugar",
          ),
        ),
        bankOption(
          t(
            "It shakes the few atoms out there, the way sound does",
            "Ela faz vibrar os poucos átomos que existem lá, como o som",
          ),
          t(
            "Sound needs matter to vibrate. Light is made of fields, so it moves fastest where there's no matter at all.",
            "O som precisa de matéria para vibrar. A luz é feita de campos, então ela anda mais rápido justamente onde não há matéria.",
          ),
          t("Confuses light with mechanical waves", "Confunde a luz com ondas mecânicas"),
        ),
      ],
      question: t(
        "Sunlight crosses about 150 million km of nearly empty space to reach Earth. How can it travel with nothing to wave through?",
        "A luz do Sol atravessa cerca de 150 milhões de km de espaço quase vazio até chegar à Terra. Como ela consegue viajar sem um meio para ondular?",
      ),
    },
    difficulty: 0,
    format: "multipleChoice",
    key: "em-wave-empty-space",
    skill: "em-wave",
  },
  {
    content: {
      context: null,
      options: [
        bankOption(
          t("Almost nothing: the waves cancel", "Quase nada: as ondas se cancelam"),
          t(
            "Crest on trough adds up to nearly zero, so the sound almost disappears at that spot.",
            "Crista com vale soma quase zero, então o som quase some naquele ponto.",
          ),
        ),
        bankOption(
          t("The note twice as loud", "A nota duas vezes mais alta"),
          t(
            "That happens where crest meets crest. Crest on trough cancels.",
            "Isso acontece onde crista encontra crista. Crista com vale se cancela.",
          ),
          t(
            "Thinks overlapping waves always add up",
            "Acha que ondas sobrepostas sempre se reforçam",
          ),
        ),
        bankOption(
          t("A higher note", "Uma nota mais aguda"),
          t(
            "Overlapping waves change how loud it is, not the note: both speakers play the same frequency.",
            "Ondas sobrepostas mudam o volume, não a nota: as duas caixas tocam a mesma frequência.",
          ),
          t("Thinks interference changes the pitch", "Acha que a interferência muda a nota"),
        ),
        bankOption(
          t(
            "Both speakers clearly, one after the other",
            "As duas caixas com clareza, uma depois da outra",
          ),
          t(
            "Where waves overlap, they add at every instant. Here they add up to almost zero.",
            "Onde as ondas se sobrepõem, elas se somam a cada instante. Aqui, a soma dá quase zero.",
          ),
          t(
            "Thinks waves pass through each other without adding",
            "Acha que as ondas passam uma pela outra sem se somar",
          ),
        ),
      ],
      question: t(
        "Two speakers play the same steady note. At one spot, each crest from one speaker arrives together with a trough from the other. What do you hear there?",
        "Duas caixas de som tocam a mesma nota contínua. Em certo ponto, cada crista de uma chega junto com um vale da outra. O que você ouve ali?",
      ),
    },
    difficulty: 0,
    format: "multipleChoice",
    key: "interference-two-speakers",
    skill: "interference",
  },
  {
    content: {
      context: null,
      isTrue: false,
      misconception: t(
        "Thinks cancellation destroys energy",
        "Acha que o cancelamento destrói energia",
      ),
      reason: t(
        "Energy is conserved: it shifts to the spots nearby where the waves add up, which get louder or brighter.",
        "A energia se conserva: ela se desloca para os pontos vizinhos onde as ondas se somam, que ficam mais fortes ou mais claros.",
      ),
      statement: t(
        "Where two waves cancel each other out, their energy is destroyed.",
        "Onde duas ondas se cancelam, a energia delas é destruída.",
      ),
    },
    difficulty: 1,
    format: "trueFalse",
    key: "interference-energy-cancel",
    skill: "interference",
  },
  {
    content: {
      context: null,
      math: {
        answer: 3,
        commonMistakes: [
          {
            expression: "300000000 / frequency",
            misconception: t(
              "Forgot that MHz means millions of waves per second",
              "Esqueceu que MHz são milhões de ondas por segundo",
            ),
            reason: t(
              "One MHz is a million waves per second. Leaving the million out makes each wave a million times too long.",
              "Um MHz é um milhão de ondas por segundo. Sem o milhão, cada onda fica um milhão de vezes longa demais.",
            ),
          },
          {
            expression: "frequency * 1000000 / 300000000",
            misconception: t("Divided frequency by speed", "Dividiu a frequência pela velocidade"),
            reason: t(
              "From v = λf, the wavelength is the speed divided by the frequency.",
              "De v = λf, o comprimento de onda é a velocidade dividida pela frequência.",
            ),
          },
        ],
        solution: "300000000 / (frequency * 1000000)",
        steps: [
          {
            expression: null,
            text: t(
              "From v = λf, the wavelength is λ = v ÷ f.",
              "De v = λf, o comprimento de onda é λ = v ÷ f.",
            ),
          },
          {
            expression: "300000000 / (frequency * 1000000)",
            text: t(
              "λ = 300,000,000 ÷ ({frequency} × 1,000,000) = {result} m",
              "λ = 300.000.000 ÷ ({frequency} × 1.000.000) = {result} m",
            ),
          },
        ],
        tolerance: { kind: "relative", value: 0.01 },
        unit: "m",
        variables: [{ max: 108, min: 88, name: "frequency", step: 0.5, unit: "MHz", value: 100 }],
      },
      question: t(
        "An FM station broadcasts at {frequency} MHz, that is, {frequency} million waves per second. Radio waves travel at 300,000,000 m/s. How long is each wave, in meters?",
        "Uma rádio FM transmite em {frequency} MHz, ou seja, {frequency} milhões de ondas por segundo. As ondas de rádio viajam a 300.000.000 m/s. Qual é o comprimento de cada onda, em metros?",
      ),
    },
    difficulty: 0,
    format: "numeric",
    key: "wavelength-fm-station",
    skill: "wave-equation",
  },
  {
    content: {
      context: null,
      options: [
        bankOption(
          t("It gets about four times longer", "Fica cerca de quatro vezes maior"),
          t(
            "With v = λf and f fixed, the wavelength grows in step with the speed.",
            "Com v = λf e f fixa, o comprimento de onda cresce junto com a velocidade.",
          ),
        ),
        bankOption(
          t("It gets about four times shorter", "Fica cerca de quatro vezes menor"),
          t(
            "Shorter waves at the same frequency would travel slower, not faster.",
            "Ondas mais curtas na mesma frequência andariam mais devagar, não mais rápido.",
          ),
          t("Thinks faster waves are shorter", "Acha que ondas mais rápidas são mais curtas"),
        ),
        bankOption(
          t("It stays the same, since it's the same sound", "Continua igual, já que é o mesmo som"),
          t(
            "The pitch comes from the frequency, which stays. The wavelength changes with the speed.",
            "A altura do som vem da frequência, que se mantém. O comprimento de onda muda com a velocidade.",
          ),
          t(
            "Thinks the same pitch means the same wavelength",
            "Acha que a mesma nota significa o mesmo comprimento de onda",
          ),
        ),
        bankOption(
          t("It depends on how loud the sound is", "Depende de quão alto o som está"),
          t(
            "Loudness is the size of the wave, its amplitude. The wavelength comes from speed and frequency.",
            "O volume é o tamanho da onda, a amplitude. O comprimento de onda vem da velocidade e da frequência.",
          ),
          t("Confuses loudness with wavelength", "Confunde volume com comprimento de onda"),
        ),
      ],
      question: t(
        "A sound goes from air into water, where it travels about four times faster. Its frequency stays the same. What happens to its wavelength?",
        "Um som passa do ar para a água, onde viaja cerca de quatro vezes mais rápido. A frequência continua a mesma. O que acontece com o comprimento de onda?",
      ),
    },
    difficulty: 1,
    format: "multipleChoice",
    key: "wavelength-sound-into-water",
    skill: "wave-equation",
  },
];
