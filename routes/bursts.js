const express = require('express');
const { getReIDDatabase } = require('../utils/reiddb');

const router = express.Router();

function getLineCrossingsCollection(db) {
  const primary = process.env.LINE_CROSSINGS_COLLECTION || 'line-crossings';
  try {
    return db.collection(primary);
  } catch (_) {
    return db.collection('line_crossings');
  }
}

function normalizeMediaPath(path) {
  return (path || '').replace(/^\/+/, '');
}

function resolveNested(obj, pathParts) {
  if (!obj) return null;
  let current = obj;
  for (const part of pathParts) {
    if (current && typeof current === 'object' && Object.prototype.hasOwnProperty.call(current, part)) {
      current = current[part];
    } else {
      return null;
    }
  }
  return typeof current === 'string' ? current : null;
}

router.get('/', async (req, res) => {
  try {
    const db = getReIDDatabase();
    const collection = getLineCrossingsCollection(db);
    const limit = Math.min(parseInt(req.query.limit, 10) || 60, 120);
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const skip = (page - 1) * limit;
    const mediaBaseUrl = process.env.MEDIA_SERVICE_BASE_URL || 'https://teknoir.cloud/victra-poc/media-service/api';
    const andFilters = [];

    const { date, direction = 'both', camera } = req.query;

    if (date) {
      const start = new Date(`${date}T00:00:00.000Z`);
      if (Number.isNaN(start.getTime())) {
        return res.status(400).json({ error: 'Invalid date parameter' });
      }
      const end = new Date(start);
      end.setUTCDate(end.getUTCDate() + 1);

      const startIso = start.toISOString();
      const endIso = end.toISOString();

      andFilters.push({
        $or: [
          { 'metadata.timestamp': { $gte: startIso, $lt: endIso } },
          { 'metadata.timestamp': { $gte: start, $lt: end } },
          { 'data.timestamp': { $gte: startIso, $lt: endIso } },
          { 'data.timestamp': { $gte: start, $lt: end } },
          { 'metadata.timestamp': { $regex: `^${date}` } },
          { 'data.timestamp': { $regex: `^${date}` } }
        ]
      });
    }

    const requestedDirection = (direction || 'both').toLowerCase();

    if (camera) {
      const cameraRegex = new RegExp(camera, 'i');
      andFilters.push({
        $or: [
          { 'data.peripheral.id': cameraRegex },
          { 'data.peripheral.name': cameraRegex }
        ]
      });
    }

    // Apply direction filter robustly using $expr unless 'both'
    if (requestedDirection !== 'both') {
      const dirValue = requestedDirection; // exact value like 'entry' or 'exit'
      andFilters.push({
        $expr: {
          $or: [
            // Nested path variants
            { $eq: [ { $toLower: { $ifNull: [ '$metadata.annotations.teknoir.org.linedir', '' ] } }, dirValue ] },
            { $eq: [ { $toLower: { $ifNull: [ '$metadata.annotations.linedir', '' ] } }, dirValue ] },
            // Flattened keys inside annotations object (e.g., 'teknoir.org/linedir')
            {
              $gt: [
                {
                  $size: {
                    $filter: {
                      input: { $objectToArray: { $ifNull: [ '$metadata.annotations', {} ] } },
                      as: 'kv',
                      cond: {
                        $and: [
                          { $in: [ '$$kv.k', [ 'teknoir.org/linedir', 'teknoir.org.linedir', 'linedir' ] ] },
                          { $eq: [ { $toLower: { $ifNull: [ '$$kv.v', '' ] } }, dirValue ] }
                        ]
                      }
                    }
                  }
                },
                0
              ]
            }
          ]
        }
      });
    }

    const filter = andFilters.length ? { $and: andFilters } : {};

    // Count total matching docs before pagination
    const totalMatching = await collection.countDocuments(filter);

    const docs = await collection
      .find(filter)
      .sort({ 'metadata.timestamp': -1 })
      .skip(skip)
      .limit(limit)
      .toArray();

    const bursts = docs.map((doc) => {
      const filesArr = Array.isArray(doc.data?.files) ? doc.data.files : [];
      const legacyBurst = Array.isArray(doc.data?.burst) ? doc.data.burst : [];

      const normalize = (p) => (p || '').replace(/^\/+/, '');
      const seen = new Set();
      const merged = [];
      const pushIf = (p) => {
        if (!p) return;
        const key = normalize(p);
        if (seen.has(key)) return;
        seen.add(key);
        merged.push(key);
      };
      filesArr.forEach(pushIf);
      legacyBurst.forEach(pushIf);

      const burstImagesFull = merged.map((p) => `${mediaBaseUrl}/jpeg/${normalize(p)}`);

      const directionValue =
        doc.metadata?.annotations?.['teknoir.org/linedir'] ||
        doc.metadata?.annotations?.['teknoir.org.linedir'] ||
        resolveNested(doc.metadata?.annotations, ['teknoir', 'org', 'linedir']) ||
        doc.metadata?.annotations?.linedir ||
        null;

      // New: resolve alertId from annotations for direct alert open
      const alertIdValue =
        doc.metadata?.annotations?.['teknoir.org/alertid'] ||
        doc.metadata?.annotations?.['teknoir.org.alertid'] ||
        resolveNested(doc.metadata?.annotations, ['teknoir', 'org', 'alertid']) ||
        doc.metadata?.annotations?.alertid ||
        null;

      const timestamp = doc.metadata?.timestamp || doc.data?.timestamp || null;
      let cutoutImage = null;
      if (doc.data?.filename) {
        cutoutImage = `${mediaBaseUrl}/jpeg/${normalize(doc.data.filename)}`;
      } else if (merged.length > 0) {
        cutoutImage = `${mediaBaseUrl}/jpeg/${normalize(merged[0])}`;
      }

      const previewImages = burstImagesFull.slice(0, 12);
      if (cutoutImage) {
        const existingIndex = previewImages.indexOf(cutoutImage);
        if (existingIndex > -1) previewImages.splice(existingIndex, 1);
        previewImages.unshift(cutoutImage);
      }

      return {
        id: doc._id,
        detectionId: doc.data?.id || null,
        alertId: alertIdValue,
        burstCount: merged.length,
        burstImages: previewImages,
        cutoutImage,
        peripheral: {
          id: doc.data?.peripheral?.id || null,
          name: doc.data?.peripheral?.name || null
        },
        direction: directionValue,
        timestamp
      };
    });

    // Direction is already handled at DB level; no client-side filter
    const filteredBursts = bursts;

    if (process.env.NODE_ENV !== 'production') {
      console.log('[Bursts] Query', JSON.stringify(filter));
      console.log('[Bursts] Direction filter', requestedDirection);
      console.log('[Bursts] Matched docs (page slice)', docs.length);
      console.log('[Bursts] After direction filter', filteredBursts.length);
      if (filteredBursts[0]) {
        console.log('[Bursts] Sample burst direction', filteredBursts[0].direction);
      }
    }

    res.json({
      totalCount: totalMatching,
      page,
      limit,
      bursts: filteredBursts
    });
  } catch (error) {
    console.error('Error fetching bursts:', error);
    res.status(500).json({ error: 'Failed to fetch bursts', message: error.message });
  }
});

module.exports = router;
