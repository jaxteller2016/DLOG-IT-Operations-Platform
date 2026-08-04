const express = require('express');
const { authMiddleware, requireRole, userCanAccessSite, seedUsers } = require('../auth');
const { loadIncidents, findIncidentById, findIncidentByNumber, upsertIncident, logAuditEvent } = require('../dataStore');

const router = express.Router();

function parsePaging(query) {
  const shouldPaginate = query.paginate === 'true' || query.page !== undefined || query.pageSize !== undefined;
  if (!shouldPaginate) return null;

  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const pageSize = Math.max(1, Math.min(200, Number.parseInt(query.pageSize, 10) || 20));
  return { page, pageSize };
}

function calculateSlaStatus(responseDeadline, resolutionDeadline) {
  const now = new Date();
  const responseDue = new Date(responseDeadline);
  const resolutionDue = new Date(resolutionDeadline);

  if (responseDue < now || resolutionDue < now) return 'breach';
  return 'within';
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

  const paging = parsePaging(req.query);
  if (!paging) {
    return res.json({ incidents: filteredIncidents });
  }

  const total = filteredIncidents.length;
  const totalPages = Math.max(1, Math.ceil(total / paging.pageSize));
  const page = Math.min(paging.page, totalPages);
  const start = (page - 1) * paging.pageSize;
  const incidents = filteredIncidents.slice(start, start + paging.pageSize);

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

  return res.json({ incident });
});

router.post('/', authMiddleware, requireRole('Administrator', 'IT Technician', 'Site Manager'), (req, res) => {
  const { incidentNumber, siteId, assetId, priority, category, description, assignedTechnician, status, responseDeadline, resolutionDeadline, resolutionNotes } = req.body || {};

  if (!incidentNumber || !siteId || !assetId || !priority || !category || !description) {
    return res.status(400).json({ error: 'incidentNumber, siteId, assetId, priority, category, and description are required' });
  }

  const duplicateIncident = findIncidentByNumber(incidentNumber);
  if (duplicateIncident) {
    return res.status(409).json({ error: 'Duplicate incident number' });
  }

  const incident = {
    id: `incident-${Date.now()}`,
    incidentNumber,
    siteId,
    assetId,
    priority,
    category,
    description,
    assignedTechnician: assignedTechnician || '',
    status: status || 'Open',
    createdAt: new Date().toISOString(),
    responseDeadline: responseDeadline || new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(),
    resolutionDeadline: resolutionDeadline || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    resolutionNotes: resolutionNotes || '',
    slaStatus: calculateSlaStatus(responseDeadline || new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(), resolutionDeadline || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString())
  };

  upsertIncident(incident);

  logAuditEvent({
    source: 'user',
    actor: req.user.email || req.user.id,
    entity: 'incident',
    entityId: incident.id,
    action: 'create',
    previousValue: null,
    newValue: incident
  });

  return res.status(201).json({ incident });
});

router.patch('/:id', authMiddleware, requireRole('Administrator', 'IT Technician', 'Site Manager'), (req, res) => {
  const { id } = req.params;
  const updates = req.body || {};
  const incident = findIncidentById(id);

  if (!incident) {
    return res.status(404).json({ error: 'Incident not found' });
  }

  const previousIncident = { ...incident };

  const allowedFields = ['status', 'assignedTechnician', 'resolutionNotes', 'priority', 'category', 'description'];
  allowedFields.forEach((field) => {
    if (updates[field] !== undefined) {
      incident[field] = updates[field];
    }
  });

  if (updates.status) {
    incident.slaStatus = calculateSlaStatus(incident.responseDeadline, incident.resolutionDeadline);
  }

  upsertIncident(incident);

  logAuditEvent({
    source: 'user',
    actor: req.user.email || req.user.id,
    entity: 'incident',
    entityId: incident.id,
    action: 'update',
    previousValue: previousIncident,
    newValue: incident
  });

  return res.json({ incident });
});

module.exports = router;
