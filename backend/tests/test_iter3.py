"""Iteration 3 backend tests — brand, public video, webinars, registration,
chunk live streaming, webinar end, owner isolation, and /admin/export."""
import os
import io
import uuid
import pytest
import requests

BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL")
            or "https://media-craft-68.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


# ============ FIXTURES (per-module, fresh users) ============
@pytest.fixture(scope="module")
def user_a():
    em = f"TEST_a_{uuid.uuid4().hex[:8]}@looma.app"
    r = requests.post(f"{API}/auth/register",
                      json={"email": em, "password": "TestPass123!", "name": "Alice A"})
    assert r.status_code == 200, r.text
    data = r.json()
    return {"email": em, "token": data["access_token"], "id": data["user"]["id"],
            "headers": {"Authorization": f"Bearer {data['access_token']}"}}


@pytest.fixture(scope="module")
def user_b():
    em = f"TEST_b_{uuid.uuid4().hex[:8]}@looma.app"
    r = requests.post(f"{API}/auth/register",
                      json={"email": em, "password": "TestPass123!", "name": "Bob B"})
    assert r.status_code == 200, r.text
    data = r.json()
    return {"email": em, "token": data["access_token"], "id": data["user"]["id"],
            "headers": {"Authorization": f"Bearer {data['access_token']}"}}


# ============ BRAND ============
class TestBrand:
    def test_brand_defaults_for_fresh_user(self, user_a):
        r = requests.get(f"{API}/brand", headers=user_a["headers"])
        assert r.status_code == 200
        b = r.json()
        assert b["color"] == "#FF6B6B"
        assert b["logo_text"] == "Looma"
        assert b["default_thumbnail"] == ""
        assert b["autoplay"] is False

    def test_brand_requires_auth(self):
        r = requests.get(f"{API}/brand")
        assert r.status_code == 401

    def test_brand_put_partial_merge_and_persist(self, user_a):
        # Partial: only color
        r = requests.put(f"{API}/brand", headers=user_a["headers"],
                         json={"color": "#123456"})
        assert r.status_code == 200
        b = r.json()
        assert b["color"] == "#123456"
        assert b["logo_text"] == "Looma"  # default still present
        assert b["autoplay"] is False

        # Partial: logo_text + autoplay — should NOT clobber color
        r = requests.put(f"{API}/brand", headers=user_a["headers"],
                         json={"logo_text": "BrandA", "autoplay": True})
        assert r.status_code == 200
        b = r.json()
        assert b["color"] == "#123456"  # preserved
        assert b["logo_text"] == "BrandA"
        assert b["autoplay"] is True

        # GET reflects persisted state
        g = requests.get(f"{API}/brand", headers=user_a["headers"])
        assert g.status_code == 200
        bg = g.json()
        assert bg["color"] == "#123456"
        assert bg["logo_text"] == "BrandA"
        assert bg["autoplay"] is True


# ============ PUBLIC VIDEO ============
class TestPublicVideo:
    def test_public_video_404(self):
        r = requests.get(f"{API}/public/videos/does-not-exist-{uuid.uuid4().hex}")
        assert r.status_code == 404

    def test_public_video_returns_owner_brand(self, user_a):
        # Make sure user_a brand is set (TestBrand may have run first; ensure deterministic)
        requests.put(f"{API}/brand", headers=user_a["headers"],
                     json={"color": "#ABCDEF", "logo_text": "BrandA"})

        cv = requests.post(f"{API}/videos", headers=user_a["headers"], json={
            "title": "TEST_pub", "description": "p", "url": "https://x/y.mp4", "duration": 10
        })
        assert cv.status_code == 200
        vid = cv.json()["id"]

        # Anonymous GET (no auth header)
        r = requests.get(f"{API}/public/videos/{vid}")
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["id"] == vid
        assert data["title"] == "TEST_pub"
        assert data["url"] == "https://x/y.mp4"
        assert "brand" in data
        # Brand comes from the OWNER (user_a)
        assert data["brand"]["color"] == "#ABCDEF"
        assert data["brand"]["logo_text"] == "BrandA"


# ============ WEBINAR CRUD ============
class TestWebinarCRUD:
    def test_create_webinar(self, user_a):
        r = requests.post(f"{API}/webinars", headers=user_a["headers"], json={
            "title": "TEST_webinar", "description": "desc",
            "scheduled_at": "2026-02-01T10:00:00Z"
        })
        assert r.status_code == 200, r.text
        w = r.json()
        assert w["title"] == "TEST_webinar"
        assert w["status"] == "scheduled"
        assert w["registrations_count"] == 0
        assert w["recording_chunks"] == []
        assert w["recording_video_id"] is None
        assert w["host_id"] == user_a["id"]
        # persist for next tests
        pytest.webinar_id = w["id"]

    def test_list_webinars_contains_created(self, user_a):
        r = requests.get(f"{API}/webinars", headers=user_a["headers"])
        assert r.status_code == 200
        ids = [w["id"] for w in r.json()]
        assert pytest.webinar_id in ids

    def test_get_webinar(self, user_a):
        r = requests.get(f"{API}/webinars/{pytest.webinar_id}", headers=user_a["headers"])
        assert r.status_code == 200
        assert r.json()["title"] == "TEST_webinar"

    def test_patch_webinar(self, user_a):
        r = requests.patch(f"{API}/webinars/{pytest.webinar_id}", headers=user_a["headers"],
                           json={"title": "TEST_webinar_v2", "description": "updated"})
        assert r.status_code == 200
        assert r.json()["title"] == "TEST_webinar_v2"
        # Verify via GET
        g = requests.get(f"{API}/webinars/{pytest.webinar_id}", headers=user_a["headers"])
        assert g.json()["description"] == "updated"

    def test_webinar_owner_isolation(self, user_b):
        # user_b cannot GET/PATCH/DELETE user_a's webinar
        gr = requests.get(f"{API}/webinars/{pytest.webinar_id}", headers=user_b["headers"])
        assert gr.status_code == 404
        pr = requests.patch(f"{API}/webinars/{pytest.webinar_id}", headers=user_b["headers"],
                            json={"title": "hijack"})
        assert pr.status_code == 404
        dr = requests.delete(f"{API}/webinars/{pytest.webinar_id}", headers=user_b["headers"])
        assert dr.status_code == 404


# ============ PUBLIC WEBINAR + REGISTRATION ============
class TestPublicWebinar:
    def test_public_webinar_includes_host_brand(self, user_a):
        # Ensure brand is set on user_a (color=#ABCDEF from previous test)
        r = requests.get(f"{API}/public/webinars/{pytest.webinar_id}")
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["id"] == pytest.webinar_id
        assert "brand" in data
        assert data["brand"]["color"] == "#ABCDEF"
        assert data["host_name"] == "Alice A"
        # Should hide chunks while not live
        assert data["recording_chunks"] == []

    def test_public_webinar_404(self):
        r = requests.get(f"{API}/public/webinars/missing-{uuid.uuid4().hex}")
        assert r.status_code == 404

    def test_register_anonymous_increments_count(self):
        em = f"TEST_reg_{uuid.uuid4().hex[:8]}@viewer.app"
        r = requests.post(f"{API}/public/webinars/{pytest.webinar_id}/register",
                          json={"email": em, "name": "Viewer One"})
        assert r.status_code == 200, r.text
        assert r.json()["already_registered"] is False
        pytest.first_reg_email = em

    def test_register_dedupes_by_email(self):
        # Same email twice → already_registered=true
        r = requests.post(f"{API}/public/webinars/{pytest.webinar_id}/register",
                          json={"email": pytest.first_reg_email, "name": "again"})
        assert r.status_code == 200
        assert r.json()["already_registered"] is True

    def test_register_count_reflected(self, user_a):
        # Add a second unique email
        em2 = f"TEST_reg2_{uuid.uuid4().hex[:8]}@viewer.app"
        r2 = requests.post(f"{API}/public/webinars/{pytest.webinar_id}/register",
                           json={"email": em2})
        assert r2.status_code == 200
        # The host-side GET should show registrations_count >= 2
        g = requests.get(f"{API}/webinars/{pytest.webinar_id}", headers=user_a["headers"])
        assert g.json()["registrations_count"] >= 2

    def test_register_404_missing_webinar(self):
        r = requests.post(f"{API}/public/webinars/missing-{uuid.uuid4().hex}/register",
                          json={"email": "x@y.com"})
        assert r.status_code == 404


# ============ CHUNK UPLOAD (live) + END (recording video) ============
class TestWebinarLive:
    def test_chunk_upload_requires_auth(self):
        files = {"file": ("c.webm", io.BytesIO(b"\x1a\x45\xdf\xa3abcd"), "video/webm")}
        r = requests.post(f"{API}/webinars/{pytest.webinar_id}/chunk",
                          files=files, data={"seq": "0"})
        assert r.status_code == 401

    def test_chunk_upload_owner_isolation(self, user_b):
        files = {"file": ("c.webm", io.BytesIO(b"\x1a\x45\xdf\xa3abcd"), "video/webm")}
        r = requests.post(f"{API}/webinars/{pytest.webinar_id}/chunk",
                          headers=user_b["headers"],
                          files=files, data={"seq": "0"})
        assert r.status_code == 404

    def test_chunk_upload_flips_status_live(self, user_a):
        files = {"file": ("c0.webm", io.BytesIO(b"\x1a\x45\xdf\xa3" + os.urandom(512)), "video/webm")}
        r = requests.post(f"{API}/webinars/{pytest.webinar_id}/chunk",
                          headers=user_a["headers"],
                          files=files, data={"seq": "0"})
        if r.status_code == 503:
            pytest.skip(f"Object storage unavailable: {r.text}")
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["seq"] == 0
        assert body["url"].startswith("/api/files/")

        # Second chunk
        files2 = {"file": ("c1.webm", io.BytesIO(b"\x1a\x45\xdf\xa3" + os.urandom(512)), "video/webm")}
        r2 = requests.post(f"{API}/webinars/{pytest.webinar_id}/chunk",
                           headers=user_a["headers"],
                           files=files2, data={"seq": "1"})
        assert r2.status_code == 200
        # Verify status=live + chunks list
        g = requests.get(f"{API}/webinars/{pytest.webinar_id}", headers=user_a["headers"])
        assert g.json()["status"] == "live"
        assert len(g.json()["recording_chunks"]) >= 2

    def test_public_webinar_exposes_chunks_when_live(self):
        r = requests.get(f"{API}/public/webinars/{pytest.webinar_id}")
        assert r.status_code == 200
        data = r.json()
        assert data["status"] == "live"
        assert len(data["recording_chunks"]) >= 2

    def test_end_webinar_creates_video_record(self, user_a):
        r = requests.post(f"{API}/webinars/{pytest.webinar_id}/end",
                          headers=user_a["headers"])
        assert r.status_code == 200, r.text
        w = r.json()
        assert w["status"] == "ended"
        assert w["recording_video_id"], "recording_video_id should be set"
        # Verify a video doc exists with folder='Webinar Recordings'
        vid = w["recording_video_id"]
        gv = requests.get(f"{API}/videos/{vid}", headers=user_a["headers"])
        assert gv.status_code == 200
        v = gv.json()
        assert v["folder"] == "Webinar Recordings"
        assert v["title"].startswith("Recording:")

    def test_public_webinar_hides_chunks_when_ended(self):
        r = requests.get(f"{API}/public/webinars/{pytest.webinar_id}")
        assert r.status_code == 200
        data = r.json()
        assert data["status"] == "ended"
        # Per implementation, chunks only returned when status=='live'
        assert data["recording_chunks"] == []
        assert data["recording_video_id"] is not None


# ============ ADMIN EXPORT ============
class TestAdminExport:
    def test_export_returns_all_keys(self, user_a):
        r = requests.get(f"{API}/admin/export", headers=user_a["headers"])
        assert r.status_code == 200, r.text
        data = r.json()
        for k in ("user", "videos", "transcripts", "segment_events",
                  "webinars", "webinar_registrations", "brand"):
            assert k in data, f"missing export key: {k}"
        # User must not leak password_hash
        assert "password_hash" not in data["user"]
        # Brand should reflect persisted state
        assert isinstance(data["brand"], dict)
        # Webinars should contain our test webinar
        webinar_ids = [w["id"] for w in data["webinars"]]
        assert pytest.webinar_id in webinar_ids
        # Webinar registrations should include the 2 we added
        emails = [r["email"] for r in data["webinar_registrations"]]
        assert any(e.startswith("test_reg") for e in [x.lower() for x in emails])

    def test_export_requires_auth(self):
        r = requests.get(f"{API}/admin/export")
        assert r.status_code == 401


# ============ CASCADE: DELETE webinar removes registrations ============
class TestWebinarDeleteCascade:
    def test_delete_webinar_removes_registrations(self, user_a):
        # Create a fresh webinar + register, then delete and verify export no longer has it
        cr = requests.post(f"{API}/webinars", headers=user_a["headers"],
                           json={"title": "TEST_cascade", "description": ""})
        assert cr.status_code == 200
        wid = cr.json()["id"]
        em = f"TEST_casc_{uuid.uuid4().hex[:8]}@viewer.app"
        rr = requests.post(f"{API}/public/webinars/{wid}/register", json={"email": em})
        assert rr.status_code == 200

        # Confirm registration exists via export
        exp1 = requests.get(f"{API}/admin/export", headers=user_a["headers"]).json()
        assert any(r["webinar_id"] == wid for r in exp1["webinar_registrations"])

        # Delete
        d = requests.delete(f"{API}/webinars/{wid}", headers=user_a["headers"])
        assert d.status_code == 200
        # Confirm webinar gone + registrations purged
        g = requests.get(f"{API}/webinars/{wid}", headers=user_a["headers"])
        assert g.status_code == 404
        exp2 = requests.get(f"{API}/admin/export", headers=user_a["headers"]).json()
        assert not any(r["webinar_id"] == wid for r in exp2["webinar_registrations"])
        assert not any(w["id"] == wid for w in exp2["webinars"])
