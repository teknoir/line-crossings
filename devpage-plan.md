# Node.js Dev Page Plan for Line-Crossing Alerts Visualization

## Overview
Simple development page to visualize line-crossing alerts from MongoDB. Run with `npm run dev`.

## 1. Backend (Node.js/Express)
**Single Express server connecting to MongoDB**

Alert records contain:
- Image URL (served by mediaservice)
- JSON file URL with bounding box metadata (served by mediaservice)
- Alert metadata (timestamp, camera ID, location, etc.)

**API Endpoints:**
- `GET /api/alerts` - List all alerts (with pagination, filtering)
- `GET /api/alerts/:id` - Get specific alert details
- `GET /api/health` - Health check endpoint

**Environment Variables:**
- `BASE_URL` - Base URL for the server
- `MONGODB_URI` - MongoDB connection string
- `MEDIASERVICE_BASE_URL` - Base URL for media service
- `PORT` - Server port (default: 3000)

## 2. Frontend (Simple HTML/JS)
**Single-page dev interface served from `/public`**

Features:
- List view of alerts showing alert IDs (sorted by latest first)
- Single search field for free-text filtering on alert ID (`id` field, not `_id`)
- Click alert to view details in side panel
- Display full image from mediaservice
- Overlay bounding boxes on image using Canvas API
- Show metadata panel (timestamp, camera, device, detection details, etc.)
- Pagination controls (Previous/Next with page numbers)
- Video player for alerts with video URLs

**No build step - plain HTML/CSS/JS for simplicity**

## 3. Visualization Component
- Fetch image from mediaservice URL
- Load JSON metadata with bounding box coordinates
- Draw boxes on HTML5 canvas overlay
- Draw path of bounding boxes on HTML5 canvas overlay
- Draw lines for line-crossing alerts on HTML5 canvas overlay
- Color-code boxes by detection type

## 4. Project Structure
```
/
├── server.js              # Express server entry point
├── package.json           # npm scripts and dependencies
├── .env.example           # Environment variables template
├── .env                   # Local env vars (gitignored)
├── README.md              # Setup instructions
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

## 5. Dependencies
```json
{
  "dependencies": {
    "express": "^4.18.0",
    "mongodb": "^6.0.0",
    "dotenv": "^16.0.0",
    "cors": "^2.8.5"
  },
  "devDependencies": {
    "nodemon": "^3.0.0"
  }
}
```

## 6. Development Workflow
```bash
npm install              # Install dependencies
cp .env.example .env     # Configure environment
npm run dev              # Start with nodemon (auto-restart)
```

Access at `http://localhost:3000`

## 7. MongoDB Schema (Example Alert Document)
```json
{
    "_id": {"$oid": "690178525f8e8dd7d5813f51"},
    "alert_classification": {
        "type": "Debug",
        "details": [
            {
                "sub_type": "Line Crossing",
                "severity": "Info"
            }
        ]
    },
    "annotations_url": "media/annotations/nc0009-salefloor-270/line-crossing/2025-10-29T02-13-30.841Z.json",
    "branch": "deprecated",
    "count": 0,
    "country": "deprecated",
    "data_model_version": "teknoir.org/v1beta2",
    "detection_id": "nc0009-salefloor-270-155f0f2e-935",
    "duration": 0,
    "end_time": "2025-10-29T02:13:35.995Z",
    "facility": "deprecated",
    "file_metadata": {
        "duration": "45.000",
        "end_time": "2025-10-29T02:13:45.912Z",
        "start_time": "2025-10-29T02:13:00.912Z"
    },
    "from_device": "victra-poc-02",
    "group": "deprecated",
    "id": "nc0009-salefloor-270-155f0f2e-935-lc-exit-0",
    "label": "person",
    "last_modification": "2025-10-29T02:13:38Z",
    "lineage": [],
    "llm_classification": {
        "human_presence": true,
        "clip_duration_in_seconds": 44,
        "frames_processed": 44,
        "count_humans": 1,
        "summary": "A male customer enters the retail store from the right side of the frame at 0:22, walks towards the main entrance, briefly observes the front door, and then exits the store through the main entrance at 0:29. He is casually dressed and appears to be holding a mobile phone.",
        "human_observations": [
            {
                "subject_id": "person_01",
                "first_frame_location": "bottom right",
                "last_frame_location": "middle left",
                "first_frame_number": 22,
                "last_frame_number": 29,
                "physical_features": "Adult male with a beard, short dark hair, average height, and average build.",
                "attire": "Orange and black plaid long-sleeved shirt, dark blue jeans, and dark athletic shoes with white soles.",
                "behavior": "Enters the store, walks towards the front door, briefly stops and appears to be interacting with a mobile phone, then exits the store through the front door.",
                "gender": "male",
                "age_group": "adult",
                "carrying_packages": false,
                "package_description": "",
                "holding_phone": true,
                "wearing_headset": false,
                "carrying_bag": false,
                "bag_description": "",
                "carrying_tools": false,
                "tools_description": "",
                "carrying_secure_container": false,
                "secure_container_description": "",
                "carrying_cleaning_supplies": false,
                "cleaning_supplies_description": "",
                "carrying_personal_items": true,
                "personal_items_description": "mobile phone",
                "carrying_other_items": false,
                "other_items_description": "",
                "uniformed": false,
                "uniform_description": "",
                "expected_presence": true,
                "service_personnel_type": "customer",
                "logo_visible": false,
                "logo_description": ""
            }
        ],
        "location": "Sales-floor 270º",
        "trace_url": "http://langfuse-web.langfuse.svc.cluster.local/langfuse/web/project/cm8r8wfp4000bx7074fu3kdvi/traces/d630dde5-b2e0-4cd1-8117-0c9af8144fc1",
        "is_valid": false
    },
    "message": "deprecated",
    "name": "line_crossing-person",
    "org_tree": {
        "level_1": "34e9b696e709",
        "level_0": "b0cadb4d60e2",
        "level_3": "54016ab7120b",
        "level_2": "9853ddee3829"
    },
    "peripheral_id": "nc0009-salefloor-270",
    "peripheral_name": "nc0009-salefloor-270",
    "peripheral_type": "camera",
    "region": "deprecated",
    "roi_status": [],
    "severity": "INFO",
    "site": "deprecated",
    "start_time": "2025-10-29T02:13:25.995Z",
    "status": "new",
    "type": "line_crossing",
    "video_snapshot": "media/snapshots/nc0009-salefloor-270/line-crossing/2025-10-29T02-13-30.841Z.jpeg",
    "video_url": "media/videos/nc0009-salefloor-270/line-crossing/2025-10-29T02-13-30.841Z.mp4",
    "zone": "deprecated"
}
```
This app is only interested in docyments of type `line_crossing` and will use the following fields:
- `start_time`
- `from_device` (device ID)
- `peripheral_id` (camera ID)
- `video_url` (video URL)
- `video_snapshot` (image URL)
- `annotations_url` (metadata JSON URL)


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
      },
      {
        "id": "demonstrator-se-lc2-9749d32f-2602",
        "x1": 0.3408203125,
        "y1": 0.2359375,
        "x2": 0.419921875,
        "y2": 0.60625,
        "width": 0.0791015625,
        "height": 0.3703125,
        "area": 0.02929229736328125,
        "ratio": 2.6333333333333333,
        "x_center": 0.38037109375,
        "y_center": 0.42109375,
        "score": 0.89208984375,
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
            0.3945614695549011,
            0.2801594138145447
          ],
          [
            0.3971579670906067,
            0.2724740207195282
          ],
          [
            0.3915269374847412,
            0.26881328225135803
          ],
          [
            0,
            0
          ],
          [
            0.38258087635040283,
            0.2669815123081207
          ],
          [
            0,
            0
          ],
          [
            0.3685070872306824,
            0.3105880320072174
          ],
          [
            0,
            0
          ],
          [
            0.35133183002471924,
            0.3504202663898468
          ],
          [
            0,
            0
          ],
          [
            0.3468632102012634,
            0.3912842571735382
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
            0.3850211501121521,
            0.3179977536201477
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
            "score": 0.9946344494819641
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

## 8. Implementation Steps
1. ✅ Create project structure and package.json
2. ✅ Set up Express server with MongoDB connection
3. ✅ Implement alerts API endpoints
4. ✅ Create HTML/CSS frontend layout
5. ✅ Build API client and alert list view
6. ✅ Implement canvas-based bounding box overlay
7. ✅ Add filtering and pagination
8. ✅ Error handling and debug logging
9. ✅ Test with real MongoDB data

## 9. Future Enhancements (Optional)
- Real-time updates using WebSockets or SSE
- Export alerts to CSV/JSON
- Mark alerts as reviewed/archived
- Multi-camera live view
- Statistics dashboard

