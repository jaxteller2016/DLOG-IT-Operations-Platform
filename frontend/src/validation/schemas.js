import { z } from 'zod';

const trimmedRequiredString = z.string().trim().min(1, 'This field is required');
const optionalTrimmedString = z.preprocess(
  (value) => {
    if (typeof value !== 'string') return value;
    const trimmedValue = value.trim();
    return trimmedValue === '' ? undefined : trimmedValue;
  },
  z.string().min(1, 'This field is required').optional()
);

const ALPHANUMERIC_DASH_REGEX = /^[A-Za-z0-9-]+$/;
const ALPHANUMERIC_REGEX = /^[A-Za-z0-9]+$/;
const LETTERS_ONLY_REGEX = /^[A-Za-z]+$/;
const IPV4_CHAR_REGEX = /^[0-9.]+$/;
const MAC_ADDRESS_CHAR_REGEX = /^[A-Fa-f0-9:]+$/;
const MODEL_CHAR_REGEX = /^[A-Za-z0-9 ]+$/;
const OS_CHAR_REGEX = /^[A-Za-z0-9. ]+$/;
const EMAIL_MESSAGE = 'Enter a valid email address';

const assetStatusValues = ['Online', 'Offline', 'Maintenance', 'Unknown'];
const incidentStatusValues = ['Open', 'In Progress', 'Resolved'];
const priorityValues = ['Low', 'Medium', 'High'];

const dateTimeInputString = z.string().trim().min(1, 'This field is required').refine(
  (value) => !Number.isNaN(new Date(value).getTime()),
  'Invalid date/time value'
);

export const loginSchema = z.object({
  email: trimmedRequiredString.email(EMAIL_MESSAGE),
  password: trimmedRequiredString
});

export const assetCreateSchema = z.object({
  assetId: trimmedRequiredString.regex(
    ALPHANUMERIC_DASH_REGEX,
    'Asset ID must contain only letters, numbers, and -'
  ),
  heartbeatSourceId: optionalTrimmedString.refine(
    (value) => value === undefined || ALPHANUMERIC_DASH_REGEX.test(value),
    'Heartbeat source ID must contain only letters, numbers, and -'
  ),
  serialNumber: trimmedRequiredString.regex(
    ALPHANUMERIC_REGEX,
    'Serial must contain only letters and numbers'
  ),
  category: trimmedRequiredString,
  manufacturer: optionalTrimmedString.refine(
    (value) => value === undefined || LETTERS_ONLY_REGEX.test(value),
    'Manufacturer must contain only letters'
  ),
  model: optionalTrimmedString.refine(
    (value) => value === undefined || MODEL_CHAR_REGEX.test(value),
    'Model must contain only letters, numbers, and spaces'
  ),
  siteId: trimmedRequiredString,
  assignedEmployee: optionalTrimmedString.refine(
    (value) => value === undefined || z.email().safeParse(value).success,
    EMAIL_MESSAGE
  ),
  ipAddress: optionalTrimmedString.refine(
    (value) => value === undefined || IPV4_CHAR_REGEX.test(value),
    'IP address must contain only numbers and .'
  ),
  macAddress: optionalTrimmedString.refine(
    (value) => value === undefined || MAC_ADDRESS_CHAR_REGEX.test(value),
    'MAC address must contain only letters, numbers, and :'
  ),
  operatingSystem: optionalTrimmedString.refine(
    (value) => value === undefined || OS_CHAR_REGEX.test(value),
    'Operating system must contain only letters, numbers, spaces, and .'
  ),
  purchaseDate: z.string().optional(),
  warrantyExpirationDate: z.string().optional(),
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

export function fieldErrorsFromZod(error) {
  if (!error?.issues?.length) return {};

  return error.issues.reduce((accumulator, issue) => {
    const path = issue.path?.[0];
    if (!path || accumulator[path]) return accumulator;
    accumulator[path] = issue.message;
    return accumulator;
  }, {});
}