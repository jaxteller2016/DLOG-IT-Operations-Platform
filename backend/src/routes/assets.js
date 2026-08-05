const express = require('express');
const { authMiddleware, requireRole, userCanAccessSite, seedUsers } = require('../auth');
const { loadAssets, findAssetByAssetId, upsertAsset, logAuditEvent } = require('../dataStore');

const router = express.Router();

function parsePaging(query) {
  const shouldPaginate = query.paginate === 'true' || query.page !== undefined || query.pageSize !== undefined;
  if (!shouldPaginate) return null;

  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const pageSize = Math.max(1, Math.min(200, Number.parseInt(query.pageSize, 10) || 20));
  return { page, pageSize };
}

function buildAssetIdCandidate() {
  const randomSuffix = Math.floor(Math.random() * 900 + 100);
  return `AST-${Date.now()}-${randomSuffix}`;
}

function generateUniqueAssetId() {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const candidate = buildAssetIdCandidate();
    if (!findAssetByAssetId(candidate)) return candidate;
  }

  throw new Error('Unable to generate a unique asset ID');
}

router.get('/', authMiddleware, (req, res) => {
  const users = seedUsers();
  const currentUser = users.find((entry) => entry.id === req.user.id);
  const search = (req.query.search || '').toString().trim().toLowerCase();
  const status = (req.query.status || '').toString().trim();
  const siteId = (req.query.siteId || '').toString().trim();
  const category = (req.query.category || '').toString().trim();

  const filteredAssets = loadAssets().filter((asset) => {
    if (!userCanAccessSite(currentUser, asset.siteId)) return false;
    if (status && asset.status !== status) return false;
    if (siteId && asset.siteId !== siteId) return false;
    if (category && asset.category !== category) return false;
    if (!search) return true;

    return asset.assetId.toLowerCase().includes(search)
      || asset.serialNumber.toLowerCase().includes(search)
      || asset.category.toLowerCase().includes(search)
      || asset.siteId.toLowerCase().includes(search);
  });

  const paging = parsePaging(req.query);
  if (!paging) {
    return res.json({ assets: filteredAssets });
  }

  const total = filteredAssets.length;
  const totalPages = Math.max(1, Math.ceil(total / paging.pageSize));
  const page = Math.min(paging.page, totalPages);
  const start = (page - 1) * paging.pageSize;
  const assets = filteredAssets.slice(start, start + paging.pageSize);

  return res.json({
    assets,
    pagination: {
      page,
      pageSize: paging.pageSize,
      total,
      totalPages
    }
  });
});

router.post('/', authMiddleware, requireRole('Administrator', 'IT Technician'), (req, res) => {
  const { assetId, serialNumber, category, manufacturer, model, siteId, assignedEmployee, ipAddress, macAddress, operatingSystem, purchaseDate, warrantyExpirationDate, status, notes } = req.body || {};

  const normalizedAssetId = typeof assetId === 'string' && assetId.trim() ? assetId.trim() : generateUniqueAssetId();

  if (!serialNumber || !category || !siteId) {
    return res.status(400).json({ error: 'serialNumber, category, and siteId are required' });
  }

  const duplicateByAssetId = findAssetByAssetId(normalizedAssetId);
  const duplicateBySerial = loadAssets().find((asset) => asset.serialNumber === serialNumber);
  const duplicateAsset = duplicateByAssetId || duplicateBySerial;
  if (duplicateAsset) {
    return res.status(409).json({ error: 'Duplicate asset ID or serial number' });
  }

  const asset = {
    id: `asset-${Date.now()}`,
    assetId: normalizedAssetId,
    serialNumber,
    category,
    manufacturer: manufacturer || '',
    model: model || '',
    siteId,
    assignedEmployee: assignedEmployee || '',
    ipAddress: ipAddress || '',
    macAddress: macAddress || '',
    operatingSystem: operatingSystem || '',
    purchaseDate: purchaseDate || '',
    warrantyExpirationDate: warrantyExpirationDate || '',
    status: status || 'Unknown',
    notes: notes || '',
    lastOnlineTimestamp: null
  };

  upsertAsset(asset);

  logAuditEvent({
    source: 'user',
    actor: req.user.email || req.user.id,
    entity: 'asset',
    entityId: asset.id,
    action: 'create',
    previousValue: null,
    newValue: asset
  });

  return res.status(201).json({ asset });
});

module.exports = router;
