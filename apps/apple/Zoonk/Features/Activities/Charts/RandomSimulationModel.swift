import Foundation

enum RandomSimulationFields: Decodable, Hashable, Sendable {
  struct Hit: Decodable, Hashable, Sendable {
    enum Comparison: String, Decodable, Sendable {
      case atLeast, atMost, exactly
    }

    let comparison: Comparison
    let value: Int

    func matches(_ value: Int) -> Bool {
      switch comparison {
      case .atLeast: value >= self.value
      case .atMost: value <= self.value
      case .exactly: value == self.value
      }
    }
  }

  enum Model: Decodable, Hashable, Sendable {
    case binomial(trials: Int, probability: Double, hit: Hit)
    case diceSum(count: Int, sides: Int, hit: Hit)
    case sharedBirthday(people: Int, days: Int)

    private enum CodingKeys: String, CodingKey {
      case kind, trials, probability, hit, count, sides, people, days
    }

    init(from decoder: any Decoder) throws {
      let container = try decoder.container(keyedBy: CodingKeys.self)

      switch try container.decode(String.self, forKey: .kind) {
      case "binomial":
        self = .binomial(
          trials: try container.decode(Int.self, forKey: .trials),
          probability: try container.decode(Double.self, forKey: .probability),
          hit: try container.decode(Hit.self, forKey: .hit))
      case "diceSum":
        self = .diceSum(
          count: try container.decode(Int.self, forKey: .count),
          sides: try container.decode(Int.self, forKey: .sides),
          hit: try container.decode(Hit.self, forKey: .hit))
      default:
        self = .sharedBirthday(
          people: try container.decode(Int.self, forKey: .people),
          days: try container.decode(Int.self, forKey: .days))
      }
    }
  }

  enum Population: Decodable, Hashable, Sendable {
    case proportion(Double)
    case mean(Double, sd: Double)

    private enum CodingKeys: String, CodingKey {
      case kind, proportion, mean, sd
    }

    init(from decoder: any Decoder) throws {
      let container = try decoder.container(keyedBy: CodingKeys.self)

      if try container.decode(String.self, forKey: .kind) == "proportion" {
        self = .proportion(try container.decode(Double.self, forKey: .proportion))
      } else {
        self = .mean(
          try container.decode(Double.self, forKey: .mean),
          sd: try container.decode(Double.self, forKey: .sd))
      }
    }
  }

  struct Chance: Hashable, Sendable {
    let hitLabel: String
    let model: Model
    let runs: Int
    let trialLabel: String
  }

  struct Sampling: Hashable, Sendable {
    let population: Population
    let populationLabel: String
    let runs: Int
    let sampleSizes: [Int]
    let sizeLabel: String?
    let unit: String?
  }

  case chance(Chance)
  case sampling(Sampling)

  private enum CodingKeys: String, CodingKey {
    case mode, hitLabel, model, runs, trialLabel, population, populationLabel, sampleSizes
    case sizeLabel, unit
  }

  init(from decoder: any Decoder) throws {
    let container = try decoder.container(keyedBy: CodingKeys.self)
    let runs = try container.decode(Int.self, forKey: .runs)

    if try container.decode(String.self, forKey: .mode) == "chance" {
      self = .chance(
        Chance(
          hitLabel: try container.decode(String.self, forKey: .hitLabel),
          model: try container.decode(Model.self, forKey: .model), runs: runs,
          trialLabel: try container.decode(String.self, forKey: .trialLabel)))
    } else {
      self = .sampling(
        Sampling(
          population: try container.decode(Population.self, forKey: .population),
          populationLabel: try container.decode(String.self, forKey: .populationLabel),
          runs: runs, sampleSizes: try container.decode([Int].self, forKey: .sampleSizes),
          sizeLabel: try container.decodeIfPresent(String.self, forKey: .sizeLabel),
          unit: try container.decodeIfPresent(String.self, forKey: .unit)))
    }
  }
}

/// Mirrors main's `chance.ts`.
enum ChanceModel {
  static func isHit(_ model: RandomSimulationFields.Model, _ outcome: Int) -> Bool {
    switch model {
    case .binomial(_, _, let hit), .diceSum(_, _, let hit): hit.matches(outcome)
    case .sharedBirthday: outcome == 1
    }
  }

  /// Core's exact chance of a hit, the number the guess options are graded against.
  static func exactChance(_ model: RandomSimulationFields.Model) -> Double {
    switch model {
    case .binomial(let trials, let probability, let hit):
      ChartsMath.binomialHitProbability(trials: trials, probability: probability, hit: hit.matches)
    case .diceSum(let count, let sides, let hit):
      ChartsMath.diceSumHitProbability(count: count, sides: sides, hit: hit.matches)
    case .sharedBirthday(let people, let days):
      ChartsMath.sharedBirthdayProbability(people: people, days: days)
    }
  }

  static func run(_ model: RandomSimulationFields.Model, runs: Int, seed: Int) -> [Int] {
    var random = ChartsRandom(seed: seed)

    return (0..<runs).map { _ in
      switch model {
      case .binomial(let trials, let probability, _):
        return random.binomialCount(trials: trials, probability: probability)
      case .diceSum(let count, let sides, _):
        return (0..<count).reduce(0) { sum, _ in sum + Int(random.next() * Double(sides)) + 1 }
      case .sharedBirthday(let people, let days):
        let birthdays = (0..<people).map { _ in Int(random.next() * Double(days)) }
        return Set(birthdays).count < birthdays.count ? 1 : 0
      }
    }
  }

  static func outcomeCounts(_ outcomes: [Int]) -> [(outcome: Int, count: Int)] {
    guard let low = outcomes.min(), let high = outcomes.max() else {
      return []
    }

    var counts: [Int: Int] = [:]
    for outcome in outcomes {
      counts[outcome, default: 0] += 1
    }

    return (low...high).map { ($0, counts[$0] ?? 0) }
  }

  static func runningShare(_ hits: [Bool], points: Int) -> [(x: Int, y: Double)] {
    let every = max(Int((Double(hits.count) / Double(points)).rounded(.up)), 1)
    var total = 0

    return hits.enumerated().compactMap { index, hit in
      total += hit ? 1 : 0
      let isShown = (index + 1) % every == 0 || index == hits.count - 1
      return isShown ? (index + 1, Double(total) / Double(index + 1)) : nil
    }
  }
}

/// Mirrors main's `sampling.ts`.
enum SamplingModel {
  static func truth(_ population: RandomSimulationFields.Population) -> Double {
    switch population {
    case .proportion(let share): share
    case .mean(let mean, _): mean
    }
  }

  static func spread(_ population: RandomSimulationFields.Population) -> Double {
    switch population {
    case .proportion(let share): (share * (1 - share)).squareRoot()
    case .mean(_, let sd): sd
    }
  }

  /// Core's standard error, the number a sampling check reads.
  static func standardError(_ population: RandomSimulationFields.Population, size: Int) -> Double {
    spread(population) / Double(size).squareRoot()
  }

  /// One result per run. Polls up to 1,000 people ask each one; bigger ones draw from the normal
  /// curve the count follows, so 1,000 polls of 100,000 people stay instant.
  static func simulate(
    _ population: RandomSimulationFields.Population, runs: Int, seed: Int, size: Int
  ) -> [Double] {
    var random = ChartsRandom(seed: seed)
    let error = standardError(population, size: size)

    return (0..<runs).map { _ in
      switch population {
      case .mean(let mean, _):
        return mean + error * random.standardNormal()
      case .proportion(let share):
        if size <= 1000 {
          return Double(random.binomialCount(trials: size, probability: share)) / Double(size)
        }

        let count = ChartsMath.jsRound(
          Double(size) * (share + error * random.standardNormal()))
        return ChartsMath.clamp(count, 0, Double(size)) / Double(size)
      }
    }
  }

  /// Where the middle 95% of results landed: the range a poll's margin of error describes.
  static func middleRange(_ results: [Double]) -> ClosedRange<Double> {
    let sorted = results.sorted()

    guard !sorted.isEmpty else {
      return 0...0
    }

    let at = { (share: Double) in
      sorted[
        Int(
          ChartsMath.clamp(
            ChartsMath.jsRound(share * Double(sorted.count - 1)), 0, Double(sorted.count - 1))
        )
      ]
    }

    return at(0.025)...at(0.975)
  }

  /// The axis every size shares, wide enough for the smallest, so results visibly narrow.
  static func domain(_ population: RandomSimulationFields.Population, smallest: Int) -> ClosedRange<
    Double
  > {
    let reach = 3.5 * spread(population) / Double(smallest).squareRoot()
    let middle = truth(population)

    if case .proportion = population {
      return max(middle - reach, 0)...min(middle + reach, 1)
    }

    return (middle - reach)...(middle + reach)
  }

  struct Bin: Hashable {
    let from: Double
    let to: Double
    let count: Int
  }

  static func histogram(_ results: [Double], domain: ClosedRange<Double>) -> [Bin] {
    let binCount = 30
    let width = (domain.upperBound - domain.lowerBound) / Double(binCount)
    var counts = Array(repeating: 0, count: binCount)

    for value in results {
      let index = Int(
        ChartsMath.clamp(
          ((value - domain.lowerBound) / width).rounded(.down), 0, Double(binCount - 1)))
      counts[index] += 1
    }

    return counts.enumerated().map { index, count in
      Bin(
        from: domain.lowerBound + Double(index) * width,
        to: domain.lowerBound + Double(index + 1) * width, count: count)
    }
  }

  /// Digits that tell results apart at the current spread: whole numbers a few points apart,
  /// decimals for tighter ones.
  static func digits(margin: Double, population: RandomSimulationFields.Population) -> Int {
    var shown = margin

    if case .proportion = population {
      shown *= 100
    }

    return shown >= 2 ? 0 : shown >= 0.2 ? 1 : 2
  }
}
