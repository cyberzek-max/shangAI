import type { PoseLandmarks } from '../types'

export type PeerState = 'idle' | 'local-ready' | 'connecting' | 'open' | 'closed' | 'error'

function encodeSDP(desc: RTCSessionDescriptionInit): string {
  return btoa(unescape(encodeURIComponent(JSON.stringify(desc))))
}

function decodeSDP(code: string): RTCSessionDescriptionInit {
  return JSON.parse(decodeURIComponent(escape(atob(code.trim())))) as RTCSessionDescriptionInit
}

function pack(lms: PoseLandmarks): string {
  const out: number[] = []
  for (let i = 0; i < 33; i++) {
    const p = lms[i]
    if (!p) out.push(0, 0, 0, 0)
    else out.push(+p.x.toFixed(3), +p.y.toFixed(3), +(p.z ?? 0).toFixed(3), +(p.visibility ?? 0).toFixed(2))
  }
  return JSON.stringify({ t: Date.now(), p: out })
}

function unpack(raw: string): PoseLandmarks | null {
  try {
    const o = JSON.parse(raw) as { t: number; p: number[] }
    if (!Array.isArray(o.p) || o.p.length < 33 * 4) return null
    const lms: PoseLandmarks = []
    for (let i = 0; i < 33; i++) {
      lms.push({
        x: o.p[i * 4] ?? 0,
        y: o.p[i * 4 + 1] ?? 0,
        z: o.p[i * 4 + 2] ?? 0,
        visibility: o.p[i * 4 + 3] ?? 0,
      })
    }
    return lms
  } catch {
    return null
  }
}

/**
 * Interpolated remote skeleton. Keeps the last two received frames and renders
 * ~80ms behind real time so motion stays smooth (sub-100ms glass-to-glass).
 */
export class RemoteGhost {
  private a: { at: number; lms: PoseLandmarks } | null = null
  private b: { at: number; lms: PoseLandmarks } | null = null
  /** ms since the last received frame (for sync metrics). */
  ageMs = Number.POSITIVE_INFINITY

  push(lms: PoseLandmarks, nowMs: number): void {
    this.a = this.b
    this.b = { at: nowMs, lms }
    this.ageMs = 0
  }

  tick(nowMs: number): void {
    if (this.b) this.ageMs = nowMs - this.b.at
  }

  get has(): boolean {
    return !!this.b
  }

  sample(nowMs: number): PoseLandmarks | null {
    const renderAt = nowMs - 80
    if (!this.b) return null
    if (!this.a || this.a.at >= renderAt || this.b.at <= this.a.at) return this.b.lms
    const f = Math.max(0, Math.min(1, (renderAt - this.a.at) / (this.b.at - this.a.at)))
    return this.a.lms.map((p, i) => {
      const q = this.b!.lms[i]
      return {
        x: p.x + (q.x - p.x) * f,
        y: p.y + (q.y - p.y) * f,
        z: p.z + (q.z - p.z) * f,
        visibility: Math.max(p.visibility ?? 0, q.visibility ?? 0),
      }
    })
  }

  reset(): void {
    this.a = this.b = null
    this.ageMs = Number.POSITIVE_INFINITY
  }
}

const RTC_CONFIG: RTCConfiguration = {
  // Public STUN for NAT traversal; same-LAN pairs usually connect regardless.
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
}

/**
 * Server-free P2P rival link. Exchange the short base64 codes out-of-band
 * (chat, QR, voice) — no account or backend required:
 *   host  → "Create invite" → send code to friend
 *   guest → paste invite → "Join" → send answer code back
 *   host  → paste answer → "Connect"
 * An optional WebSocket signaling helper (SignalingClient below) automates
 * the same exchange when the FastAPI relay in server/ is running.
 */
export class RivalPeer {
  private pc: RTCPeerConnection | null = null
  private dc: RTCDataChannel | null = null
  private lastSend = 0
  state: PeerState = 'idle'
  remote = new RemoteGhost()
  onState: (s: PeerState) => void = () => {}
  onRemote: () => void = () => void {}

  private setState(s: PeerState): void {
    this.state = s
    this.onState(s)
  }

  private newPC(): RTCPeerConnection {
    this.close()
    const pc = new RTCPeerConnection(RTC_CONFIG)
    this.pc = pc
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') this.setState('open')
      else if (pc.connectionState === 'failed' || pc.connectionState === 'closed') this.setState('closed')
      else this.setState('connecting')
    }
    pc.ondatachannel = (ev) => this.wireChannel(ev.channel)
    return pc
  }

  private wireChannel(ch: RTCDataChannel): void {
    this.dc = ch
    ch.onmessage = (ev) => {
      const lms = typeof ev.data === 'string' ? unpack(ev.data) : null
      if (lms) {
        this.remote.push(lms, performance.now())
        this.onRemote()
      }
    };
  }

  private async gather(pc: RTCPeerConnection): Promise<RTCSessionDescriptionInit> {
    await new Promise<void>((resolve) => {
      if (pc.iceGatheringState === 'complete') return resolve()
      const check = () => {
        if (pc.iceGatheringState === 'complete') {
          pc.removeEventListener('icegatheringstatechange', check)
          resolve()
        }
      }
      pc.addEventListener('icegatheringstatechange', check)
      // Safety: don't hang forever on restrictive networks.
      setTimeout(() => {
        pc.removeEventListener('icegatheringstatechange', check)
        resolve()
      }, 4000)
    })
    const desc = pc.localDescription
    if (!desc) throw new Error('No local description')
    return { type: desc.type, sdp: desc.sdp }
  }

  /** Host step 1: returns an invite code to send to the guest. */
  async createInvite(): Promise<string> {
    const pc = this.newPC()
    this.wireChannel(pc.createDataChannel('pose', { ordered: false, maxRetransmits: 0 }))
    await pc.setLocalDescription(await pc.createOffer())
    this.setState('local-ready')
    return encodeSDP(await this.gather(pc))
  }

  /** Guest step 2: paste the invite, returns an answer code for the host. */
  async acceptInvite(code: string): Promise<string> {
    const pc = this.newPC()
    await pc.setRemoteDescription(new RTCSessionDescription(decodeSDP(code)))
    await pc.setLocalDescription(await pc.createAnswer())
    this.setState('local-ready')
    return encodeSDP(await this.gather(pc))
  }

  /** Host step 3: paste the guest's answer to complete the handshake. */
  async acceptAnswer(code: string): Promise<void> {
    if (!this.pc) throw new Error('Create an invite first')
    await this.pc.setRemoteDescription(new RTCSessionDescription(decodeSDP(code)))
    this.setState('connecting')
  }

  /** Stream our landmarks (~20Hz, compact). Safe to call every frame. */
  send(lms: PoseLandmarks | null, nowMs: number): void {
    if (!lms || !this.dc || this.dc.readyState !== 'open') return
    if (nowMs - this.lastSend < 50) return
    this.lastSend = nowMs
    try {
      this.dc.send(pack(lms))
    } catch {
      /* backpressure; next frame retries */
    }
  }

  get connected(): boolean {
    return this.state === 'open'
  }

  close(): void {
    try {
      this.dc?.close()
    } catch {
      /* noop */
    }
    try {
      this.pc?.close()
    } catch {
      /* noop */
    }
    this.dc = null
    this.pc = null
    this.remote.reset()
    if (this.state !== 'idle') this.setState('closed')
  }
}

/**
 * Optional WebSocket signaling client for the FastAPI relay in server/.
 * Only used when the user enters a relay URL; the manual-code flow above
 * always works without it. Protocol: {room, kind, payload}.
 */
export class SignalingClient {  private ws: WebSocket | null = null
  onSignal: (kind: string, payload: string) => void = () => {}
  onOpen: () => void = () => void {}
  onClose: () => void = () => void {}

  get ready(): boolean {
    return !!this.ws && this.ws.readyState === WebSocket.OPEN
  }

  connect(url: string, room: string): void {
    this.disconnect()
    const ws = new WebSocket(url)
    this.ws = ws
    ws.onopen = () => {
      ws.send(JSON.stringify({ room, kind: 'join', payload: '' }))
      this.onOpen()
    }
    ws.onmessage = (ev) => {
      try {
        const o = JSON.parse(String(ev.data)) as { room: string; kind: string; payload: string }
        if (o && o.kind && o.kind !== 'join') this.onSignal(o.kind, o.payload)
      } catch {
        /* ignore malformed */
      }
    }
    ws.onclose = () => this.onClose()
    ws.onerror = () => {
      try {
        ws.close()
      } catch {
        /* noop */
      }
    }
  }

  send(room: string, kind: string, payload: string): void {
    if (this.ready) this.ws!.send(JSON.stringify({ room, kind, payload }))
  }

  disconnect(): void {
    try {
      this.ws?.close()
    } catch {
      /* noop */
    }
    this.ws = null
  }
}

/** Module-level live peer shared between Rival Setup and the session. */
let livePeer: RivalPeer | null = null

export function setLivePeer(p: RivalPeer | null): void {
  livePeer = p
}

export function getLivePeer(): RivalPeer | null {
  return livePeer
}
