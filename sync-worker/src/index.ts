import { DurableObject } from 'cloudflare:workers'

export interface Env {
  GYM_ROOM: DurableObjectNamespace<GymRoom>
  SCREEN_REGISTRY: DurableObjectNamespace<ScreenRegistry>
}

const SCREEN_ID_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

function isScreenId(value: string) {
  return /^[A-Z0-9]{4}$/.test(value)
}

function isDeviceId(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  )
}

function randomScreenId() {
  const bytes = new Uint8Array(4)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (byte) => SCREEN_ID_CHARS[byte % SCREEN_ID_CHARS.length]).join('')
}

export class ScreenRegistry extends DurableObject {
  async assign(deviceId: string): Promise<string> {
    return this.ctx.blockConcurrencyWhile(async () => {
      const existing = await this.ctx.storage.get<string>(`device:${deviceId}`)
      if (existing) return existing

      for (let attempt = 0; attempt < 64; attempt += 1) {
        const code = randomScreenId()
        if (await this.ctx.storage.get(`code:${code}`)) continue
        await this.ctx.storage.put(`device:${deviceId}`, code)
        await this.ctx.storage.put(`code:${code}`, deviceId)
        return code
      }

      throw new Error('Could not allocate screen id')
    })
  }

  async lookup(screenId: string): Promise<string | null> {
    return (await this.ctx.storage.get<string>(`code:${screenId}`)) ?? null
  }
}

export class GymRoom extends DurableObject {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env)
    this.ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'))
  }

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('vvk-gym-sync', { status: 200 })
    }

    const publicScreen = request.headers.get('X-Public-Screen')
    const pair = new WebSocketPair()
    const [client, server] = Object.values(pair)
    this.ctx.acceptWebSocket(server)

    if (publicScreen && isScreenId(publicScreen)) {
      server.send(JSON.stringify({ type: 'screen', id: publicScreen }))
    }

    const last = await this.ctx.storage.get<string>('last')
    if (last) server.send(last)

    return new Response(null, { status: 101, webSocket: client })
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    const text = typeof message === 'string' ? message : new TextDecoder().decode(message)
    if (!text.startsWith('{')) return
    await this.ctx.storage.put('last', text)
    for (const peer of this.ctx.getWebSockets()) {
      if (peer !== ws && peer.readyState === WebSocket.OPEN) peer.send(text)
    }
  }

  async webSocketClose(ws: WebSocket, code: number, reason: string) {
    ws.close(code, reason)
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('vvk-gym-sync', { status: 200 })
    }

    const url = new URL(request.url)
    const role = url.searchParams.get('role')
    const registry = env.SCREEN_REGISTRY.get(env.SCREEN_REGISTRY.idFromName('main'))

    if (role === 'display') {
      const device = url.searchParams.get('device')?.trim() ?? ''
      if (!isDeviceId(device)) {
        return new Response('Forbidden', { status: 403 })
      }
      const screen = await registry.assign(device)
      const headers = new Headers(request.headers)
      headers.set('X-Public-Screen', screen)
      const room = env.GYM_ROOM.get(env.GYM_ROOM.idFromName(device))
      return room.fetch(new Request(request, { headers }))
    }

    if (role === 'trainer') {
      const screen = (url.searchParams.get('screen')?.trim() ?? '').toUpperCase()
      if (!isScreenId(screen)) {
        return new Response('Forbidden', { status: 403 })
      }
      const device = await registry.lookup(screen)
      if (!device) {
        return new Response('Unknown screen', { status: 403 })
      }
      const room = env.GYM_ROOM.get(env.GYM_ROOM.idFromName(device))
      return room.fetch(request)
    }

    return new Response('Forbidden', { status: 403 })
  },
}
