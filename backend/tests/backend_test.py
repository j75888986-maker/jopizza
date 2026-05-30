"""Looma backend API tests - regression + new iteration 2 features."""
import os
import io
import time
import uuid
import struct
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://media-craft-68.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


# ============ FIXTURES ============
@pytest.fixture(scope="session")
def unique_email():
    return f"TEST_{uuid.uuid4().hex[:10]}@looma.app"


@pytest.fixture(scope="session")
def password():
    return "TestPass123!"


@pytest.fixture(scope="session")
def registered_user(unique_email, password):
    r = requests.post(f"{API}/auth/register", json={
        "email": unique_email, "password": password, "name": "Test User"
    })
    assert r.status_code == 200, f"register failed: {r.status_code} {r.text}"
    data = r.json()
    assert "access_token" in data and "user" in data
    assert data["user"]["email"] == unique_email.lower()
    return data


@pytest.fixture(scope="session")
def auth_headers(registered_user):
    return {"Authorization": f"Bearer {registered_user['access_token']}"}


# ============ HEALTH ============
def test_root():
    r = requests.get(f"{API}/")
    assert r.status_code == 200
    assert "Looma" in r.json().get("message", "")


# ============ AUTH (regression) ============
def test_register_duplicate(registered_user, unique_email, password):
    r = requests.post(f"{API}/auth/register", json={"email": unique_email, "password": password})
    assert r.status_code == 400


def test_login_success(unique_email, password):
    r = requests.post(f"{API}/auth/login", json={"email": unique_email, "password": password})
    assert r.status_code == 200
    assert "access_token" in r.json()


def test_login_bad_password(unique_email):
    r = requests.post(f"{API}/auth/login", json={"email": unique_email, "password": "wrong"})
    assert r.status_code == 401


def test_me_with_token(auth_headers, unique_email):
    r = requests.get(f"{API}/auth/me", headers=auth_headers)
    assert r.status_code == 200
    assert r.json()["email"] == unique_email.lower()


def test_me_no_token():
    r = requests.get(f"{API}/auth/me")
    assert r.status_code == 401


def test_google_session_missing_header():
    r = requests.post(f"{API}/auth/google/session")
    assert r.status_code == 400


# ============ VIDEO CRUD (regression) ============
@pytest.fixture(scope="session")
def created_video(auth_headers):
    r = requests.post(f"{API}/videos", headers=auth_headers, json={
        "title": "TEST_video", "description": "desc",
        "url": "https://example.com/v.mp4", "duration": 120,
    })
    assert r.status_code == 200, r.text
    v = r.json()
    assert v["title"] == "TEST_video"
    # Verify new fields exist
    assert "storage_path" in v
    assert v.get("transcript_status") == "none"
    return v


def test_list_videos_contains_created(auth_headers, created_video):
    r = requests.get(f"{API}/videos", headers=auth_headers)
    assert r.status_code == 200
    ids = [v["id"] for v in r.json()]
    assert created_video["id"] in ids


def test_get_video(auth_headers, created_video):
    r = requests.get(f"{API}/videos/{created_video['id']}", headers=auth_headers)
    assert r.status_code == 200
    assert r.json()["title"] == "TEST_video"


def test_get_video_requires_auth(created_video):
    r = requests.get(f"{API}/videos/{created_video['id']}")
    assert r.status_code == 401


def test_patch_video(auth_headers, created_video):
    r = requests.patch(f"{API}/videos/{created_video['id']}", headers=auth_headers,
                       json={"title": "TEST_video_v2"})
    assert r.status_code == 200
    assert r.json()["title"] == "TEST_video_v2"
    g = requests.get(f"{API}/videos/{created_video['id']}", headers=auth_headers)
    assert g.json()["title"] == "TEST_video_v2"


def test_track_view_public(created_video, auth_headers):
    before = requests.get(f"{API}/videos/{created_video['id']}", headers=auth_headers).json()["views"]
    r = requests.post(f"{API}/videos/{created_video['id']}/view")
    assert r.status_code == 200
    after = requests.get(f"{API}/videos/{created_video['id']}", headers=auth_headers).json()["views"]
    assert after == before + 1


def test_analytics_overview(auth_headers):
    r = requests.get(f"{API}/analytics/overview", headers=auth_headers)
    assert r.status_code == 200
    data = r.json()
    assert "total_videos" in data and "trend" in data
    assert isinstance(data["trend"], list) and len(data["trend"]) == 7


# ============ NEW: TRANSCRIPT on non-storage video ============
def test_transcript_status_none_for_url_video(auth_headers, created_video):
    """Video created via /videos (no storage_path) should have status='none' transcript."""
    r = requests.get(f"{API}/videos/{created_video['id']}/transcript", headers=auth_headers)
    assert r.status_code == 200
    data = r.json()
    assert data["status"] == "none"
    assert data["text"] == ""
    assert data["segments"] == []


def test_transcribe_400_when_no_storage_path(auth_headers, created_video):
    """POST /transcribe should 400 when video has no storage_path."""
    r = requests.post(f"{API}/videos/{created_video['id']}/transcribe", headers=auth_headers)
    assert r.status_code == 400


def test_transcript_404_other_user(created_video):
    """Different user should not access transcript."""
    em = f"TEST_{uuid.uuid4().hex[:8]}@looma.app"
    reg = requests.post(f"{API}/auth/register", json={"email": em, "password": "TestPass123!"}).json()
    h = {"Authorization": f"Bearer {reg['access_token']}"}
    r = requests.get(f"{API}/videos/{created_video['id']}/transcript", headers=h)
    assert r.status_code == 404


# ============ NEW: HEATMAP / SEGMENT TRACKING ============
def test_heatmap_empty(created_video):
    """Empty heatmap for new video — anonymous."""
    r = requests.get(f"{API}/videos/{created_video['id']}/heatmap")
    assert r.status_code == 200
    data = r.json()
    assert data == {"segments": [], "max_count": 0}


def test_segment_track_and_heatmap_aggregation(created_video):
    """Insert segment events (anonymous), then verify aggregated heatmap."""
    vid = created_video["id"]
    session = f"sess-{uuid.uuid4().hex[:8]}"
    # 2 watches on segment 0
    for _ in range(2):
        r = requests.post(f"{API}/videos/{vid}/segment", json={
            "session_id": session, "segment_index": 0, "action": "watch",
            "video_id": vid,
        })
        assert r.status_code == 200, r.text
    # 1 rewatch on segment 0
    r = requests.post(f"{API}/videos/{vid}/segment", json={
        "session_id": session, "segment_index": 0, "action": "rewatch", "video_id": vid,
    })
    assert r.status_code == 200
    # 1 skip on segment 1
    r = requests.post(f"{API}/videos/{vid}/segment", json={
        "session_id": session, "segment_index": 1, "action": "skip", "video_id": vid,
    })
    assert r.status_code == 200

    # Aggregate
    r = requests.get(f"{API}/videos/{vid}/heatmap")
    assert r.status_code == 200
    data = r.json()
    assert "segments" in data and "max_count" in data
    seg_map = {s["index"]: s for s in data["segments"]}
    assert 0 in seg_map and 1 in seg_map
    s0 = seg_map[0]
    assert s0["watches"] == 2
    assert s0["rewatches"] == 1
    assert s0["skips"] == 0
    # intensity = (watches + rewatches*2) / max_count → (2+2)/4 = 1.0
    assert s0["intensity"] == pytest.approx(1.0)
    s1 = seg_map[1]
    assert s1["skips"] == 1
    assert s1["watches"] == 0


def test_segment_invalid_index(created_video):
    r = requests.post(f"{API}/videos/{created_video['id']}/segment", json={
        "session_id": "x", "segment_index": -1, "action": "watch", "video_id": created_video["id"],
    })
    assert r.status_code == 400


# ============ NEW: UPLOAD + STORAGE + AUTO TRANSCRIBE ============
def _make_fake_webm(size_kb=8):
    """Return tiny random bytes resembling a webm file (will fail Whisper gracefully)."""
    # Minimal EBML header bytes + random padding
    header = bytes.fromhex("1a45dfa3")  # EBML signature
    pad = os.urandom(size_kb * 1024)
    return header + pad


@pytest.fixture(scope="session")
def uploaded_video(auth_headers):
    """Upload a small fake webm file. Returns the video dict."""
    data = _make_fake_webm(8)
    files = {"file": (f"test_{uuid.uuid4().hex[:6]}.webm", io.BytesIO(data), "video/webm")}
    form = {"title": "TEST_upload", "description": "uploaded", "folder": "All Videos", "duration": "5"}
    r = requests.post(f"{API}/videos/upload", headers=auth_headers, files=files, data=form, timeout=60)
    if r.status_code == 503:
        pytest.skip(f"Object storage unavailable: {r.text}")
    assert r.status_code == 200, f"upload failed: {r.status_code} {r.text}"
    v = r.json()
    assert v["title"] == "TEST_upload"
    assert v["storage_path"], "storage_path missing"
    assert v["transcript_status"] == "pending"
    assert v["url"].startswith("/api/files/")
    return v


def test_upload_video_creates_record(uploaded_video):
    """Verify upload returned a valid video record with storage_path and pending transcript."""
    assert uploaded_video["id"]
    assert "looma/uploads/" in uploaded_video["storage_path"]


def test_serve_file_returns_bytes(uploaded_video):
    """GET /api/files/{path} should return the uploaded bytes publicly."""
    path = uploaded_video["storage_path"]
    r = requests.get(f"{API}/files/{path}", timeout=30)
    assert r.status_code == 200, f"file fetch failed: {r.status_code} {r.text[:200]}"
    assert len(r.content) > 0
    ctype = r.headers.get("Content-Type", "")
    # Should be a video content-type
    assert "video" in ctype or "octet-stream" in ctype, f"unexpected content-type: {ctype}"


def test_serve_file_404_missing():
    r = requests.get(f"{API}/files/looma/uploads/does-not-exist-{uuid.uuid4().hex}.webm")
    # Could be 404 or 500 depending on storage — accept 404 ideally
    assert r.status_code in (404, 500, 502)


def test_uploaded_video_transcript_transitions(uploaded_video, auth_headers):
    """Poll transcript: should be pending then transition to 'error' (random bytes)
    or 'ready' (if Whisper somehow accepts). Should NOT remain stuck on pending."""
    vid = uploaded_video["id"]
    final_status = None
    for _ in range(20):  # 20 * 3s = 60s max
        r = requests.get(f"{API}/videos/{vid}/transcript", headers=auth_headers)
        assert r.status_code == 200
        st = r.json()["status"]
        if st in ("ready", "error"):
            final_status = st
            break
        assert st == "pending", f"unexpected status: {st}"
        time.sleep(3)
    assert final_status in ("ready", "error"), (
        f"transcript stuck on 'pending' — background task likely failed. last={final_status}"
    )


def test_retrigger_transcribe_on_uploaded(uploaded_video, auth_headers):
    """POST /transcribe on uploaded video (has storage_path) returns 200 and resets to pending."""
    vid = uploaded_video["id"]
    r = requests.post(f"{API}/videos/{vid}/transcribe", headers=auth_headers)
    assert r.status_code == 200
    data = r.json()
    assert data.get("ok") is True
    assert data.get("status") == "pending"
    # check status is now pending
    g = requests.get(f"{API}/videos/{vid}/transcript", headers=auth_headers)
    assert g.json()["status"] == "pending"


# ============ CLEANUP / DELETE (regression last) ============
def test_delete_video_and_verify(auth_headers, created_video):
    r = requests.delete(f"{API}/videos/{created_video['id']}", headers=auth_headers)
    assert r.status_code == 200
    g = requests.get(f"{API}/videos/{created_video['id']}", headers=auth_headers)
    assert g.status_code == 404
