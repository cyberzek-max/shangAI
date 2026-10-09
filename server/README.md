# ZenClash signaling relay (optional)

Vercel deployments use the repository's `api/signal.ts` HTTP polling function
automatically; no WebSocket server is required there. This FastAPI relay is
for self-hosted deployments or local networks that want a WebSocket transport.

Code-free matchmaking for the **Live Rival** mode. The web app works without
this server (manual invite/answer codes), so only run it when two players want
automatic SDP exchange on the same network.

```bash
cd server
pip install -r requirements.txt
uvicorn signaling:app --host 0.0.0.0 --port 8765
```

In the app's Rival Setup screen, enter `ws://<server-ip>:8765/signal` and the
same room code on both devices. The server only relays the handshake — live
landmark frames travel directly between browsers over WebRTC and never touch
this relay.
