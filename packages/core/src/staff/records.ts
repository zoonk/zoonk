import { staffCountSchema, staffGetSchema, staffListSchema } from "./input";
import {
  requireStaffModel,
  staffDelegate,
  staffId,
  staffOrder,
  staffSelect,
  staffWhere,
} from "./query";
import { staffRead, staffTransaction } from "./read";
import { serializeStaffValue } from "./serialize";

export function getStaffRecord(input: unknown) {
  return staffRead<{ record: unknown }, ReturnType<typeof staffGetSchema.parse>>({
    call: { verb: "get" },
    input,
    run: async (parsed) => {
      const model = requireStaffModel(parsed.model);
      const where = staffId({ id: parsed.id, model });

      const record = await staffTransaction((client) =>
        staffDelegate({ client, model }).findUnique({ select: staffSelect(model), where }),
      );

      if (record === null) {
        return { rows: 0, status: "notFound" };
      }

      return { data: { record: serializeStaffValue(record) }, rows: 1 };
    },
    schema: staffGetSchema,
  });
}

export function listStaffRecords(input: unknown) {
  return staffRead({
    call: { verb: "list" },
    input,
    run: async (parsed) => {
      const model = requireStaffModel(parsed.model);
      const where = staffWhere({ filters: parsed.where, model });
      const orderBy = staffOrder({ model, orderBy: parsed.orderBy });

      const records = await staffTransaction((client) =>
        staffDelegate({ client, model }).findMany({
          orderBy,
          select: staffSelect(model),
          skip: parsed.offset,
          take: parsed.limit + 1,
          where,
        }),
      );

      return {
        data: {
          hasMore: records.length > parsed.limit,
          records: serializeStaffValue(records.slice(0, parsed.limit)),
        },
        rows: Math.min(records.length, parsed.limit),
      };
    },
    schema: staffListSchema,
  });
}

export function countStaffRecords(input: unknown) {
  return staffRead({
    call: { verb: "count" },
    input,
    run: async (parsed) => {
      const model = requireStaffModel(parsed.model);
      const where = staffWhere({ filters: parsed.where, model });

      const count = await staffTransaction((client) =>
        staffDelegate({ client, model }).count({ where }),
      );

      return { data: { count }, rows: count };
    },
    schema: staffCountSchema,
  });
}
