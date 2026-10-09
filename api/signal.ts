type Message = { to: string; kind: string; payload: string; at: number }
type Room = {
  peers: Set<string>
  messages: Message[]
  offer?: { peer: string; payload: string }
  touched: number
}

type Request = {
  method?: string
  query: Record<string, string | string[] | undefined>
  body?: { room?: string; peer?: string; kind?: string; payload?: string }
}

type Response = {
  status: (code: number) => Response
  json: (value: unknown) => Response
  setHeader: (name: string, value: string) => void
}

// Warm serverless instances retain this small rendezvous cache. Pose frames
// never pass through it: only the WebRTC offer/answer is relayed.
const state = globalThis as typeof globalThis & { __athleteMindRooms?: Map<string, Room> }
const rooms = state.__athleteMindRooms ?? new Map<string, Room>()
state.__athleteMindRooms = rooms

export default function handler(req: Request, res: Response) {
  for (const [name, room] of rooms) {
    if (Date.now() - room.touched > 10 * 60_000) rooms.delete(name)
  }

  const roomName = String(req.query.room ?? req.body?.room ?? '').trim().slice(0, 64)
  const peer = String(req.query.peer ?? req.body?.peer ?? '').trim().slice(0, 100)
  if (!roomName || !peer) return res.status(400).json({ error: 'room and peer are required' })

  const room = rooms.get(roomName) ?? { peers: new Set<string>(), messages: [], touched: Date.now() }
  room.touched = Date.now()
  rooms.set(roomName, room)
  room.peers.add(peer)

  if (req.method === 'GET') {
    const messages = room.messages.filter((message) => message.to === peer || message.to === '*')
    room.messages = room.messages.filter((message) => message.to !== peer && message.to !== '*')
    return res.status(200).json(messages.map(({ kind, payload }) => ({ kind, payload })))
  }

  if (req.method === 'POST') {
    const kind = String(req.body?.kind ?? '')
    const payload = String(req.body?.payload ?? '')
    if (kind === 'join') {
      if (room.offer && room.offer.peer !== peer) {
        room.messages.push({ to: peer, kind: 'offer', payload: room.offer.payload, at: Date.now() })
      }
      for (const message of room.messages) {
        if (message.kind === 'offer') message.to = peer
      }
    } else if (kind === 'offer') {
      room.offer = { peer, payload }
      for (const target of room.peers) {
        if (target !== peer) room.messages.push({ to: target, kind, payload, at: Date.now() })
      }
    } else if (kind === 'answer') {
      if (room.offer && room.offer.peer !== peer) {
        room.messages.push({ to: room.offer.peer, kind, payload, at: Date.now() })
      }
      room.offer = undefined
    }
    return res.status(200).json({ ok: true })
  }

  res.setHeader('Allow', 'GET, POST')
  return res.status(405).json({ error: 'method not allowed' })
}
