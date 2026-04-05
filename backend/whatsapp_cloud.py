"""
Send WhatsApp messages from the server (cloud) — no patient manual tap in WhatsApp.

Configure ONE of:
  Twilio WhatsApp:
    TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM=whatsapp:+1...

  Meta WhatsApp Cloud API:
    WHATSAPP_CLOUD_TOKEN, WHATSAPP_CLOUD_PHONE_NUMBER_ID

Uses only the Python standard library (urllib) so no extra pip packages are required.
"""
from __future__ import annotations

import base64
import json
import os
import urllib.error
import urllib.parse
import urllib.request
from typing import Any


def _normalize_whatsapp_to(e164: str) -> str:
    """E.164 like +919876543210 -> whatsapp:+919876543210"""
    s = (e164 or "").strip().replace(" ", "")
    if s.lower().startswith("whatsapp:"):
        return s if s.startswith("whatsapp:+") else "whatsapp:+" + s.split(":", 1)[-1].lstrip("+")
    digits = "".join(c for c in s if c.isdigit())
    if s.startswith("+") and len(digits) >= 10:
        return "whatsapp:+" + digits
    if len(digits) >= 10:
        return "whatsapp:+" + digits
    return ""


def _normalize_twilio_from(raw: str) -> str:
    s = (raw or "").strip()
    if s.lower().startswith("whatsapp:"):
        return s
    if s.startswith("+"):
        return "whatsapp:" + s
    return "whatsapp:+" + "".join(c for c in s if c.isdigit())


def send_via_twilio(
    account_sid: str,
    auth_token: str,
    from_wa: str,
    to_e164: str,
    body: str,
) -> dict[str, Any]:
    from_full = _normalize_twilio_from(from_wa)
    to_full = _normalize_whatsapp_to(to_e164)
    if not to_full:
        return {"ok": False, "error": "invalid_to_phone"}

    url = f"https://api.twilio.com/2010-04-01/Accounts/{account_sid}/Messages.json"
    form = urllib.parse.urlencode(
        {"To": to_full, "From": from_full, "Body": body[:1600]}
    ).encode()

    req = urllib.request.Request(url, data=form, method="POST")
    creds = f"{account_sid}:{auth_token}"
    req.add_header("Authorization", "Basic " + base64.b64encode(creds.encode()).decode())
    req.add_header("Content-Type", "application/x-www-form-urlencoded")

    try:
        with urllib.request.urlopen(req, timeout=45) as resp:
            data = json.loads(resp.read().decode())
        sid = data.get("sid")
        return {"ok": True, "provider": "twilio", "message_sid": sid}
    except urllib.error.HTTPError as e:
        err_body = e.read().decode(errors="replace")
        twilio_code = None
        twilio_message = None
        try:
            parsed = json.loads(err_body)
            twilio_code = parsed.get("code")
            twilio_message = parsed.get("message")
        except (TypeError, ValueError, json.JSONDecodeError):
            pass

        hint = None
        if twilio_code == 21211:
            hint = "Recipient number is invalid. Use full international format like +919876543210."
        elif twilio_code in (63015, 63016):
            hint = "Recipient may not be joined to Twilio WhatsApp sandbox. Ask family number to send the sandbox join code first."
        elif twilio_code in (20003, 20404):
            hint = "Twilio credentials or sender are invalid. Re-check TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_WHATSAPP_FROM."
        elif twilio_code == 21608:
            hint = "Permission to send to this destination is blocked. Verify geo permissions and WhatsApp sender approval in Twilio Console."

        return {
            "ok": False,
            "provider": "twilio",
            "error": f"http_{e.code}",
            "detail": err_body[:500],
            "twilio_code": twilio_code,
            "twilio_message": twilio_message,
            "hint": hint,
        }
    except OSError as e:
        return {"ok": False, "provider": "twilio", "error": "network", "detail": str(e)}


def send_via_meta_cloud(
    access_token: str,
    phone_number_id: str,
    to_e164: str,
    body: str,
) -> dict[str, Any]:
    digits = "".join(c for c in to_e164 if c.isdigit())
    if len(digits) < 10:
        return {"ok": False, "error": "invalid_to_phone"}

    url = f"https://graph.facebook.com/v21.0/{phone_number_id}/messages"
    payload = {
        "messaging_product": "whatsapp",
        "to": digits,
        "type": "text",
        "text": {"preview_url": False, "body": body[:4096]},
    }
    data = json.dumps(payload).encode()
    req = urllib.request.Request(url, data=data, method="POST")
    req.add_header("Authorization", f"Bearer {access_token}")
    req.add_header("Content-Type", "application/json")

    try:
        with urllib.request.urlopen(req, timeout=45) as resp:
            out = json.loads(resp.read().decode())
        mid = None
        if "messages" in out and out["messages"]:
            mid = out["messages"][0].get("id")
        return {"ok": True, "provider": "meta_cloud", "message_id": mid}
    except urllib.error.HTTPError as e:
        err_body = e.read().decode(errors="replace")
        return {"ok": False, "provider": "meta_cloud", "error": f"http_{e.code}", "detail": err_body[:500]}
    except OSError as e:
        return {"ok": False, "provider": "meta_cloud", "error": "network", "detail": str(e)}


def cloud_whatsapp_status() -> dict[str, Any]:
    required_twilio = [
        "TWILIO_ACCOUNT_SID",
        "TWILIO_AUTH_TOKEN",
        "TWILIO_WHATSAPP_FROM",
    ]
    required_meta = [
        "WHATSAPP_CLOUD_TOKEN",
        "WHATSAPP_CLOUD_PHONE_NUMBER_ID",
    ]

    twilio_ready = bool(
        os.environ.get("TWILIO_ACCOUNT_SID")
        and os.environ.get("TWILIO_AUTH_TOKEN")
        and os.environ.get("TWILIO_WHATSAPP_FROM")
    )
    meta_ready = bool(
        os.environ.get("WHATSAPP_CLOUD_TOKEN")
        and os.environ.get("WHATSAPP_CLOUD_PHONE_NUMBER_ID")
    )
    if twilio_ready:
        mode = "twilio"
    elif meta_ready:
        mode = "meta_cloud"
    else:
        mode = "none"
    missing_twilio = [k for k in required_twilio if not os.environ.get(k)]
    missing_meta = [k for k in required_meta if not os.environ.get(k)]
    return {
        "mode": mode,
        "twilio_configured": twilio_ready,
        "meta_configured": meta_ready,
        "missing_twilio": missing_twilio,
        "missing_meta": missing_meta,
    }


def send_family_whatsapp_cloud(to_e164: str, body: str) -> dict[str, Any]:
    """
    Try Meta Cloud first if both set (user might prefer); else Twilio.
    Actually: prefer Twilio if set (simpler sandbox), else Meta.
    """
    sid = os.environ.get("TWILIO_ACCOUNT_SID", "").strip()
    token = os.environ.get("TWILIO_AUTH_TOKEN", "").strip()
    from_wa = os.environ.get("TWILIO_WHATSAPP_FROM", "").strip()

    if sid and token and from_wa:
        return send_via_twilio(sid, token, from_wa, to_e164, body)

    wtoken = os.environ.get("WHATSAPP_CLOUD_TOKEN", "").strip()
    pnid = os.environ.get("WHATSAPP_CLOUD_PHONE_NUMBER_ID", "").strip()
    if wtoken and pnid:
        return send_via_meta_cloud(wtoken, pnid, to_e164, body)

    status = cloud_whatsapp_status()
    return {
        "ok": False,
        "error": "not_configured",
        "hint": "Set TWILIO_* or WHATSAPP_CLOUD_* environment variables on the server.",
        "missing_twilio": status.get("missing_twilio", []),
        "missing_meta": status.get("missing_meta", []),
    }
