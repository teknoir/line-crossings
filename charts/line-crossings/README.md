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

Query Params:
- `enrich=0` to disable enrichment
- `raw=1` or `debug=1` to include raw line-crossing document under `enrichment.raw`

Enrichment Fields (when available):
```json
{
  "enrichment": {
    "parsed": {"detectionId": "...", "direction": "entry|exit", "segmentIndex": 0},
    "lineDirection": "entry",
    "lineId": "lc-entry-0-segments",
    "classifiers": [{"label": "up", "score": 0.9873}],
    "pose": {"coords": [...], "skeleton": [...], "keypoints": [...]},
    "burstImages": ["https://.../jpeg/media/lc-person-cutouts/...-0.jpg", "https://.../jpeg/...-1.jpg"],
    "cutoutImage": "https://.../jpeg/media/lc-person-cutouts/...cutout.jpg"
  }
}
```

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

### Debugging Line-Crossings Lookup
Use the `?debug=1` query param on the alert details endpoint to see each query strategy and whether it matched:

Example:
`GET /api/alerts/ALERT_OBJECT_ID?debug=1`

Response enrichment debug structure:
```json
"enrichment": {
  "debug": {
    "searchedFor": {"detectionId": "nc0009-salefloor-270-155f0f2e-935", "direction": "exit", "segmentIndex": 0},
    "peripheral_id": "nc0009-salefloor-270",
    "attempts": [
      {"strategy": "exact_match", "found": false, "query": {"metadata.annotations.teknoir.org/linedir": "exit", "data.id": "nc0009-salefloor-270-155f0f2e-935"}},
      {"strategy": "prefix_regex", "found": true, "query": {"metadata.annotations.teknoir.org/linedir": "exit", "data.id": {"$regex": "^nc0009-salefloor-270-155f0f2e-935"}}},
      {"strategy": "lineid+peripheral", "found": false, "query": {"metadata.annotations.teknoir.org/linedir": "exit", "metadata.annotations.teknoir.org/lineid": "lc-exit-0-segments"}},
      {"strategy": "recent_by_peripheral_id", "candidates": 0, "query": {"metadata.annotations.teknoir.org/linedir": "exit", "data.peripheral.id": "nc0009-salefloor-270"}},
      {"strategy": "recent_by_peripheral_name", "candidates": 0, "query": {"metadata.annotations.teknoir.org/linedir": "exit", "data.peripheral.name": "nc0009-salefloor-270"}},
      {"strategy": "latest_direction", "found": true, "query": {"metadata.annotations.teknoir.org/linedir": "exit"}}
    ],
    "prettyPrintedAttempts": [ /* Same content but safe-cloned */ ]
  }
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

**Line-Crossings Collection - Example:**
```json
  {
    "_id": {"$oid": "690340081e686e6ca09ebeb6"},
    "apiVersion": "teknoir.org/v1beta2",
        "data": {
        "id": "demonstrator-se-lc1-44b1357b-2988",
            "x1": 0.55859375,
            "y1": 0.15927734375,
            "x2": 0.61796875,
            "y2": 0.448828125,
            "width": 0.059375,
            "height": 0.28955078125,
            "area": 0.01719207763671875,
            "ratio": 2.743112664473684,
            "x_center": 0.58828125,
            "y_center": 0.304052734375,
            "score": 0.8896484375,
            "class_id": 4,
            "label": "line-crossing",
            "keypoints": ["nose", "left_eye", "right_eye", "left_ear", "right_ear", "left_shoulder", "right_shoulder", "left_elbow", "right_elbow", "left_hand", "right_hand", "left_hip", "right_hip", "left_knee", "right_knee", "left_ankle", "right_ankle", "neck"],
            "coords": [
            [0.5995446443557739, 0.20032939314842224],
            [0.6011298298835754, 0.19538627564907074],
            [0.597865879535675, 0.19041940569877625],
            [0, 0],
            [0.5884963274002075, 0.18590237200260162],
            [0.5982832908630371, 0.2297966182231903],
            [0.5865501761436462, 0.2297087013721466],
            [0, 0],
            [0.5949140191078186, 0.28068432211875916],
            [0, 0],
            [0.610177218914032, 0.3156489431858063],
            [0, 0],
            [0, 0],
            [0, 0],
            [0, 0],
            [0, 0],
            [0, 0],
            [0.5917493104934692, 0.23194950819015503]
        ],
            "skeleton": [
            [0, 17],
            [0, 1],
            [0, 2],
            [1, 3],
            [2, 4],
            [17, 5],
            [17, 6],
            [17, 11],
            [17, 12],
            [5, 7],
            [7, 9],
            [6, 8],
            [8, 10],
            [11, 12],
            [11, 13],
            [13, 15],
            [12, 14],
            [14, 16],
            [0, 0]
        ],
            "classifiers": [
            {
                "label": "up",
                "score": 0.9873543381690979
            }
        ],
            "timestamp": "2025-10-30T10:37:17.439Z",
            "type": "analytics",
            "in_exclusion_zone": false,
            "in_inclusion_zone": false,
            "peripheral": {
            "type": "camera",
                "name": "demonstrator-se-lc1",
                "id": "demonstrator-se-lc1"
        },
        "filename": "media/lc-person-cutouts/2025-10-30/lc-entry-0-segments/demonstrator-se-lc1-44b1357b-2988-2025-10-30T10:37:57.012Z.jpg", 
        "burst": ["media/lc-person-cutouts/2025-10-30/lc-entry-0-segments/demonstrator-se-lc1-44b1357b-2988-2025-10-30T10:37:57.012Z-0.jpg", "media/lc-person-cutouts/2025-10-30/lc-entry-0-segments/demonstrator-se-lc1-44b1357b-2988-2025-10-30T10:37:57.012Z-1.jpg", "media/lc-person-cutouts/2025-10-30/lc-entry-0-segments/demonstrator-se-lc1-44b1357b-2988-2025-10-30T10:37:57.012Z-2.jpg", "media/lc-person-cutouts/2025-10-30/lc-entry-0-segments/demonstrator-se-lc1-44b1357b-2988-2025-10-30T10:37:57.012Z-3.jpg", "media/lc-person-cutouts/2025-10-30/lc-entry-0-segments/demonstrator-se-lc1-44b1357b-2988-2025-10-30T10:37:57.012Z-4.jpg", "media/lc-person-cutouts/2025-10-30/lc-entry-0-segments/demonstrator-se-lc1-44b1357b-2988-2025-10-30T10:37:57.012Z-5.jpg", "media/lc-person-cutouts/2025-10-30/lc-entry-0-segments/demonstrator-se-lc1-44b1357b-2988-2025-10-30T10:37:57.012Z-6.jpg", "media/lc-person-cutouts/2025-10-30/lc-entry-0-segments/demonstrator-se-lc1-44b1357b-2988-2025-10-30T10:37:57.012Z-7.jpg", "media/lc-person-cutouts/2025-10-30/lc-entry-0-segments/demonstrator-se-lc1-44b1357b-2988-2025-10-30T10:37:57.012Z-8.jpg", "media/lc-person-cutouts/2025-10-30/lc-entry-0-segments/demonstrator-se-lc1-44b1357b-2988-2025-10-30T10:37:57.012Z-9.jpg"]
    },
    "kind": "DetectionEvent",
        "metadata": {
        "id": "demonstrator-se-lc1-44b1357b-2988",
            "namespace": "test-namespace",
            "timestamp": "2025-10-30T10:37:17.830Z",
            "annotations": {
            "teknoir.org/linedir": "entry",
            "teknoir.org/lineid": "lc-entry-0-segments"
        }
    }
}
```


**Media URLs:**
The application constructs full URLs by prepending `MEDIA_SERVICE_BASE_URL` to the paths:
- Image: `${MEDIA_SERVICE_BASE_URL}/${video_snapshot}`
- Video: `${MEDIA_SERVICE_BASE_URL}/${video_url}`
- Metadata: `${MEDIA_SERVICE_BASE_URL}/${annotations_url}`

**Bounding Box Metadata JSON (from mediaservice):**
```json
{
    "data": {
        "metadata": {
            "start_time": "2025-10-15T10:50:48.242Z",
                "end_time": "2025-10-15T10:51:33.144Z"
        },
        "detections": [
            {
                "id": "demonstrator-se-lc2-9749d32f-2601",
                "x1": 0.2462890625,
                "y1": 0.4171875,
                "x2": 0.2703125,
                "y2": 0.471484375,
                "width": 0.0240234375,
                "height": 0.054296875,
                "area": 0.0013043975830078127,
                "ratio": 1.271341463414634,
                "x_center": 0.25830078125,
                "y_center": 0.4443359375,
                "score": 0.63037109375,
                "class_id": 3,
                "label": "face_cover",
                "timestamp": "2025-10-15T10:50:48.242Z",
                "type": "object",
                "in_exclusion_zone": false,
                "in_inclusion_zone": false,
                "peripheral": {
                    "type": "camera",
                    "name": "demonstrator-se-lc2",
                    "id": "demonstrator-se-lc2",
                    "stream_uri": "rtsp://mediamtx:8554/front-door-1-wrongly-classified-exits"
                }
            },
            {
                "id": "demonstrator-se-lc2-9749d32f-2599",
                "x1": 0.2236328125,
                "y1": 0.3982421875,
                "x2": 0.312109375,
                "y2": 0.740234375,
                "width": 0.0884765625,
                "height": 0.3419921875,
                "area": 0.030258293151855464,
                "ratio": 2.174254966887417,
                "x_center": 0.26787109375,
                "y_center": 0.56923828125,
                "score": 0.9267578125,
                "class_id": 4,
                "label": "person",
                "keypoints": [
                    "nose",
                    "left_eye",
                    "right_eye",
                    "left_ear",
                    "right_ear",
                    "left_shoulder",
                    "right_shoulder",
                    "left_elbow",
                    "right_elbow",
                    "left_hand",
                    "right_hand",
                    "left_hip",
                    "right_hip",
                    "left_knee",
                    "right_knee",
                    "left_ankle",
                    "right_ankle",
                    "neck"
                ],
                "coords": [
                    [
                        0,
                        0
                    ],
                    [
                        0,
                        0
                    ],
                    [
                        0,
                        0
                    ],
                    [
                        0,
                        0
                    ],
                    [
                        0,
                        0
                    ],
                    [
                        0,
                        0
                    ],
                    [
                        0,
                        0
                    ],
                    [
                        0,
                        0
                    ],
                    [
                        0,
                        0
                    ],
                    [
                        0,
                        0
                    ],
                    [
                        0,
                        0
                    ],
                    [
                        0,
                        0
                    ],
                    [
                        0,
                        0
                    ],
                    [
                        0,
                        0
                    ],
                    [
                        0.2863526940345764,
                        0.6201004981994629
                    ],
                    [
                        0,
                        0
                    ],
                    [
                        0,
                        0
                    ],
                    [
                        0,
                        0
                    ]
                ],
                "skeleton": [
                    [
                        0,
                        17
                    ],
                    [
                        0,
                        1
                    ],
                    [
                        0,
                        2
                    ],
                    [
                        1,
                        3
                    ],
                    [
                        2,
                        4
                    ],
                    [
                        17,
                        5
                    ],
                    [
                        17,
                        6
                    ],
                    [
                        17,
                        11
                    ],
                    [
                        17,
                        12
                    ],
                    [
                        5,
                        7
                    ],
                    [
                        7,
                        9
                    ],
                    [
                        6,
                        8
                    ],
                    [
                        8,
                        10
                    ],
                    [
                        11,
                        12
                    ],
                    [
                        11,
                        13
                    ],
                    [
                        13,
                        15
                    ],
                    [
                        12,
                        14
                    ],
                    [
                        14,
                        16
                    ],
                    [
                        0,
                        0
                    ]
                ],
                "classifiers": [
                    {
                        "label": "up",
                        "score": 0.9802155494689941
                    }
                ],
                "timestamp": "2025-10-15T10:50:48.242Z",
                "type": "object",
                "in_exclusion_zone": false,
                "in_inclusion_zone": false,
                "peripheral": {
                    "type": "camera",
                    "name": "demonstrator-se-lc2",
                    "id": "demonstrator-se-lc2",
                    "stream_uri": "rtsp://mediamtx:8554/front-door-1-wrongly-classified-exits"
                }
            }
        ]
    }
}
```

## Annotations

### Pose
- Draw skeletons using `keypoints` and `skeleton` arrays from metadata
Pseudo code:
```javascript
const skeleton = detection["skeleton"] || [];
for (let s = 0; s < skeleton.length; s++) {
    const coords = detection["coords"] || [];
    const [x0, y0] = coords[skeleton[s][0]];
    const [x1, y1] = coords[skeleton[s][1]];
    if (!(x0 == 0.0 && y0 == 0.0) && !(x1 == 0.0 && y1 == 0.0)) {
        context.beginPath();
        context.strokeStyle = colorsTeknoirBrand.horizon_yellow;
        context.fillStyle = colorsTeknoirBrand.gold;
        context.moveTo(x0 * canvas.width, y0 * canvas.height);
        context.lineTo(x1 * canvas.width, y1 * canvas.height);
        context.stroke();
        context.closePath();
    }
}

// POSE KEYPOINTS
function drawDot(x, y, color = 'blue', radius = 2) {
    context.beginPath();
    context.strokeStyle = colorsTeknoirBrand.horizon_yellow;
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fillStyle = colorsTeknoirBrand.gold;
    context.fill();
    context.closePath();
}
const coords = detection["coords"] || [];
//const keypoints = detection["keypoints"] || [];
for (let c = 0; c < coords.length; c++) {
    const [x, y] = coords[c] || [0.0, 0.0];
    if (!(x == 0.0 && y == 0.0)) {
        const xc = x * canvas.width;
        const yc = y * canvas.height;
        drawDot(xc, yc);
        //const label = keypoints[c] || "error";
        //context.fillStyle = colorsTeknoirBrand.gold;
        //context.fillText(label, xc, (yc + (fontSize - 2) ));
    }
};
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
