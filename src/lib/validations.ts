import { z } from "zod";

const PolicyTypeSchema = z.enum([
  "motor",
  "medical",
  "fire",
  "life",
  "personal-accident",
  "marine",
  "workman-compensation",
  "travel",
]);

export const customerSchema = z.object({
  type: PolicyTypeSchema,
  customerName: z.string().min(1, "Customer name is required").trim(),
  phone: z.string().min(1, "Phone number is required").trim(),
  email: z.string().email("Invalid email").or(z.literal("")).optional(),
  address: z.string().trim().optional(),
  policyNumber: z.string().min(1, "Policy number is required").trim(),
  premiumAmount: z.union([z.string(), z.number()]).transform((val) => String(val)),
  sumInsured: z.union([z.string(), z.number()]).transform((val) => String(val)).optional(),
  startDate: z.string().refine((val) => !isNaN(Date.parse(val)), "Invalid start date"),
  endDate: z.string().refine((val) => !isNaN(Date.parse(val)), "Invalid end date"),
  // Accept any additional fields for the specific policy type under `details` or at the root.
  // We pass them through to Mongoose which has its own type-flexibility in this project.
}).passthrough();

export const customerUpdateSchema = customerSchema.partial().passthrough();

export function escapeRegExp(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}
