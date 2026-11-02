import { z } from "zod";

const SUNDAY = 0;
const SATURDAY = 6;

export const weekdayNumberSchema = z.int().min(SUNDAY).max(SATURDAY);
