"""Optional WebSocket signaling relay for live-rival P2P sessions.

The browser app works WITHOUT this server (peers can exchange invite/answer
codes manually). Run the relay only if you want code-free matchmaking on a LAN:

    pip install -r requirements.txt
    uvicorn signaling:app --host 0.0.0.0 --port 8765

Then enter ws://<your-ip>:8765/signal in the app's Rival Setup screen.
No pose data flows through here during play — after the SDP handshake,
landmarks stream directly peer-to-peer over WebRTC.
"""

from fastapi import FastAPI, WebSocket, WebSocketDisconnect

app = FastAPI(title="ZenClash signaling relay")

# room -> set of connected sockets. Small demo scale; no persistence.
rooms: dict[str, set[WebSocket]] = {}


@app.get("/api/health")
@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.websocket("/signal")
async def signal(ws: WebSocket) -> None:
    await ws.accept()
    room = ""
    try:
        while True:
            msg = await ws.receive_json()
            room = str(msg.get("room", "")).strip()[:64]
            kind = str(msg.get("kind", ""))
            payload = str(msg.get("payload", ""))
            if not room:
                continue
            peers = rooms.setdefault(room, set())
            peers.add(ws)
            if kind == "join":
                # Tell the newcomer how many peers are waiting.
                await ws.send_json({"room": room, "kind": "peers", "payload": str(len(peers) - 1)})
                continue
            # Relay SDP codes to everyone else in the room.
            stale: list[WebSocket] = []
            for peer in peers:
                if peer is ws:
                    continue
                try:
                    await peer.send_json({"room": room, "kind": kind, "payload": payload})
                except Exception:
                    stale.append(peer)
            for dead in stale:
                peers.discard(dead)
    except WebSocketDisconnect:
        pass
    finally:
        if room and room in rooms:
            rooms[room].discard(ws)
            if not rooms[room]:
                del rooms[room]


# ---------------------------------------------------------------------------
# Static SPA Serving (Fallback if requests reach FastAPI directly)
# ---------------------------------------------------------------------------
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pathlib import Path

_candidates = [
    Path(__file__).resolve().parent / "dist",
    Path(__file__).resolve().parent.parent / "dist",
]
_dist = next((p for p in _candidates if p.exists() and (p / "index.html").exists()), None)

if _dist:
    _assets = _dist / "assets"
    if _assets.exists():
        app.mount("/assets", StaticFiles(directory=str(_assets)), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        target = _dist / full_path
        if full_path and target.exists() and target.is_file():
            return FileResponse(target)
        return FileResponse(_dist / "index.html")

