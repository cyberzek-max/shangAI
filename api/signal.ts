type SignalRequest = {
  method?: string
  query: Record<string, string | string[] | undefined>
  body?: { room?: string; peer?: string; kind?: string; payload?: string }
}

type SignalResponse = {
  status: (code: number) => SignalResponse
  json: (value: unknown) => SignalResponse
  setHeader: (name: string, value: string) => void
}

type RedisResult = { result?: unknown; error?: string }
type Signal = { kind: 'offer' | 'answer'; payload: string; peer: string }

function redisConfig(): { url: string; token: string } | null {
  const runtime = globalThis as typeof globalThis & {
    process?: { env?: Record<string, string | undefined> }
  }
  const env = runtime.process?.env ?? {}
  const url = env.UPSTASH_REDIS_REST_URL ?? env.KV_REST_API_URL
  const token = env.UPSTASH_REDIS_REST_TOKEN ?? env.KV_REST_API_TOKEN
  if (!url || !token) return null
  return { url: url.replace(/\/+$/, ''), token }
}

async function redisPipeline(
  config: { url: string; token: string },
  commands: string[][],
): Promise<unknown[]> {
  const response = await fetch(`${config.url}/pipeline`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${config.token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(commands),
  })
  if (!response.ok) throw new Error(`Shared signaling store returned ${response.status}`)
  const results = (await response.json()) as RedisResult[]
  const failure = results.find((result) => result.error)
  if (failure?.error) throw new Error(`Shared signaling store: ${failure.error}`)
  return results.map((result) => result.result)
}

function readSignal(value: unknown): Signal | null {
  if (typeof value !== 'string') return null
  try {
    const parsed = JSON.parse(value) as Partial<Signal>
    if (
      (parsed.kind === 'offer' || parsed.kind === 'answer') &&
      typeof parsed.payload === 'string' &&
      typeof parsed.peer === 'string'
    ) {
      return parsed as Signal
    }
  } catch {
    // Ignore stale or malformed room data.
  }
  return null
}

export default async function handler(req: SignalRequest, res: SignalResponse) {
  res.setHeader('Cache-Control', 'no-store, max-age=0')
  const config = redisConfig()
  if (!config) {
    return res.status(503).json({
      error:
        'Live arena signaling is not configured. Add UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN to the Vercel project, then redeploy.',
    })
  }

  const room = String(req.query.room ?? req.body?.room ?? '').trim().slice(0, 64)
  const peer = String(req.query.peer ?? req.body?.peer ?? '').trim().slice(0, 100)
  if (!room || !peer) return res.status(400).json({ error: 'room and peer are required' })

  const key = `athletemind:signal:${encodeURIComponent(room)}`
  const offerKey = `${key}:offer`
  const answerKey = `${key}:answer`
  const peerKey = `${key}:peer:${encodeURIComponent(peer)}`
  const ttlSeconds = '900'

  try {
    if (req.method === 'GET') {
      const [offerValue, answerValue] = await redisPipeline(config, [
        ['GET', offerKey],
        ['GET', answerKey],
      ])
      const offer = readSignal(offerValue)
      const answer = readSignal(answerValue)
      const messages: Array<{ kind: string; payload: string }> = []

      if (offer?.kind === 'offer' && offer.peer !== peer) {
        messages.push({ kind: 'offer', payload: offer.payload })
      }
      if (offer?.peer === peer && answer?.kind === 'answer' && answer.peer !== peer) {
        messages.push({ kind: 'answer', payload: answer.payload })
      }
      return res.status(200).json(messages)
    }

    if (req.method === 'POST') {
      const kind = req.body?.kind
      if (kind === 'join') {
        await redisPipeline(config, [['SET', peerKey, '1', 'EX', ttlSeconds]])
      } else if (kind === 'offer' || kind === 'answer') {
        const payload = String(req.body?.payload ?? '')
        if (!payload || payload.length > 100_000) {
          return res.status(400).json({ error: 'invalid signaling payload' })
        }
        const value = JSON.stringify({ kind, peer, payload } satisfies Signal)
        const targetKey = kind === 'offer' ? offerKey : answerKey
        const commands =
          kind === 'offer'
            ? [
                ['DEL', answerKey],
                ['SET', targetKey, value, 'EX', ttlSeconds],
              ]
            : [['SET', targetKey, value, 'EX', ttlSeconds]]
        await redisPipeline(config, commands)
      } else {
        return res.status(400).json({ error: 'unsupported signaling message' })
      }
      return res.status(200).json({ ok: true })
    }

    res.setHeader('Allow', 'GET, POST')
    return res.status(405).json({ error: 'method not allowed' })
  } catch (error) {
    console.error('Live arena signaling failed:', error)
    return res.status(503).json({ error: 'Live arena signaling store is unavailable. Try again shortly.' })
  }
}
