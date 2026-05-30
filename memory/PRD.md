# Looma — Wistia-style video platform

## Original Problem
User wants Looma: video hosting/marketing platform with classy + cute illustration design.
Marketing site + dashboard with all nav (Home, Content Library, Webinars, Channels, Analytics, Remix, Edit, Brand) + Wistia-style custom video player + AI transcripts.

## What's Implemented (Feb 2026)
- Marketing: Landing (hero, how-it-works, features grid, pricing, CTA), Features page, Pricing page
- Auth: JWT email/password + Emergent Google OAuth + /auth/callback
- Dashboard shell with full sidebar nav (8 sections)
- Dashboard pages: Home (stats + record CTA), Content Library (search/folders/CRUD), Webinars, Channels, Analytics (Recharts), Remix, Edit (transcript editor), Brand (live player preview)
- Studio page with Wistia-style custom video player (heatmap, brand color, controls)
- Record modal (webcam/screen/both)
- Backend: /api/auth/{register,login,me,google/session}, /api/videos CRUD, /api/analytics/overview

## Backlog
- P1: Actual webcam/screen recording (MediaRecorder API)
- P1: Real AI transcript via Whisper (deferred — mocked currently)
- P1: Object storage for video uploads
- P2: Real heatmap data from view tracking
- P2: Webinar registration & live streaming
- P2: Remix auto-clip detection
