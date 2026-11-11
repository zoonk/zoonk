import { z } from "zod";

const STUDY_TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/u;

export const studyTimeSchema = z
  .string()
  .regex(STUDY_TIME_PATTERN)
  .meta({ description: 'Preferred local study time, such as "20:00"' });
