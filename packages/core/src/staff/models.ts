import { staffRead } from "./read";
import { describeModels } from "./registry";

export function getStaffModels() {
  return staffRead({
    call: { verb: "models" },
    run: () => {
      const models = describeModels();
      return Promise.resolve({ data: { models }, rows: models.length });
    },
  });
}
