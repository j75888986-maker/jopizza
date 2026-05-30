from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, BackgroundTasks, UploadFile, File, Form, Header, Query, Response
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os, jwt, bcrypt, uuid, logging, httpx, requests, asyncio, tempfile, io, secrets
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

AUTH_COOKIE = "looma_session"
CSRF_COOKIE = "looma_csrf"

# Paths exempted from CSRF check (public mutating endpoints + body-password-authenticated endpoints).
CSRF_EXEMPT_EXACT = {
    "/api/auth/login",
    "/api/auth/register",
    "/api/auth/google/session",
    "/api/csrf",
}
def csrf_exempt_path(path: str) -> bool:
    if path in CSRF_EXEMPT_EXACT:
        return True
    if path.startswith("/api/public/"):
        return True
    if path.endswith("/segment") or path.endswith("/view"):
        return True
    return False


class CSRFMiddleware(BaseHTTPMiddleware):
    """Double-submit-token CSRF: state-changing requests must include
    X-CSRF-Token header matching the looma_csrf cookie."""
    async def dispatch(self, request: Request, call_next):
        if request.method in ("POST", "PUT", "PATCH", "DELETE"):
            if not csrf_exempt_path(request.url.path):
                cookie_t = request.cookies.get(CSRF_COOKIE)
                header_t = request.headers.get("X-CSRF-Token")
                if not cookie_t or not header_t or not secrets.compare_digest(cookie_t, header_t):
                    return JSONResponse({"detail": "CSRF token invalid"}, status_code=403)
        return await call_next(request)


def set_csrf_cookie(response: Response, token: str) -> None:
    # Non-HttpOnly so the SPA can read it and echo it as X-CSRF-Token
    response.set_cookie(
        key=CSRF_COOKIE, value=token,
        max_age=7 * 24 * 3600, httponly=False,
        secure=True, samesite="lax", path="/",
    )

def set_auth_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=AUTH_COOKIE, value=token,
        max_age=7 * 24 * 3600, httponly=True,
        secure=True, samesite="lax", path="/",
    )

def clear_auth_cookie(response: Response) -> None:
    response.delete_cookie(key=AUTH_COOKIE, path="/")

def user_to_out(u: dict) -> UserOut:
    return UserOut(id=u["id"], email=u["email"], name=u.get("name"),
        picture=u.get("picture"), provider=u.get("provider", "local"))

async def get_current_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> dict:
    # Prefer httpOnly cookie; fall back to Authorization header (for embeds / API clients)
    token: Optional[str] = request.cookies.get(AUTH_COOKIE)
    if not token and credentials:
        token = credentials.credentials
    if not token:
        raise HTTPException(401, "Not authenticated")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
        user_id = payload.get("sub")
    except jwt.PyJWTError:
        raise HTTPException(401, "Invalid token")
    u = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not u:
        raise HTTPException(401, "User not found")
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

@api_router.get("/csrf")
async def get_csrf(request: Request, response: Response):
    """Issue a CSRF token. Frontend calls this on app load and echoes the cookie back as X-CSRF-Token on mutating requests."""
    existing = request.cookies.get(CSRF_COOKIE)
    token = existing or secrets.token_urlsafe(32)
    set_csrf_cookie(response, token)
    return {"csrf_token": token}

@api_router.post("/auth/register", response_model=TokenOut)
async def register(req: RegisterReq, request: Request, response: Response):
    if await db.users.find_one({"email": req.email.lower()}):
        raise HTTPException(400, "Email already registered")
    user = {"id": str(uuid.uuid4()), "email": req.email.lower(),
        "name": req.name or req.email.split("@")[0],
        "password_hash": hash_pw(req.password), "provider": "local", "picture": None,
        "created_at": datetime.now(timezone.utc).isoformat()}
    await db.users.insert_one(user)
    tok = create_token(user["id"])
    set_auth_cookie(response, tok)
    set_csrf_cookie(response, request.cookies.get(CSRF_COOKIE) or secrets.token_urlsafe(32))
    return TokenOut(access_token=tok, user=user_to_out(user))

@api_router.post("/auth/login", response_model=TokenOut)
async def login(req: LoginReq, request: Request, response: Response):
    u = await db.users.find_one({"email": req.email.lower()}, {"_id": 0})
    if not u or not u.get("password_hash") or not verify_pw(req.password, u["password_hash"]):
        raise HTTPException(401, "Invalid email or password")
    tok = create_token(u["id"])
    set_auth_cookie(response, tok)
    set_csrf_cookie(response, request.cookies.get(CSRF_COOKIE) or secrets.token_urlsafe(32))
    return TokenOut(access_token=tok, user=user_to_out(u))

@api_router.post("/auth/logout")
async def logout(response: Response):
    clear_auth_cookie(response)
    return {"ok": True}

@api_router.get("/auth/me", response_model=UserOut)
async def me(user=Depends(get_current_user)):
    return user_to_out(user)

@api_router.post("/auth/google/session", response_model=TokenOut)
async def google_session(request: Request, response: Response):
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
    tok = create_token(u["id"])
    set_auth_cookie(response, tok)
    set_csrf_cookie(response, request.cookies.get(CSRF_COOKIE) or secrets.token_urlsafe(32))
    return TokenOut(access_token=tok, user=user_to_out(u))


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
    data: Optional[bytes] = None
    ctype: str = "application/octet-stream"
    try:
        data, ctype = await asyncio.get_event_loop().run_in_executor(None, storage_get, path)
    except requests.HTTPError as e:
        sc = e.response.status_code if e.response is not None else 502
        raise HTTPException(404 if sc == 404 else 502, "File not found" if sc == 404 else "Storage error")
    except Exception:
        raise HTTPException(502, "Storage error")
    if data is None:
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


# ============ BRAND ============
class BrandUpdate(BaseModel):
    color: Optional[str] = None
    logo_text: Optional[str] = None
    default_thumbnail: Optional[str] = None
    autoplay: Optional[bool] = None

def brand_defaults():
    return {"color": "#FF6B6B", "logo_text": "Looma", "default_thumbnail": "", "autoplay": False}

@api_router.get("/brand")
async def get_brand(user=Depends(get_current_user)):
    b = await db.brands.find_one({"user_id": user["id"]}, {"_id": 0, "user_id": 0}) or {}
    merged = {**brand_defaults(), **b}
    return merged

@api_router.put("/brand")
async def update_brand(body: BrandUpdate, user=Depends(get_current_user)):
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    await db.brands.update_one({"user_id": user["id"]},
        {"$set": {**updates, "user_id": user["id"], "updated_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True)
    b = await db.brands.find_one({"user_id": user["id"]}, {"_id": 0, "user_id": 0}) or {}
    return {**brand_defaults(), **b}


# ============ PUBLIC VIDEO (for /embed/:id and /v/:id) ============
@api_router.get("/public/videos/{video_id}")
async def public_video(video_id: str):
    """Anonymous endpoint — returns video + owner brand for embeddable / shareable players."""
    v = await db.videos.find_one({"id": video_id}, {"_id": 0})
    if not v: raise HTTPException(404, "Video not found")
    b = await db.brands.find_one({"user_id": v["user_id"]}, {"_id": 0, "user_id": 0}) or {}
    brand = {**brand_defaults(), **b}
    return {
        "id": v["id"], "title": v.get("title", ""),
        "description": v.get("description", ""),
        "url": v.get("url", ""), "thumbnail": v.get("thumbnail", ""),
        "duration": v.get("duration", 0),
        "views": v.get("views", 0),
        "brand": brand,
    }


# ============ WEBINARS ============
class WebinarCreate(BaseModel):
    title: str
    description: Optional[str] = ""
    scheduled_at: Optional[str] = None  # ISO string

class WebinarUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    scheduled_at: Optional[str] = None
    status: Optional[str] = None  # scheduled|live|ended

class WebinarRegister(BaseModel):
    email: EmailStr
    name: Optional[str] = None

def webinar_to_out(w: dict, host: Optional[dict] = None) -> dict:
    return {
        "id": w["id"],
        "host_id": w["host_id"],
        "host_name": (host or {}).get("name") or "",
        "title": w.get("title", ""),
        "description": w.get("description", ""),
        "scheduled_at": w.get("scheduled_at"),
        "status": w.get("status", "scheduled"),
        "registrations_count": w.get("registrations_count", 0),
        "recording_chunks": w.get("recording_chunks", []),
        "recording_video_id": w.get("recording_video_id"),
        "created_at": w.get("created_at"),
    }

@api_router.get("/webinars")
async def list_webinars(user=Depends(get_current_user)):
    rows = await db.webinars.find({"host_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return [webinar_to_out(r, user) for r in rows]

@api_router.post("/webinars")
async def create_webinar(body: WebinarCreate, user=Depends(get_current_user)):
    w = {
        "id": str(uuid.uuid4()), "host_id": user["id"],
        "title": body.title, "description": body.description or "",
        "scheduled_at": body.scheduled_at,
        "status": "scheduled", "registrations_count": 0,
        "recording_chunks": [], "recording_video_id": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.webinars.insert_one(w)
    return webinar_to_out(w, user)

@api_router.get("/webinars/{wid}")
async def get_webinar(wid: str, user=Depends(get_current_user)):
    w = await db.webinars.find_one({"id": wid, "host_id": user["id"]}, {"_id": 0})
    if not w: raise HTTPException(404, "Webinar not found")
    return webinar_to_out(w, user)

@api_router.patch("/webinars/{wid}")
async def update_webinar(wid: str, body: WebinarUpdate, user=Depends(get_current_user)):
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if updates: await db.webinars.update_one({"id": wid, "host_id": user["id"]}, {"$set": updates})
    w = await db.webinars.find_one({"id": wid, "host_id": user["id"]}, {"_id": 0})
    if not w: raise HTTPException(404, "Webinar not found")
    return webinar_to_out(w, user)

@api_router.delete("/webinars/{wid}")
async def delete_webinar(wid: str, user=Depends(get_current_user)):
    r = await db.webinars.delete_one({"id": wid, "host_id": user["id"]})
    await db.webinar_registrations.delete_many({"webinar_id": wid})
    if r.deleted_count == 0: raise HTTPException(404, "Webinar not found")
    return {"ok": True}

# Public webinar info (for registration page)
@api_router.get("/public/webinars/{wid}")
async def public_webinar(wid: str):
    w = await db.webinars.find_one({"id": wid}, {"_id": 0})
    if not w: raise HTTPException(404, "Webinar not found")
    host = await db.users.find_one({"id": w["host_id"]}, {"_id": 0})
    brand = await db.brands.find_one({"user_id": w["host_id"]}, {"_id": 0, "user_id": 0}) or {}
    return {
        "id": w["id"], "title": w.get("title", ""), "description": w.get("description", ""),
        "scheduled_at": w.get("scheduled_at"), "status": w.get("status"),
        "host_name": (host or {}).get("name", ""),
        "brand": {**brand_defaults(), **brand},
        "recording_chunks": w.get("recording_chunks", []) if w.get("status") == "live" else [],
        "recording_video_id": w.get("recording_video_id") if w.get("status") == "ended" else None,
    }

@api_router.get("/public/webinars/{wid}/recording")
async def public_webinar_recording(wid: str):
    """Public endpoint — returns the ended webinar's recording video (no auth)."""
    w = await db.webinars.find_one({"id": wid}, {"_id": 0})
    if not w: raise HTTPException(404, "Webinar not found")
    if w.get("status") != "ended" or not w.get("recording_video_id"):
        raise HTTPException(404, "Recording not available")
    v = await db.videos.find_one({"id": w["recording_video_id"]}, {"_id": 0})
    if not v: raise HTTPException(404, "Recording not found")
    b = await db.brands.find_one({"user_id": w["host_id"]}, {"_id": 0, "user_id": 0}) or {}
    return {
        "id": v["id"], "title": v.get("title", ""),
        "description": v.get("description", ""),
        "url": v.get("url", ""), "thumbnail": v.get("thumbnail", ""),
        "duration": v.get("duration", 0), "views": v.get("views", 0),
        "brand": {**brand_defaults(), **b},
        "webinar_title": w.get("title", ""),
    }

@api_router.post("/public/webinars/{wid}/register")
async def register_for_webinar(wid: str, body: WebinarRegister):
    w = await db.webinars.find_one({"id": wid}, {"_id": 0})
    if not w: raise HTTPException(404, "Webinar not found")
    existing = await db.webinar_registrations.find_one({"webinar_id": wid, "email": body.email.lower()})
    if existing: return {"ok": True, "already_registered": True}
    await db.webinar_registrations.insert_one({
        "id": str(uuid.uuid4()), "webinar_id": wid,
        "email": body.email.lower(), "name": body.name or "",
        "registered_at": datetime.now(timezone.utc).isoformat(),
    })
    await db.webinars.update_one({"id": wid}, {"$inc": {"registrations_count": 1}})
    return {"ok": True, "already_registered": False}

# Live chunk upload (host)
@api_router.post("/webinars/{wid}/chunk")
async def upload_webinar_chunk(
    wid: str,
    background: BackgroundTasks,
    file: UploadFile = File(...),
    seq: int = Form(...),
    user=Depends(get_current_user),
):
    w = await db.webinars.find_one({"id": wid, "host_id": user["id"]}, {"_id": 0})
    if not w: raise HTTPException(404, "Webinar not found")
    data = await file.read()
    path = f"{APP_NAME}/webinars/{wid}/chunk_{seq:05d}.webm"
    await asyncio.get_event_loop().run_in_executor(None, storage_put, path, data, "video/webm")
    chunk_url = f"/api/files/{path}"
    await db.webinars.update_one({"id": wid}, {
        "$set": {"status": "live"},
        "$addToSet": {"recording_chunks": {"seq": seq, "url": chunk_url, "path": path}},
    })
    return {"ok": True, "url": chunk_url, "seq": seq}

# End live: optionally consolidate chunks into a single video record
@api_router.post("/webinars/{wid}/end")
async def end_webinar(wid: str, user=Depends(get_current_user)):
    w = await db.webinars.find_one({"id": wid, "host_id": user["id"]}, {"_id": 0})
    if not w: raise HTTPException(404, "Webinar not found")
    # Persist recording as a regular video using the first chunk URL (full recording = all chunks concatenated client-side)
    chunks = sorted(w.get("recording_chunks", []), key=lambda c: c.get("seq", 0))
    video_id = None
    if chunks:
        v = {"id": str(uuid.uuid4()), "user_id": user["id"],
             "title": f"Recording: {w.get('title','Webinar')}",
             "description": w.get("description", ""),
             "url": chunks[0]["url"],
             "thumbnail": "", "duration": 0,
             "folder": "Webinar Recordings",
             "views": 0, "plays": 0, "avg_engagement": 0.0,
             "storage_path": chunks[0]["path"],
             "transcript_status": "none",
             "created_at": datetime.now(timezone.utc).isoformat()}
        await db.videos.insert_one(v)
        video_id = v["id"]
    await db.webinars.update_one({"id": wid}, {"$set": {"status": "ended", "recording_video_id": video_id}})
    w = await db.webinars.find_one({"id": wid}, {"_id": 0})
    return webinar_to_out(w, user)


# ============ EXPORT (DB dump as JSON for the user) ============
@api_router.get("/admin/export")
async def export_my_data(user=Depends(get_current_user)):
    """Export everything the current user owns as JSON (best-effort DB 'download')."""
    out = {"exported_at": datetime.now(timezone.utc).isoformat(),
           "user": {k: v for k, v in user.items() if k != "password_hash"}}
    out["videos"] = await db.videos.find({"user_id": user["id"]}, {"_id": 0}).to_list(1000)
    video_ids = [v["id"] for v in out["videos"]]
    out["transcripts"] = await db.transcripts.find({"video_id": {"$in": video_ids}}, {"_id": 0}).to_list(2000)
    out["segment_events"] = await db.segment_events.find({"video_id": {"$in": video_ids}}, {"_id": 0}).to_list(20000)
    out["webinars"] = await db.webinars.find({"host_id": user["id"]}, {"_id": 0}).to_list(500)
    webinar_ids = [w["id"] for w in out["webinars"]]
    out["webinar_registrations"] = await db.webinar_registrations.find({"webinar_id": {"$in": webinar_ids}}, {"_id": 0}).to_list(5000)
    out["brand"] = await db.brands.find_one({"user_id": user["id"]}, {"_id": 0}) or {}
    return out


app.include_router(api_router)

app.add_middleware(CSRFMiddleware)

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
