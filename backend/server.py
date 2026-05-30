from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, BackgroundTasks, UploadFile, File, Form, Header, Query, Response
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os, jwt, bcrypt, uuid, logging, httpx, requests, asyncio, tempfile, io
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional
from datetime import datetime, timezone, timedelta

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_SECRET = os.environ['JWT_SECRET']
JWT_ALG = "HS256"
EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY')
STORAGE_URL = "https://integrations.emergentagent.com/objstore/api/v1/storage"
APP_NAME = "looma"

logger = logging.getLogger("looma")
logging.basicConfig(level=logging.INFO)

app = FastAPI(title="Looma API")
api_router = APIRouter(prefix="/api")
security = HTTPBearer(auto_error=False)

# ============ STORAGE ============
_storage_key = None
def init_storage():
    global _storage_key
    if _storage_key: return _storage_key
    if not EMERGENT_LLM_KEY:
        logger.warning("No EMERGENT_LLM_KEY — storage disabled")
        return None
    try:
        r = requests.post(f"{STORAGE_URL}/init", json={"emergent_key": EMERGENT_LLM_KEY}, timeout=30)
        r.raise_for_status()
        _storage_key = r.json()["storage_key"]
        logger.info("Storage initialized")
        return _storage_key
    except Exception as e:
        logger.error(f"Storage init failed: {e}")
        return None

def storage_put(path: str, data: bytes, content_type: str) -> dict:
    key = init_storage()
    if not key: raise HTTPException(503, "Storage unavailable")
    r = requests.put(f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key, "Content-Type": content_type},
        data=data, timeout=180)
    if r.status_code == 403:
        global _storage_key; _storage_key = None
        key = init_storage()
        r = requests.put(f"{STORAGE_URL}/objects/{path}",
            headers={"X-Storage-Key": key, "Content-Type": content_type},
            data=data, timeout=180)
    r.raise_for_status()
    return r.json()

def storage_get(path: str) -> tuple[bytes, str]:
    key = init_storage()
    if not key: raise HTTPException(503, "Storage unavailable")
    r = requests.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key}, timeout=120)
    if r.status_code == 403:
        global _storage_key; _storage_key = None
        key = init_storage()
        r = requests.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key}, timeout=120)
    r.raise_for_status()
    return r.content, r.headers.get("Content-Type", "application/octet-stream")


# ============ MODELS ============
class RegisterReq(BaseModel):
    email: EmailStr; password: str; name: Optional[str] = None

class LoginReq(BaseModel):
    email: EmailStr; password: str

class UserOut(BaseModel):
    id: str; email: str
    name: Optional[str] = None
    picture: Optional[str] = None
    provider: str = "local"

class TokenOut(BaseModel):
    access_token: str; user: UserOut

class VideoCreate(BaseModel):
    title: str
    description: Optional[str] = ""
    url: Optional[str] = ""
    thumbnail: Optional[str] = ""
    duration: Optional[float] = 0
    folder: Optional[str] = "All Videos"

class Video(BaseModel):
    id: str; user_id: str; title: str
    description: str = ""
    url: str = ""
    thumbnail: str = ""
    duration: float = 0
    folder: str = "All Videos"
    views: int = 0; plays: int = 0
    avg_engagement: float = 0.0
    storage_path: Optional[str] = None
    transcript_status: str = "none"  # none|pending|ready|error
    created_at: str

class VideoUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    thumbnail: Optional[str] = None
    folder: Optional[str] = None

class SegmentEvent(BaseModel):
    video_id: str
    session_id: str
    segment_index: int   # 5-second bucket index
    action: str = "watch"  # watch|skip|rewatch


# ============ HELPERS ============
def hash_pw(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()

def verify_pw(pw: str, hashed: str) -> bool:
    try: return bcrypt.checkpw(pw.encode(), hashed.encode())
    except Exception: return False

def create_token(user_id: str) -> str:
    return jwt.encode({"sub": user_id,
        "exp": datetime.now(timezone.utc) + timedelta(days=7),
        "iat": datetime.now(timezone.utc)}, JWT_SECRET, algorithm=JWT_ALG)

def user_to_out(u: dict) -> UserOut:
    return UserOut(id=u["id"], email=u["email"], name=u.get("name"),
        picture=u.get("picture"), provider=u.get("provider", "local"))

async def get_current_user(credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)) -> dict:
    if not credentials: raise HTTPException(401, "Not authenticated")
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALG])
        user_id = payload.get("sub")
    except jwt.PyJWTError:
        raise HTTPException(401, "Invalid token")
    u = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not u: raise HTTPException(401, "User not found")
    return u


# ============ TRANSCRIPTION ============
async def transcribe_video(video_id: str, storage_path: str):
    """Background task: download video bytes, run Whisper, save transcript."""
    try:
        await db.videos.update_one({"id": video_id}, {"$set": {"transcript_status": "pending"}})
        data, ctype = await asyncio.get_event_loop().run_in_executor(None, storage_get, storage_path)
        # Whisper limit: 25MB
        if len(data) > 25 * 1024 * 1024:
            logger.warning(f"Video {video_id} > 25MB, skipping transcript")
            await db.videos.update_one({"id": video_id}, {"$set": {"transcript_status": "error",
                "transcript_error": "File too large for transcription (>25MB)"}})
            return
        # Determine extension
        ext = "webm" if "webm" in ctype else "mp4"
        from emergentintegrations.llm.openai import OpenAISpeechToText
        stt = OpenAISpeechToText(api_key=EMERGENT_LLM_KEY)
        # Need a file-like with a name attribute
        bio = io.BytesIO(data); bio.name = f"video.{ext}"
        resp = await stt.transcribe(
            file=bio, model="whisper-1",
            response_format="verbose_json",
            timestamp_granularities=["segment"],
        )
        segments = []
        text = ""
        if hasattr(resp, "text"): text = resp.text
        if hasattr(resp, "segments") and resp.segments:
            for s in resp.segments:
                segments.append({
                    "start": float(getattr(s, "start", 0)),
                    "end": float(getattr(s, "end", 0)),
                    "text": getattr(s, "text", "").strip(),
                })
        await db.transcripts.update_one(
            {"video_id": video_id},
            {"$set": {"video_id": video_id, "text": text, "segments": segments,
                      "created_at": datetime.now(timezone.utc).isoformat()}},
            upsert=True,
        )
        await db.videos.update_one({"id": video_id}, {"$set": {"transcript_status": "ready"}})
        logger.info(f"Transcribed {video_id}: {len(segments)} segments")
    except Exception as e:
        logger.error(f"Transcription failed for {video_id}: {e}")
        await db.videos.update_one({"id": video_id},
            {"$set": {"transcript_status": "error", "transcript_error": str(e)[:200]}})


# ============ ROUTES ============
@api_router.get("/")
async def root():
    return {"message": "Looma API up", "version": "2.0"}

@api_router.post("/auth/register", response_model=TokenOut)
async def register(req: RegisterReq):
    if await db.users.find_one({"email": req.email.lower()}):
        raise HTTPException(400, "Email already registered")
    user = {"id": str(uuid.uuid4()), "email": req.email.lower(),
        "name": req.name or req.email.split("@")[0],
        "password_hash": hash_pw(req.password), "provider": "local", "picture": None,
        "created_at": datetime.now(timezone.utc).isoformat()}
    await db.users.insert_one(user)
    return TokenOut(access_token=create_token(user["id"]), user=user_to_out(user))

@api_router.post("/auth/login", response_model=TokenOut)
async def login(req: LoginReq):
    u = await db.users.find_one({"email": req.email.lower()}, {"_id": 0})
    if not u or not u.get("password_hash") or not verify_pw(req.password, u["password_hash"]):
        raise HTTPException(401, "Invalid email or password")
    return TokenOut(access_token=create_token(u["id"]), user=user_to_out(u))

@api_router.get("/auth/me", response_model=UserOut)
async def me(user=Depends(get_current_user)):
    return user_to_out(user)

@api_router.post("/auth/google/session", response_model=TokenOut)
async def google_session(request: Request):
    session_id = request.headers.get("X-Session-ID")
    if not session_id: raise HTTPException(400, "Missing X-Session-ID header")
    async with httpx.AsyncClient(timeout=10) as cx:
        try:
            r = await cx.get("https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
                headers={"X-Session-ID": session_id})
            if r.status_code != 200: raise HTTPException(401, "Invalid session")
            data = r.json()
        except httpx.HTTPError:
            raise HTTPException(502, "Auth provider unreachable")
    email = (data.get("email") or "").lower()
    if not email: raise HTTPException(400, "No email in session")
    u = await db.users.find_one({"email": email}, {"_id": 0})
    now = datetime.now(timezone.utc).isoformat()
    if not u:
        u = {"id": str(uuid.uuid4()), "email": email,
            "name": data.get("name") or email.split("@")[0],
            "picture": data.get("picture"), "provider": "google",
            "password_hash": None, "created_at": now}
        await db.users.insert_one(u)
    else:
        await db.users.update_one({"id": u["id"]}, {"$set": {
            "name": data.get("name") or u.get("name"),
            "picture": data.get("picture") or u.get("picture"),
            "provider": u.get("provider") or "google"}})
        u["picture"] = data.get("picture") or u.get("picture")
        u["name"] = data.get("name") or u.get("name")
    return TokenOut(access_token=create_token(u["id"]), user=user_to_out(u))


# ============ VIDEOS ============
def video_to_out(v: dict) -> dict:
    """Ensure video dict has all expected fields with defaults."""
    return {
        "id": v["id"], "user_id": v["user_id"], "title": v.get("title", ""),
        "description": v.get("description", ""), "url": v.get("url", ""),
        "thumbnail": v.get("thumbnail", ""), "duration": v.get("duration", 0),
        "folder": v.get("folder", "All Videos"),
        "views": v.get("views", 0), "plays": v.get("plays", 0),
        "avg_engagement": v.get("avg_engagement", 0.0),
        "storage_path": v.get("storage_path"),
        "transcript_status": v.get("transcript_status", "none"),
        "created_at": v.get("created_at", ""),
    }

@api_router.get("/videos", response_model=List[Video])
async def list_videos(user=Depends(get_current_user)):
    docs = await db.videos.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return [video_to_out(d) for d in docs]

@api_router.post("/videos", response_model=Video)
async def create_video(body: VideoCreate, user=Depends(get_current_user)):
    v = {"id": str(uuid.uuid4()), "user_id": user["id"], "title": body.title,
        "description": body.description or "", "url": body.url or "",
        "thumbnail": body.thumbnail or "",
        "duration": float(body.duration or 0),
        "folder": body.folder or "All Videos",
        "views": 0, "plays": 0, "avg_engagement": 0.0,
        "storage_path": None, "transcript_status": "none",
        "created_at": datetime.now(timezone.utc).isoformat()}
    await db.videos.insert_one(v)
    return video_to_out(v)

@api_router.post("/videos/upload", response_model=Video)
async def upload_video(
    background: BackgroundTasks,
    file: UploadFile = File(...),
    title: str = Form(...),
    description: str = Form(""),
    folder: str = Form("All Videos"),
    duration: float = Form(0),
    user=Depends(get_current_user),
):
    if not EMERGENT_LLM_KEY:
        raise HTTPException(503, "Object storage not configured")
    raw = file.filename or "video.webm"
    ext = raw.rsplit(".", 1)[-1].lower() if "." in raw else "webm"
    if ext not in ("mp4", "webm", "mov", "m4v", "mpeg", "mpga"): ext = "webm"
    data = await file.read()
    path = f"{APP_NAME}/uploads/{user['id']}/{uuid.uuid4()}.{ext}"
    content_type = file.content_type or ("video/webm" if ext == "webm" else "video/mp4")
    result = await asyncio.get_event_loop().run_in_executor(None, storage_put, path, data, content_type)
    base = os.environ.get("PUBLIC_BACKEND_URL", "")  # optional
    file_url = f"/api/files/{result['path']}"
    v = {"id": str(uuid.uuid4()), "user_id": user["id"], "title": title,
        "description": description or "", "url": file_url, "thumbnail": "",
        "duration": float(duration or 0),
        "folder": folder or "All Videos",
        "views": 0, "plays": 0, "avg_engagement": 0.0,
        "storage_path": result["path"], "transcript_status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat()}
    await db.videos.insert_one(v)
    # auto-transcribe in background
    background.add_task(transcribe_video, v["id"], result["path"])
    return video_to_out(v)

@api_router.get("/files/{path:path}")
async def serve_file(path: str):
    """Public endpoint to serve uploaded video files (used as <video src>)."""
    try:
        data, ctype = await asyncio.get_event_loop().run_in_executor(None, storage_get, path)
    except requests.HTTPError as e:
        sc = e.response.status_code if e.response is not None else 502
        raise HTTPException(404 if sc == 404 else 502, "File not found" if sc == 404 else "Storage error")
    except Exception:
        raise HTTPException(502, "Storage error")
    return Response(content=data, media_type=ctype, headers={"Cache-Control": "public, max-age=3600"})

@api_router.get("/videos/{video_id}", response_model=Video)
async def get_video(video_id: str, user=Depends(get_current_user)):
    v = await db.videos.find_one({"id": video_id, "user_id": user["id"]}, {"_id": 0})
    if not v: raise HTTPException(404, "Video not found")
    return video_to_out(v)

@api_router.patch("/videos/{video_id}", response_model=Video)
async def update_video(video_id: str, body: VideoUpdate, user=Depends(get_current_user)):
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if updates: await db.videos.update_one({"id": video_id, "user_id": user["id"]}, {"$set": updates})
    v = await db.videos.find_one({"id": video_id, "user_id": user["id"]}, {"_id": 0})
    if not v: raise HTTPException(404, "Video not found")
    return video_to_out(v)

@api_router.delete("/videos/{video_id}")
async def delete_video(video_id: str, user=Depends(get_current_user)):
    r = await db.videos.delete_one({"id": video_id, "user_id": user["id"]})
    await db.transcripts.delete_one({"video_id": video_id})
    await db.segment_events.delete_many({"video_id": video_id})
    if r.deleted_count == 0: raise HTTPException(404, "Video not found")
    return {"ok": True}

@api_router.post("/videos/{video_id}/view")
async def track_view(video_id: str):
    await db.videos.update_one({"id": video_id}, {"$inc": {"views": 1}})
    return {"ok": True}


# ============ HEATMAP (5-sec segment tracking) ============
@api_router.post("/videos/{video_id}/segment")
async def track_segment(video_id: str, body: SegmentEvent):
    """Anonymous endpoint — record one 5-sec segment view/skip/rewatch."""
    if body.segment_index < 0 or body.segment_index > 10000:
        raise HTTPException(400, "Invalid segment index")
    await db.segment_events.insert_one({
        "video_id": video_id,
        "session_id": body.session_id,
        "segment_index": body.segment_index,
        "action": body.action,
        "ts": datetime.now(timezone.utc).isoformat(),
    })
    return {"ok": True}

@api_router.get("/videos/{video_id}/heatmap")
async def heatmap(video_id: str):
    """Aggregate segment events into a heatmap array."""
    pipeline = [
        {"$match": {"video_id": video_id}},
        {"$group": {
            "_id": "$segment_index",
            "watches": {"$sum": {"$cond": [{"$eq": ["$action", "watch"]}, 1, 0]}},
            "rewatches": {"$sum": {"$cond": [{"$eq": ["$action", "rewatch"]}, 1, 0]}},
            "skips": {"$sum": {"$cond": [{"$eq": ["$action", "skip"]}, 1, 0]}},
        }},
        {"$sort": {"_id": 1}},
    ]
    rows = await db.segment_events.aggregate(pipeline).to_list(2000)
    if not rows: return {"segments": [], "max_count": 0}
    max_c = max((r["watches"] + r["rewatches"] * 2) for r in rows) or 1
    return {
        "segments": [{"index": r["_id"], "watches": r["watches"],
            "rewatches": r["rewatches"], "skips": r["skips"],
            "intensity": (r["watches"] + r["rewatches"]*2) / max_c} for r in rows],
        "max_count": max_c,
    }


# ============ TRANSCRIPT ============
@api_router.get("/videos/{video_id}/transcript")
async def get_transcript(video_id: str, user=Depends(get_current_user)):
    v = await db.videos.find_one({"id": video_id, "user_id": user["id"]}, {"_id": 0})
    if not v: raise HTTPException(404, "Video not found")
    t = await db.transcripts.find_one({"video_id": video_id}, {"_id": 0})
    return {
        "status": v.get("transcript_status", "none"),
        "text": (t or {}).get("text", ""),
        "segments": (t or {}).get("segments", []),
    }

@api_router.post("/videos/{video_id}/transcribe")
async def trigger_transcribe(video_id: str, background: BackgroundTasks, user=Depends(get_current_user)):
    v = await db.videos.find_one({"id": video_id, "user_id": user["id"]}, {"_id": 0})
    if not v: raise HTTPException(404, "Video not found")
    if not v.get("storage_path"): raise HTTPException(400, "Video has no storage file to transcribe")
    background.add_task(transcribe_video, video_id, v["storage_path"])
    await db.videos.update_one({"id": video_id}, {"$set": {"transcript_status": "pending"}})
    return {"ok": True, "status": "pending"}


# ============ ANALYTICS ============
@api_router.get("/analytics/overview")
async def analytics_overview(user=Depends(get_current_user)):
    videos = await db.videos.find({"user_id": user["id"]}, {"_id": 0}).to_list(500)
    total_views = sum(v.get("views", 0) for v in videos)
    total_plays = sum(v.get("plays", 0) for v in videos)
    return {
        "total_videos": len(videos), "total_views": total_views, "total_plays": total_plays,
        "avg_engagement": 68,
        "trend": [
            {"day": "Mon", "views": 120, "plays": 80}, {"day": "Tue", "views": 180, "plays": 110},
            {"day": "Wed", "views": 240, "plays": 160}, {"day": "Thu", "views": 210, "plays": 140},
            {"day": "Fri", "views": 320, "plays": 220}, {"day": "Sat", "views": 280, "plays": 190},
            {"day": "Sun", "views": 360, "plays": 250},
        ],
    }


# ============ STATUS ============
class StatusCheckCreate(BaseModel):
    client_name: str

@api_router.post("/status")
async def create_status(input: StatusCheckCreate):
    doc = {"id": str(uuid.uuid4()), "client_name": input.client_name,
        "timestamp": datetime.now(timezone.utc).isoformat()}
    await db.status_checks.insert_one(doc)
    return doc


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"], allow_headers=["*"],
)

@app.on_event("startup")
async def on_start():
    init_storage()

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
