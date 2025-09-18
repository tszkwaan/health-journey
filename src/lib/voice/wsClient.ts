export type STTEvent = {
  type: 'partial_transcript' | 'final_transcript'
  text: string
  ts: number
}

export class STTWebSocketClient {
  private ws?: WebSocket
  constructor(private url: string) {}

  connect(onEvent: (e: STTEvent) => void) {
    this.ws = new WebSocket(this.url)
    this.ws.onmessage = (ev) => {
      try { onEvent(JSON.parse(ev.data)) } catch {}
    }
  }

  sendPartial(text: string) {
    this.ws?.send(JSON.stringify({ type: 'partial', text }))
  }

  sendFinal(text: string) {
    this.ws?.send(JSON.stringify({ type: 'final', text }))
  }

  close() { this.ws?.close() }
}



