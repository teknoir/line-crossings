const express = require('express');
const { getDatabase } = require('../utils/db');
const { ObjectId } = require('mongodb');

const router = express.Router();

// GET /api/alerts - List all alerts with pagination and search
router.get('/', async (req, res) => {
  try {
    const db = getDatabase();
    const collection = db.collection('alerts');

    // Pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    // Base filter - only line_crossing alerts
    const filter = { type: 'line_crossing' };

    // Search filter on alert ID (the 'id' field, not '_id')
    if (req.query.search) {
      filter.id = { $regex: req.query.search, $options: 'i' }; // case-insensitive search
    }

    // Date range filter on start_time
    if (req.query.startDate || req.query.endDate) {
      filter.start_time = {};

      if (req.query.startDate) {
        // Filter alerts that started after or at this time
        filter.start_time.$gte = new Date(req.query.startDate);
      }

      if (req.query.endDate) {
        // Filter alerts that started before or at this time
        filter.start_time.$lte = new Date(req.query.endDate);
      }
    }

    // Get total count for pagination
    const total = await collection.countDocuments(filter);

    // Fetch alerts - sorted by start_time descending (latest first)
    const alerts = await collection
      .find(filter)
      .sort({ start_time: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();

    // Transform alerts to include direct media service URLs
    const mediaBaseUrl = process.env.MEDIA_SERVICE_BASE_URL || 'https://teknoir.cloud/victra-poc/media-service/api';
    const transformedAlerts = alerts.map(alert => ({
      ...alert,
      imageUrl: alert.video_snapshot ? `${mediaBaseUrl}/jpeg/${alert.video_snapshot}` : null,
      videoUrl: alert.video_url ? `${mediaBaseUrl}/mp4/${alert.video_url}` : null,
      metadataUrl: alert.annotations_url ? `${mediaBaseUrl}/json/${alert.annotations_url}` : null
    }));

    if (transformedAlerts.length > 0) {
      console.log('Sample image URL:', transformedAlerts[0].imageUrl);
      console.log('Sample video URL:', transformedAlerts[0].videoUrl);
      console.log('Sample metadata URL:', transformedAlerts[0].metadataUrl);
    }

    res.json({
      alerts: transformedAlerts,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching alerts:', error);
    res.status(500).json({ error: 'Failed to fetch alerts', message: error.message });
  }
});

// GET /api/alerts/:id - Get specific alert details
router.get('/:id', async (req, res) => {
  try {
    const db = getDatabase();
    const collection = db.collection('alerts');

    const alert = await collection.findOne({ _id: new ObjectId(req.params.id) });

    if (!alert) {
      return res.status(404).json({ error: 'Alert not found' });
    }

    // Transform alert to include direct media service URLs
    const mediaBaseUrl = process.env.MEDIA_SERVICE_BASE_URL || 'https://teknoir.cloud/victra-poc/media-service/api';
    const transformedAlert = {
      ...alert,
      imageUrl: alert.video_snapshot ? `${mediaBaseUrl}/jpeg/${alert.video_snapshot}` : null,
      videoUrl: alert.video_url ? `${mediaBaseUrl}/mp4/${alert.video_url}` : null,
      metadataUrl: alert.annotations_url ? `${mediaBaseUrl}/json/${alert.annotations_url}` : null
    };

    res.json(transformedAlert);
  } catch (error) {
    console.error('Error fetching alert:', error);
    res.status(500).json({ error: 'Failed to fetch alert', message: error.message });
  }
});

module.exports = router;

