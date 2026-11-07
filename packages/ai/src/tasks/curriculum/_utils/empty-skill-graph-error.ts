export class EmptySkillGraphError extends Error {
  constructor() {
    super("A skill graph needs at least one course, one phase and one skill.");
    this.name = "EmptySkillGraphError";
  }
}
