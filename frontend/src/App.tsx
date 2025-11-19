import { useEffect, useRef, useState } from 'react'
import $ from 'jquery'

type ChatMessage = {
  username: string
  message: string
}

function App() {
  const [username, setUsername] = useState('')
  const [room, setRoom] = useState('')
  const [password, setPassword] = useState('')
  const [createRoom, setCreateRoom] = useState(false)
  const [joined, setJoined] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const wsRef = useRef<WebSocket | null>(null)
  const listRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    // jQuery: focus automatique sur le champ utilisateur au chargement
    $('#username').trigger('focus')
  }, [])

  useEffect(() => {
    // jQuery: scroll en bas à chaque nouveau message
    if (listRef.current) {
      $(listRef.current).stop().animate({ scrollTop: listRef.current.scrollHeight }, 200)
    }
  }, [messages])

  const joinRoom = () => {
    if (!username || !room || !password) return
    const params = new URLSearchParams({ username, password })
    if (createRoom) params.set('create', '1')
    const url = `ws://localhost:8000/ws/chat/${encodeURIComponent(room)}/?${params.toString()}`
    const ws = new WebSocket(url)
    ws.onopen = () => {
      setJoined(true)
    }
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        setMessages((prev) => [...prev, { username: data.username, message: data.message }])
      } catch {
        // fallback si pas JSON
        setMessages((prev) => [...prev, { username: 'système', message: event.data }])
      }
    }
    ws.onclose = () => {
      setJoined(false)
    }
    ws.onerror = () => {
      setJoined(false)
    }
    wsRef.current = ws
  }

  const leaveRoom = () => {
    wsRef.current?.close()
    wsRef.current = null
    setJoined(false)
    setMessages([])
  }

  const sendMessage = () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return
    const payload = { username, message: input }
    wsRef.current.send(JSON.stringify(payload))
    setInput('')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 text-slate-100 flex items-center justify-center p-6">
      {!joined ? (
        <div className="w-full max-w-lg border border-white/10 bg-white/5 backdrop-blur-sm rounded-2xl shadow-2xl p-8">
          <div className="mb-6">
            <div className="flex items-center gap-2">
              <img src="/chat-logo.svg" alt="Chat IA" className="h-10 w-10 md:h-12 md:w-12 shrink-0" />
              <div className="text-3xl font-bold tracking-tight">Chat IA</div>
            </div>
            <div className="text-sm text-slate-300">Rejoignez une salle et commencez à discuter</div>
          </div>
          <div className="space-y-5">
            <div className="space-y-2">
              <label htmlFor="username" className="block text-sm font-medium text-slate-200">Nom d’utilisateur</label>
              <input
                id="username"
                className="mt-1 w-full rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-white placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/20"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="ex: Alice"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="room" className="block text-sm font-medium text-slate-200">Salle (nom ou ID)</label>
              <input
                id="room"
                className="mt-1 w-full rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-white placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/20"
                value={room}
                onChange={(e) => setRoom(e.target.value)}
                placeholder="ex: general ou 123"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="password" className="block text-sm font-medium text-slate-200">Mot de passe</label>
              <input
                id="password"
                type="password"
                className="mt-1 w-full rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-white placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/20"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>
            <div className="flex items-center gap-2">
              <input id="create" type="checkbox" checked={createRoom} onChange={(e) => setCreateRoom(e.target.checked)} />
              <label htmlFor="create" className="text-sm text-slate-300">Créer la salle si elle n’existe pas</label>
            </div>
            <button
              className={`w-full rounded-lg px-4 py-2 font-medium text-white transition-colors focus:outline-none focus:ring-4 focus:ring-blue-500/20 ${username && room && password ? 'bg-blue-600 hover:bg-blue-500' : 'bg-blue-600/50 cursor-not-allowed'}`}
              onClick={joinRoom}
              disabled={!username || !room || !password}
            >
              Rejoindre
            </button>
          </div>
        </div>
      ) : (
        <div className="w-full max-w-3xl border border-white/10 bg-white/5 backdrop-blur-sm rounded-2xl shadow-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Salle: {room}</h2>
            <button className="text-red-400 hover:text-red-300 transition-colors" onClick={leaveRoom}>Quitter</button>
          </div>
          <div ref={listRef} className="h-96 overflow-y-auto border border-white/10 rounded-xl p-4 space-y-3 bg-white/5">
            {messages.map((m, i) => {
              const self = m.username === username
              return (
                <div key={i} className={`flex ${self ? 'justify-end' : 'justify-start'}`}>
                  <div className="max-w-[75%]">
                    <div className={`text-xs mb-1 ${self ? 'text-blue-300' : 'text-slate-300'}`}>{m.username}</div>
                    <div className={`rounded-2xl px-4 py-2 shadow ${self ? 'bg-blue-600 text-white' : 'bg-white/10 text-slate-100'}`}>{m.message}</div>
                  </div>
                </div>
              )
            })}
          </div>
          <div className="mt-4 flex gap-2">
            <input
              className="flex-1 rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-white placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/20"
              value={input}
              placeholder="Votre message..."
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') sendMessage() }}
            />
            <button className="rounded-lg bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 font-medium transition-colors focus:outline-none focus:ring-4 focus:ring-blue-500/20" onClick={sendMessage}>
              Envoyer
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
