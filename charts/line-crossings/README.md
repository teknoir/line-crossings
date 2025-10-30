# Line Crossing Alerts - Dev Page

A simple development page to visualize line-crossing alerts from MongoDB with bounding box overlays.

## Features

- 📋 View all line-crossing alerts from MongoDB
- 🖼️ Display images with bounding box overlays
- 🔍 Filter alerts by camera, location, status, and date
- 📄 Pagination support for large datasets
- 🎨 Color-coded bounding boxes by detection type
- 🔍 Full-size image viewer with detailed metadata

## Prerequisites

- Node.js 16+ installed
- MongoDB instance running
- Access to mediaservice for images and metadata

## Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment:**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` and set your configuration:
   ```
   MONGODB_URI=mongodb://localhost:27017/historian
   MEDIA_SERVICE_BASE_URL=https://teknoir.cloud/victra-poc/media-service/api
   PORT=3000
   ```

3. **Run the dev server:**
   ```bash
   npm run dev
   ```

4. **Open in browser:**
   ```
   http://localhost:3000
   ```

## Project Structure

```
/
├── server.js              # Express server entry point
├── package.json           # Dependencies and scripts
├── .env.example           # Environment variables template
├── routes/
│   └── alerts.js          # API route handlers
├── utils/
│   └── db.js              # MongoDB connection utility
└── public/                # Static frontend files
    ├── index.html         # Main page
    ├── css/
    │   └── style.css      # Styling
    └── js/
        ├── app.js         # Main app logic
        ├── api.js         # API client
        └── canvas.js      # Canvas drawing utilities
```

## API Endpoints

### GET /api/health
Health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2025-10-29T12:00:00.000Z"
}
```

### GET /api/alerts
List all alerts with pagination and filtering.

**Query Parameters:**
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 20)
- `cameraId` - Filter by camera ID
- `location` - Filter by location
- `status` - Filter by status (new, reviewed)
- `fromDate` - Filter from date (ISO 8601)
- `toDate` - Filter to date (ISO 8601)

**Response:**
```json
{
  "alerts": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "pages": 5
  }
}
```

### GET /api/alerts/:id
Get specific alert details.

**Response:**
```json
{
  "_id": "690178525f8e8dd7d5813f51",
  "id": "nc0009-salefloor-270-155f0f2e-935-lc-exit-0",
  "type": "line_crossing",
  "start_time": "2025-10-29T02:13:25.995Z",
  "end_time": "2025-10-29T02:13:35.995Z",
  "peripheral_id": "nc0009-salefloor-270",
  "from_device": "victra-poc-02",
  "detection_id": "nc0009-salefloor-270-155f0f2e-935",
  "video_snapshot": "media/snapshots/nc0009-salefloor-270/line-crossing/2025-10-29T02-13-30.841Z.jpeg",
  "video_url": "media/videos/nc0009-salefloor-270/line-crossing/2025-10-29T02-13-30.841Z.mp4",
  "annotations_url": "media/annotations/nc0009-salefloor-270/line-crossing/2025-10-29T02-13-30.841Z.json",
  "status": "new",
  "label": "person",
  "imageUrl": "https://teknoir.cloud/victra-poc/media-service/api/media/snapshots/...",
  "videoUrl": "https://teknoir.cloud/victra-poc/media-service/api/media/videos/...",
  "metadataUrl": "https://teknoir.cloud/victra-poc/media-service/api/media/annotations/..."
}
```

## MongoDB Schema

**The application filters for alerts with `type: "line_crossing"` only.**

**Alerts Collection - Fields Used:**
```javascript
{
  _id: ObjectId,
  type: "line_crossing",          // Filter: only line_crossing alerts
  start_time: ISODate,             // Alert start timestamp
  end_time: ISODate,               // Alert end timestamp
  from_device: String,             // Device ID (e.g., "victra-poc-02")
  peripheral_id: String,           // Camera ID (e.g., "nc0009-salefloor-270")
  detection_id: String,            // Unique detection identifier
  video_snapshot: String,          // Path to image snapshot
  video_url: String,               // Path to video file
  annotations_url: String,         // Path to metadata JSON
  status: String,                  // "new", "reviewed", etc.
  // ... other fields available in full document
}
```

**Media URLs:**
The application constructs full URLs by prepending `MEDIA_SERVICE_BASE_URL` to the paths:
- Image: `${MEDIA_SERVICE_BASE_URL}/${video_snapshot}`
- Video: `${MEDIA_SERVICE_BASE_URL}/${video_url}`
- Metadata: `${MEDIA_SERVICE_BASE_URL}/${annotations_url}`

**Bounding Box Metadata JSON (from mediaservice):**
```javascript
{
  boxes: [
    {
      x: Number,           // top-left x coordinate
      y: Number,           // top-left y coordinate
      width: Number,       // box width
      height: Number,      // box height
      class: String,       // "person", "vehicle", etc.
      confidence: Number   // 0-1 detection confidence
    }
  ],
  imageWidth: Number,
  imageHeight: Number
}
```

## Development

**Start with auto-reload:**
```bash
npm run dev
```

**Start normally:**
```bash
npm start
```

## Troubleshooting

**MongoDB Connection Error:**
- Ensure MongoDB is running
- Check `MONGODB_URI` in `.env` file
- Verify network connectivity

**Images Not Loading:**
- Check `MEDIASERVICE_URL` in `.env` file
- Verify mediaservice is running and accessible
- Check CORS configuration if needed

**No Alerts Showing:**
- Verify MongoDB has data in the `historian` database, `alerts` collection
- Check browser console for errors
- Verify API endpoints are responding
- Ensure documents have `type: "line_crossing"`

## License

MIT

