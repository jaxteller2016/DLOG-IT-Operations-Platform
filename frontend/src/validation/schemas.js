import { z } from 'zod';

const trimmedRequiredString = z.string().trim().min(1, 'This field is required');
const ALPHANUMERIC_DASH_REGEX = /^[A-Za-z0-9-]+$/;

const assetStatusValues = ['Online', 'Offline', 'Maintenance', 'Unknown'];
const incidentStatusValues = ['Open', 'In Progress', 'Resolved'];
const priorityValues = ['Low', 'Medium', 'High'];

const dateTimeInputString = z.string().trim().min(1, 'This field is required').refine(
  (value) => !Number.isNaN(new Date(value).getTime()),
  'Invalid date/time value'
);

export const assetCreateSchema = z.object({
  assetId: trimmedRequiredString.regex(
    ALPHANUMERIC_DASH_REGEX,
    'assetId may contain only letters, numbers, and -'
  ),
  serialNumber: trimmedRequiredString.regex(
    ALPHANUMERIC_DASH_REGEX,
    'serialNumber may contain only letters, numbers, and -'
  ),
  category: trimmedRequiredString,
  siteId: trimmedRequiredString,
  status: z.enum(assetStatusValues)
});

export const incidentCreateSchema = z.object({
  incidentNumber: trimmedRequiredString,
  siteId: trimmedRequiredString,
  assetId: trimmedRequiredString,
  priority: z.enum(priorityValues),
  category: trimmedRequiredString,
  description: trimmedRequiredString,
  assignedTechnician: z.string().optional(),
  status: z.enum(incidentStatusValues),
  createdAt: dateTimeInputString,
  responseDeadline: dateTimeInputString,
  resolutionDeadline: dateTimeInputString,
  resolutionNotes: z.string().optional()
}).superRefine((payload, context) => {
  const createdAt = new Date(payload.createdAt);
  const responseDeadline = new Date(payload.responseDeadline);
  const resolutionDeadline = new Date(payload.resolutionDeadline);

  if (responseDeadline < createdAt || resolutionDeadline < createdAt) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['responseDeadline'],
      message: 'Deadlines must be after creation date'
    });
  }

  if (resolutionDeadline < responseDeadline) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['resolutionDeadline'],
      message: 'Resolution deadline must be after response deadline'
    });
  }
});

export function firstValidationError(error) {
  if (!error?.issues?.length) return 'Validation failed';
  const issue = error.issues[0];
  if (!issue.path?.length) return issue.message;
  return `${issue.path.join('.')}: ${issue.message}`;
}