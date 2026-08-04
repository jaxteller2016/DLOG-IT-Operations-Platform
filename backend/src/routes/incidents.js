const express = require('express');
const { authMiddleware, requireRole, userCanAccessSite, seedUsers } = require('../auth');
const { loadIncidents, saveIncidents } = require('../dataStore');

const router = express.Router();

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
  const incidents = loadIncidents().filter((incident) => userCanAccessSite(currentUser, incident.siteId));
  return res.json({ incidents });
});

router.post('/', authMiddleware, requireRole('Administrator', 'IT Technician', 'Site Manager'), (req, res) => {
  const { incidentNumber, siteId, assetId, priority, category, description, assignedTechnician, status, responseDeadline, resolutionDeadline, resolutionNotes } = req.body || {};

  if (!incidentNumber || !siteId || !assetId || !priority || !category || !description) {
    return res.status(400).json({ error: 'incidentNumber, siteId, assetId, priority, category, and description are required' });
  }

  const incidents = loadIncidents();
  const duplicateIncident = incidents.find((incident) => incident.incidentNumber === incidentNumber);
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

  incidents.push(incident);
  saveIncidents(incidents);
  return res.status(201).json({ incident });
});

router.patch('/:id', authMiddleware, requireRole('Administrator', 'IT Technician', 'Site Manager'), (req, res) => {
  const { id } = req.params;
  const updates = req.body || {};
  const incidents = loadIncidents();
  const incident = incidents.find((entry) => entry.id === id);

  if (!incident) {
    return res.status(404).json({ error: 'Incident not found' });
  }

  const allowedFields = ['status', 'assignedTechnician', 'resolutionNotes', 'priority', 'category', 'description'];
  allowedFields.forEach((field) => {
    if (updates[field] !== undefined) {
      incident[field] = updates[field];
    }
  });

  if (updates.status) {
    incident.slaStatus = calculateSlaStatus(incident.responseDeadline, incident.resolutionDeadline);
  }

  saveIncidents(incidents);
  return res.json({ incident });
});

module.exports = router;
