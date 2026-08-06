const { z } = require('zod');

const PRIORITY_VALUES = ['Low', 'Medium', 'High'];
const INCIDENT_STATUS_VALUES = ['Open', 'In Progress', 'Resolved'];
const ASSET_STATUS_VALUES = ['Online', 'Offline', 'Maintenance', 'Unknown'];
const ALPHANUMERIC_DASH_REGEX = /^[A-Za-z0-9-]+$/;
const ALPHANUMERIC_REGEX = /^[A-Za-z0-9]+$/;
const LETTERS_ONLY_REGEX = /^[A-Za-z]+$/;
const IPV4_CHAR_REGEX = /^[0-9.]+$/;
const MAC_ADDRESS_CHAR_REGEX = /^[A-Fa-f0-9:]+$/;
const MODEL_CHAR_REGEX = /^[A-Za-z0-9 ]+$/;
const OS_CHAR_REGEX = /^[A-Za-z0-9. ]+$/;

const trimmedRequiredString = z.string().trim().min(1);
const optionalTrimmedString = z.preprocess(
  (value) => {
    if (typeof value !== 'string') return value;
    const trimmedValue = value.trim();
    return trimmedValue === '' ? undefined : trimmedValue;
  },
  z.string().min(1).optional()
);

const isoDateString = z.string().trim().refine(
  (value) => !Number.isNaN(new Date(value).getTime()),
  { message: 'must be a valid ISO date string' }
);

const createAssetSchema = z.object({
  assetId: optionalTrimmedString.refine(
    (value) => value === undefined || ALPHANUMERIC_DASH_REGEX.test(value),
    { message: 'assetId may contain only letters, numbers, and -' }
  ),
  heartbeatSourceId: optionalTrimmedString.refine(
    (value) => value === undefined || ALPHANUMERIC_DASH_REGEX.test(value),
    { message: 'heartbeatSourceId may contain only letters, numbers, and -' }
  ),
  serialNumber: trimmedRequiredString.regex(
    ALPHANUMERIC_REGEX,
    'serialNumber may contain only letters and numbers'
  ),
  category: trimmedRequiredString,
  siteId: trimmedRequiredString,
  manufacturer: optionalTrimmedString.refine(
    (value) => value === undefined || LETTERS_ONLY_REGEX.test(value),
    { message: 'manufacturer may contain only letters' }
  ),
  model: optionalTrimmedString.refine(
    (value) => value === undefined || MODEL_CHAR_REGEX.test(value),
    { message: 'model may contain only letters, numbers, and spaces' }
  ),
  assignedEmployee: optionalTrimmedString.refine(
    (value) => value === undefined || z.email().safeParse(value).success,
    { message: 'assignedEmployee must be a valid email address' }
  ),
  ipAddress: optionalTrimmedString.refine(
    (value) => value === undefined || IPV4_CHAR_REGEX.test(value),
    { message: 'ipAddress may contain only numbers and .' }
  ),
  macAddress: optionalTrimmedString.refine(
    (value) => value === undefined || MAC_ADDRESS_CHAR_REGEX.test(value),
    { message: 'macAddress may contain only letters, numbers, and :' }
  ),
  operatingSystem: optionalTrimmedString.refine(
    (value) => value === undefined || OS_CHAR_REGEX.test(value),
    { message: 'operatingSystem may contain only letters, numbers, spaces, and .' }
  ),
  purchaseDate: z.string().optional(),
  warrantyExpirationDate: z.string().optional(),
  status: z.enum(ASSET_STATUS_VALUES).optional(),
  notes: z.string().optional()
});

const createIncidentSchema = z.object({
  incidentNumber: optionalTrimmedString,
  siteId: trimmedRequiredString,
  assetId: trimmedRequiredString,
  priority: z.enum(PRIORITY_VALUES),
  category: trimmedRequiredString,
  description: trimmedRequiredString,
  assignedTechnician: z.string().optional(),
  status: z.enum(INCIDENT_STATUS_VALUES).optional(),
  responseDeadline: isoDateString,
  resolutionDeadline: isoDateString,
  resolutionNotes: z.string().optional()
}).superRefine((payload, context) => {
  const now = new Date();
  const responseDue = new Date(payload.responseDeadline);
  const resolutionDue = new Date(payload.resolutionDeadline);

  if (responseDue < now || resolutionDue < now) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Deadlines must be in the future relative to creation date',
      path: ['responseDeadline']
    });
  }

  if (resolutionDue < responseDue) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'resolutionDeadline must be after or equal to responseDeadline',
      path: ['resolutionDeadline']
    });
  }
});

function formatZodError(error) {
  return error.issues.map((issue) => {
    const path = issue.path.length > 0 ? `${issue.path.join('.')}: ` : '';
    return `${path}${issue.message}`;
  }).join('; ');
}

module.exports = {
  createAssetSchema,
  createIncidentSchema,
  formatZodError
};