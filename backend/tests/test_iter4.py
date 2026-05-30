"""
Iteration 4 backend tests — httpOnly cookie auth + new public webinar recording endpoint
+ serve_file lint fix sanity.

What's covered:
  - register/login set Set-Cookie 'looma_session' with HttpOnly/Secure/SameSite=lax/Max-Age=604800/Path=/
  - GET /api/auth/me with COOKIE ONLY succeeds
  - GET /api/auth/me with BEARER ONLY (backward compat) succeeds
  - POST /api/auth/logout clears the cookie (Max-Age=0) and does not require auth
  - After logout, the (deleted) cookie returns 401
  - 3 authenticated endpoints work via cookie-only: /api/videos, /api/brand, /api/webinars
  - GET /api/public/webinars/{wid}/recording: 404 missing webinar, 404 webinar not-ended,
    200 with required keys once webinar is ended + recording_video_id populated
  - GET /api/files/{path}: 200 for valid path, 404 for missing path (lint-fix sanity)
  - /api/auth/google/session: 400 without X-Session-ID header (code path executed)
"""
import io
import os
import uuid
import struct
import pytest
import requests

BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or "").rstrip("/")
assert BASE_URL, "REACT_APP_BACKEND_URL must be set"
API = f"{BASE_URL}/api"
AUTH_COOKIE = "looma_session"


# ---------- helpers ----------
def _unique_email(prefix="iter4"):
    return f"TEST_{prefix}_{uuid.uuid4().hex[:10]}@looma.app"


def _tiny_webm_bytes(seq: int = 0) -> bytes:
    # 32-byte EBML-ish marker + seq tag — enough to satisfy multipart upload
    return b"\x1a\x45\xdf\xa3" + struct.pack(">I", seq) + os.urandom(24)


def _register(session: requests.Session, email=None, password="TestPass123!"):
    email = email or _unique_email()
    r = session.post(f"{API}/auth/register", json={"email": email, "password": password, "name": "Iter4"})
    assert r.status_code == 200, f"register failed: {r.status_code} {r.text}"
    return email, password, r


# ---------- fixtures ----------
@pytest.fixture()
def fresh_session():
    s = requests.Session()
    yield s
    s.close()


@pytest.fixture(scope="module")
def host_session():
    """One module-scoped logged-in user (via cookie) used for cookie-auth-protected tests."""
    s = requests.Session()
    _register(s)
    yield s
    s.close()


# ---------- 1. cookie attributes on register/login ----------
def test_register_sets_looma_session_cookie_with_all_attrs(fresh_session):
    email, pw, r = _register(fresh_session)
    # The Session jar should have the cookie
    assert AUTH_COOKIE in fresh_session.cookies.keys(), f"cookie not set: {dict(fresh_session.cookies)}"
    # Inspect raw Set-Cookie header for attribute flags
    set_cookie = r.headers.get("set-cookie") or ""
    # Header may include multiple Set-Cookie joined by comma — find ours
    assert "looma_session=" in set_cookie
    looma_part = [c for c in set_cookie.split(",") if "looma_session=" in c]
    assert looma_part, f"no looma_session segment in: {set_cookie}"
    seg = looma_part[0]
    assert "HttpOnly" in seg, seg
    assert "Secure" in seg, seg
    assert "SameSite=lax" in seg or "SameSite=Lax" in seg, seg
    assert "Max-Age=604800" in seg, seg
    assert "Path=/" in seg, seg


def test_login_sets_looma_session_cookie(fresh_session):
    email, pw, _ = _register(fresh_session)
    # Drop cookies from register; explicitly login again
    fresh_session.cookies.clear()
    r = fresh_session.post(f"{API}/auth/login", json={"email": email, "password": pw})
    assert r.status_code == 200
    assert AUTH_COOKIE in fresh_session.cookies.keys()
    set_cookie = r.headers.get("set-cookie") or ""
    assert "looma_session=" in set_cookie
    assert "HttpOnly" in set_cookie and "Max-Age=604800" in set_cookie


# ---------- 2. /auth/me by cookie ONLY ----------
def test_me_with_cookie_only_succeeds(fresh_session):
    email, pw, _ = _register(fresh_session)
    # No Authorization header — cookie is in the session jar
    r = fresh_session.get(f"{API}/auth/me")
    assert r.status_code == 200, r.text
    assert r.json()["email"] == email.lower()


# ---------- 3. /auth/me by bearer ONLY (backward compat) ----------
def test_me_with_bearer_only_succeeds():
    s = requests.Session()
    email, pw, reg = _register(s)
    tok = reg.json()["access_token"]
    # Fresh session, no cookies, only Authorization header
    s2 = requests.Session()
    r = s2.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {tok}"})
    assert r.status_code == 200, r.text
    assert r.json()["email"] == email.lower()


def test_me_without_any_auth_returns_401():
    s = requests.Session()
    r = s.get(f"{API}/auth/me")
    assert r.status_code in (401, 403)


# ---------- 4. logout clears cookie and does not require auth ----------
def test_logout_clears_cookie_and_subsequent_me_is_401():
    s = requests.Session()
    _register(s)
    # confirm me works
    assert s.get(f"{API}/auth/me").status_code == 200
    r = s.post(f"{API}/auth/logout")
    assert r.status_code == 200, r.text
    set_cookie = r.headers.get("set-cookie") or ""
    assert "looma_session=" in set_cookie
    # Browser-equivalent: cookie cleared (Max-Age=0 or expired)
    assert ("Max-Age=0" in set_cookie) or ("max-age=0" in set_cookie) or ("Expires=" in set_cookie)
    # Session jar should no longer carry a usable cookie
    assert s.cookies.get(AUTH_COOKIE) in (None, "", '""'), f"jar still has cookie: {dict(s.cookies)}"
    # Subsequent /me without any auth → 401
    s.cookies.clear()
    assert s.get(f"{API}/auth/me").status_code in (401, 403)


def test_logout_endpoint_does_not_require_auth():
    """POST /api/auth/logout should succeed even when no cookie/header is present."""
    s = requests.Session()
    r = s.post(f"{API}/auth/logout")
    assert r.status_code == 200, r.text
    assert r.json().get("ok") is True


# ---------- 5. authenticated endpoints work via cookie-only ----------
def test_videos_endpoint_with_cookie_only(host_session):
    r = host_session.get(f"{API}/videos")
    assert r.status_code == 200, r.text
    assert isinstance(r.json(), list)


def test_brand_endpoint_with_cookie_only(host_session):
    r = host_session.get(f"{API}/brand")
    assert r.status_code == 200, r.text
    j = r.json()
    # brand_defaults should include at least these
    for k in ("color", "logo_text"):
        assert k in j


def test_webinars_endpoint_with_cookie_only(host_session):
    r = host_session.get(f"{API}/webinars")
    assert r.status_code == 200, r.text
    assert isinstance(r.json(), list)


# ---------- 6. google session endpoint without X-Session-ID → 400 ----------
def test_google_session_missing_header_returns_400():
    r = requests.post(f"{API}/auth/google/session")
    assert r.status_code == 400, r.text


# ---------- 7. /api/public/webinars/{wid}/recording ----------
def test_public_recording_404_when_webinar_missing():
    r = requests.get(f"{API}/public/webinars/{uuid.uuid4().hex}/recording")
    assert r.status_code == 404


def test_public_recording_404_when_not_ended(host_session):
    # create a scheduled (default) webinar
    r = host_session.post(f"{API}/webinars", json={
        "title": "TEST_iter4_scheduled", "description": "x",
        "scheduled_at": "2099-01-01T00:00:00+00:00",
    })
    assert r.status_code == 200, r.text
    wid = r.json()["id"]
    rr = requests.get(f"{API}/public/webinars/{wid}/recording")
    assert rr.status_code == 404, rr.text
    # cleanup
    host_session.delete(f"{API}/webinars/{wid}")


def test_public_recording_200_when_webinar_ended_with_recording(host_session):
    # 1) create webinar
    r = host_session.post(f"{API}/webinars", json={
        "title": "TEST_iter4_recording_flow", "description": "rec",
        "scheduled_at": "2099-01-01T00:00:00+00:00",
    })
    assert r.status_code == 200, r.text
    wid = r.json()["id"]

    # 2) upload one chunk → flips to live
    files = {"file": ("c0.webm", io.BytesIO(_tiny_webm_bytes(0)), "video/webm")}
    cr = host_session.post(f"{API}/webinars/{wid}/chunk", data={"seq": 0}, files=files)
    assert cr.status_code == 200, cr.text

    # 3) end the webinar
    er = host_session.post(f"{API}/webinars/{wid}/end")
    assert er.status_code == 200, er.text

    # 4) public recording must now return 200 with required keys
    pr = requests.get(f"{API}/public/webinars/{wid}/recording")
    assert pr.status_code == 200, pr.text
    body = pr.json()
    for k in ("id", "title", "url", "brand", "webinar_title"):
        assert k in body, f"missing key {k} in {body}"
    assert body["webinar_title"] == "TEST_iter4_recording_flow"
    # brand should include defaults
    assert "color" in body["brand"]

    # cleanup webinar (leaves derived recording video — harmless)
    host_session.delete(f"{API}/webinars/{wid}")


# ---------- 8. /api/files/{path} — lint-fix sanity ----------
def test_files_missing_path_returns_404_or_502_not_500(host_session):
    """The lint-fix initializes data/ctype before try-block; ensure no unbound error (500)."""
    r = requests.get(f"{API}/files/looma/__definitely_missing__/{uuid.uuid4().hex}.webm")
    assert r.status_code in (404, 502), f"got {r.status_code} {r.text[:200]}"
    assert r.status_code != 500


def test_files_valid_path_serves_content(host_session):
    """Upload a tiny file via the webinar chunk path, then fetch it via /api/files."""
    # create webinar
    r = host_session.post(f"{API}/webinars", json={
        "title": "TEST_iter4_files_sanity", "description": "f",
        "scheduled_at": "2099-01-01T00:00:00+00:00",
    })
    assert r.status_code == 200, r.text
    wid = r.json()["id"]
    files = {"file": ("c.webm", io.BytesIO(_tiny_webm_bytes(7)), "video/webm")}
    cr = host_session.post(f"{API}/webinars/{wid}/chunk", data={"seq": 7}, files=files)
    assert cr.status_code == 200, cr.text
    # Storage path is deterministic per server.py: looma/webinars/{wid}/chunk_{seq:05d}.webm
    path = f"looma/webinars/{wid}/chunk_00007.webm"
    fr = requests.get(f"{API}/files/{path}")
    assert fr.status_code == 200, f"got {fr.status_code} {fr.text[:200]}"
    assert len(fr.content) > 0
    # cleanup
    host_session.delete(f"{API}/webinars/{wid}")
