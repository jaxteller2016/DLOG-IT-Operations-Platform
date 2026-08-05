const { z } = require('zod');

const PRIORITY_VALUES = ['Low', 'Medium', 'High'];
const INCIDENT_STATUS_VALUES = ['Open', 'In Progress', 'Resolved'];
const ASSET_STATUS_VALUES = ['Online', 'Offline', 'Maintenance', 'Unknown'];
const ALPHANUMERIC_DASH_REGEX = /^[A-Za-z0-9-]+$/;

const trimmedRequiredString = z.string().trim().min(1);
const optionalTrimmedString = z.preprocess(
  (value) => (typeof value === 'string' ? value.trim() : value),
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
  serialNumber: trimmedRequiredString.regex(
    ALPHANUMERIC_DASH_REGEX,
    'serialNumber may contain only letters, numbers, and -'
  ),
  category: trimmedRequiredString,
  siteId: trimmedRequiredString,
  manufacturer: z.string().optional(),
  model: z.string().optional(),
  assignedEmployee: z.string().optional(),
  ipAddress: z.string().optional(),
  macAddress: z.string().optional(),
  operatingSystem: z.string().optional(),
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