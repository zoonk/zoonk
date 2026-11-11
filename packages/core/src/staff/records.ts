import { parseStaffInput, staffCountSchema, staffGetSchema, staffListSchema } from "./input";
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
  const call = { ...logInput(input), verb: "get" };

  return staffRead<{ record: unknown }>({
    call,
    run: async () => {
      const parsed = parseStaffInput(staffGetSchema, input);
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
  });
}

export function listStaffRecords(input: unknown) {
  return staffRead({
    call: { ...logInput(input), verb: "list" },
    run: async () => {
      const parsed = parseStaffInput(staffListSchema, input);
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
  });
}

export function countStaffRecords(input: unknown) {
  return staffRead({
    call: { ...logInput(input), verb: "count" },
    run: async () => {
      const parsed = parseStaffInput(staffCountSchema, input);
      const model = requireStaffModel(parsed.model);
      const where = staffWhere({ filters: parsed.where, model });

      const count = await staffTransaction((client) =>
        staffDelegate({ client, model }).count({ where }),
      );

      return { data: { count }, rows: count };
    },
  });
}

function logInput(input: unknown) {
  if (!input || typeof input !== "object") {
    return {};
  }

  const parsed = staffListSchema
    .pick({ model: true, where: true })
    .safeParse({
      model: "model" in input ? input.model : undefined,
      where: "where" in input ? input.where : undefined,
    });

  return parsed.success ? { ...parsed.data, id: "id" in input ? input.id : undefined } : {};
}
