const express = require('express');
const { authMiddleware, requireRole, userCanAccessSite, seedUsers } = require('../auth');
const { loadIncidents, findIncidentById, findIncidentByNumber, upsertIncident, logAuditEvent } = require('../dataStore');
const { createIncidentSchema, formatZodError } = require('../validation/schemas');

const router = express.Router();

function parsePaging(query) {
  const shouldPaginate = query.paginate === 'true' || query.page !== undefined || query.pageSize !== undefined;
  if (!shouldPaginate) return null;

  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const pageSize = Math.max(1, Math.min(200, Number.parseInt(query.pageSize, 10) || 20));
  return { page, pageSize };
}

function parseIsoDate(value) {
  if (typeof value !== 'string' || value.trim() === '') return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function buildIncidentNumberCandidate() {
  const randomSuffix = Math.floor(Math.random() * 900 + 100);
  return `INC-${Date.now()}-${randomSuffix}`;
}

function generateUniqueIncidentNumber() {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const candidate = buildIncidentNumberCandidate();
    if (!findIncidentByNumber(candidate)) return candidate;
  }

  throw new Error('Unable to generate a unique incident number');
}

function evaluateSla(deadline, completedAt, now) {
  if (!deadline) return 'unknown';
  if (completedAt) {
    return completedAt <= deadline ? 'within' : 'breach';
  }
  return now <= deadline ? 'within' : 'breach';
}

function enrichIncidentWithSla(incident) {
  const now = new Date();
  const responseDue = parseIsoDate(incident.responseDeadline);
  const resolutionDue = parseIsoDate(incident.resolutionDeadline);
  const firstResponseAt = parseIsoDate(incident.firstResponseAt);
  const resolvedAt = parseIsoDate(incident.resolvedAt);

  const responseSlaStatus = evaluateSla(responseDue, firstResponseAt, now);
  const resolutionSlaStatus = evaluateSla(resolutionDue, resolvedAt, now);
  const slaStatus = responseSlaStatus === 'breach' || resolutionSlaStatus === 'breach'
    ? 'breach'
    : responseSlaStatus === 'unknown' || resolutionSlaStatus === 'unknown'
      ? 'unknown'
      : 'within';

  return {
    ...incident,
    responseSlaStatus,
    resolutionSlaStatus,
    slaStatus
  };
}

router.get('/', authMiddleware, (req, res) => {
  const users = seedUsers();
  const currentUser = users.find((entry) => entry.id === req.user.id);
  const search = (req.query.search || '').toString().trim().toLowerCase();
  const status = (req.query.status || '').toString().trim();
  const priority = (req.query.priority || '').toString().trim();
  const siteId = (req.query.siteId || '').toString().trim();

  const filteredIncidents = loadIncidents().filter((incident) => {
    if (!userCanAccessSite(currentUser, incident.siteId)) return false;
    if (status && incident.status !== status) return false;
    if (priority && incident.priority !== priority) return false;
    if (siteId && incident.siteId !== siteId) return false;
    if (!search) return true;

    return incident.incidentNumber.toLowerCase().includes(search)
      || incident.assetId.toLowerCase().includes(search)
      || incident.description.toLowerCase().includes(search)
      || incident.siteId.toLowerCase().includes(search);
  });

  const incidentsWithSla = filteredIncidents.map((incident) => enrichIncidentWithSla(incident));

  const paging = parsePaging(req.query);
  if (!paging) {
    return res.json({ incidents: incidentsWithSla });
  }

  const total = incidentsWithSla.length;
  const totalPages = Math.max(1, Math.ceil(total / paging.pageSize));
  const page = Math.min(paging.page, totalPages);
  const start = (page - 1) * paging.pageSize;
  const incidents = incidentsWithSla.slice(start, start + paging.pageSize);

  return res.json({
    incidents,
    pagination: {
      page,
      pageSize: paging.pageSize,
      total,
      totalPages
    }
  });
});

router.get('/:id', authMiddleware, (req, res) => {
  const { id } = req.params;
  const users = seedUsers();
  const currentUser = users.find((entry) => entry.id === req.user.id);
  const incident = findIncidentById(id);

  if (!incident) {
    return res.status(404).json({ error: 'Incident not found' });
  }

  if (!userCanAccessSite(currentUser, incident.siteId)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  return res.json({ incident: enrichIncidentWithSla(incident) });
});

router.post('/', authMiddleware, requireRole('Administrator', 'IT Technician', 'Site Manager'), (req, res) => {
  const parsed = createIncidentSchema.safeParse(req.body || {});
  if (!parsed.success) {
    return res.status(400).json({ error: formatZodError(parsed.error) });
  }

  const { incidentNumber, siteId, assetId, priority, category, description, assignedTechnician, status, responseDeadline, resolutionDeadline, resolutionNotes } = parsed.data;
  const normalizedIncidentNumber = typeof incidentNumber === 'string' && incidentNumber.trim() ? incidentNumber.trim() : generateUniqueIncidentNumber();

  const duplicateIncident = findIncidentByNumber(normalizedIncidentNumber);
  if (duplicateIncident) {
    return res.status(409).json({ error: 'Duplicate incident number' });
  }

  const createdAt = new Date();
  const responseDue = parseIsoDate(responseDeadline);
  const resolutionDue = parseIsoDate(resolutionDeadline);

  const normalizedStatus = status || 'Open';
  const firstResponseAt = normalizedStatus === 'In Progress' || normalizedStatus === 'Resolved' ? createdAt.toISOString() : null;
  const resolvedAt = normalizedStatus === 'Resolved' ? createdAt.toISOString() : null;

  const incident = {
    id: `incident-${Date.now()}`,
    incidentNumber: normalizedIncidentNumber,
    siteId,
    assetId,
    priority,
    category,
    description,
    assignedTechnician: assignedTechnician || '',
    status: normalizedStatus,
    createdAt: createdAt.toISOString(),
    responseDeadline: responseDue.toISOString(),
    resolutionDeadline: resolutionDue.toISOString(),
    resolutionNotes: resolutionNotes || '',
    firstResponseAt,
    resolvedAt
  };

  const computedIncident = enrichIncidentWithSla(incident);

  upsertIncident(computedIncident);

  logAuditEvent({
    source: 'user',
    actor: req.user.email || req.user.id,
    entity: 'incident',
    entityId: computedIncident.id,
    action: 'create',
    previousValue: null,
    newValue: computedIncident
  });

  return res.status(201).json({ incident: computedIncident });
});

router.patch('/:id', authMiddleware, requireRole('Administrator', 'IT Technician', 'Site Manager'), (req, res) => {
  const { id } = req.params;
  const updates = req.body || {};
  const incident = findIncidentById(id);

  if (!incident) {
    return res.status(404).json({ error: 'Incident not found' });
  }

  const previousIncident = { ...incident };

  const allowedFields = ['status', 'assignedTechnician', 'resolutionNotes', 'priority', 'category', 'description', 'responseDeadline', 'resolutionDeadline'];
  allowedFields.forEach((field) => {
    if (updates[field] !== undefined) {
      incident[field] = updates[field];
    }
  });

  const responseDue = parseIsoDate(incident.responseDeadline);
  const resolutionDue = parseIsoDate(incident.resolutionDeadline);
  const createdAt = parseIsoDate(incident.createdAt);

  if (!responseDue || !resolutionDue || !createdAt) {
    return res.status(400).json({ error: 'Incident has invalid creation or deadline timestamps' });
  }

  if (responseDue < createdAt || resolutionDue < createdAt) {
    return res.status(400).json({ error: 'Deadlines cannot be before creation date' });
  }

  if (resolutionDue < responseDue) {
    return res.status(400).json({ error: 'resolutionDeadline must be after or equal to responseDeadline' });
  }

  const statusUpdated = updates.status !== undefined;
  const now = new Date().toISOString();
  if (statusUpdated && (incident.status === 'In Progress' || incident.status === 'Resolved') && !incident.firstResponseAt) {
    incident.firstResponseAt = now;
  }

  if (statusUpdated && incident.status === 'Resolved') {
    incident.resolvedAt = now;
  }

  if (statusUpdated && incident.status !== 'Resolved') {
    incident.resolvedAt = null;
  }

  const computedIncident = enrichIncidentWithSla(incident);

  upsertIncident(computedIncident);

  logAuditEvent({
    source: 'user',
    actor: req.user.email || req.user.id,
    entity: 'incident',
    entityId: computedIncident.id,
    action: 'update',
    previousValue: previousIncident,
    newValue: computedIncident
  });

  return res.json({ incident: computedIncident });
});

module.exports = router;
