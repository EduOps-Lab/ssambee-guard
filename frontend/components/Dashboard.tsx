'use client'

import React, { useState, useEffect, useRef } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { Activity, Thermometer, ShieldAlert, LogOut, Terminal, Search, Filter, Clock } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import { useQueryState, parseAsString } from 'nuqs'

interface ServerMetric {
  id: number
  cpu_load: number
  memory_usage: number
  uptime: number
  created_at: string
}

interface LogData {
  id: number
  level: string
  message: string
  metadata: string
  timestamp: string
}

interface AlertData {
  id: number
  type: string
  message: string
  metadata: string
  created_at: string
}

interface DashboardProps {
  token: string
  onLogout: () => void
}

const Dashboard: React.FC<DashboardProps> = ({ token, onLogout }) => {
  const [level, setLevel] = useQueryState('level', parseAsString.withDefault(''))
  const [alertType, setAlertType] = useQueryState('type', parseAsString.withDefault(''))
  const [range, setRange] = useQueryState('range', parseAsString.withDefault('1h'))
  const [search, setSearch] = useQueryState('search', parseAsString.withDefault(''))

  const [liveLogs, setLiveLogs] = useState<LogData[]>([])
  const logEndRef = useRef<HTMLDivElement>(null)

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || ''

  const { data: historicalLogs, isLoading: logsLoading } = useQuery<LogData[]>({
    queryKey: ['logs', level, search, range],
    queryFn: async () => {
      const res = await axios.get(`${apiUrl}/logs`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { level, search, range }
      })
      return res.data
    },
    refetchInterval: 30000
  })

  const { data: alerts, isLoading: alertsLoading } = useQuery<AlertData[]>({
    queryKey: ['alerts', alertType, range],
    queryFn: async () => {
      const res = await axios.get(`${apiUrl}/alerts`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { type: alertType, range }
      })
      return res.data
    }
  })

  const { data: metrics } = useQuery<ServerMetric[]>({
    queryKey: ['metrics', range],
    queryFn: async () => {
      const res = await axios.get(`${apiUrl}/metrics`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { range }
      })
      return res.data
    },
    refetchInterval: 5000
  })

  useEffect(() => {
    const sseUrl = `${apiUrl}/stream?token=${token}`
    const eventSource = new EventSource(sseUrl)

    eventSource.onmessage = (event) => {
      const payload = JSON.parse(event.data)
      if (payload.type === 'log') {
        setLiveLogs(prev => [...prev.slice(-50), payload.data])
      }
    }

    eventSource.onerror = (err) => {
      console.error('SSE Error:', err)
      eventSource.close()
    }

    return () => eventSource.close()
  }, [token, apiUrl])

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [liveLogs])

  const alertCount = alerts?.length || 0
  const latestMetric = metrics?.[metrics.length - 1]

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-6">
      <header className="flex flex-col md:flex-row justify-between items-center mb-8 bg-slate-800 p-4 rounded-lg shadow-md border border-slate-700 gap-4">
        <div className="flex items-center gap-3">
          <Activity className="text-blue-400 w-8 h-8" />
          <h1 className="text-xl font-bold">Monitoring Central Control</h1>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search logs..."
              className="pl-9 pr-3 py-1 bg-slate-700 border border-slate-600 rounded-md text-sm focus:outline-none focus:border-blue-500"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter size={16} className="text-slate-400" />
            <select
              className="bg-slate-700 border border-slate-600 rounded-md text-sm px-2 py-1 focus:outline-none"
              value={level}
              onChange={(e) => setLevel(e.target.value)}
            >
              <option value="">All Levels</option>
              <option value="INFO">INFO</option>
              <option value="WARN">WARN</option>
              <option value="ERROR">ERROR</option>
              <option value="REDIS_ERROR">REDIS_ERROR</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <Clock size={16} className="text-slate-400" />
            <select
              className="bg-slate-700 border border-slate-600 rounded-md text-sm px-2 py-1 focus:outline-none"
              value={range}
              onChange={(e) => setRange(e.target.value)}
            >
              <option value="1h">Last 1 Hour</option>
              <option value="24h">Last 24 Hours</option>
              <option value="7d">Last 7 Days</option>
            </select>
          </div>

          <button
            onClick={onLogout}
            className="flex items-center gap-2 px-4 py-1.5 bg-red-600 hover:bg-red-700 rounded text-sm transition font-medium"
          >
            <LogOut size={16} /> Logout
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <StatCard
          title="CPU Load"
          value={latestMetric?.cpu_load ? `${latestMetric.cpu_load.toFixed(2)}` : '--'}
          icon={<Activity className="text-blue-400" />}
          subValue="System load"
        />
        <StatCard
          title="Memory Usage"
          value={latestMetric?.memory_usage ? `${latestMetric.memory_usage}%` : '--'}
          icon={<Thermometer className="text-orange-400" />}
          subValue="RAM utilization"
        />
        <StatCard
          title="Alert Count"
          value={alertCount.toString()}
          icon={<ShieldAlert className="text-red-500" />}
          subValue="Actual notifications sent"
        />
        <StatCard
          title="Live Status"
          value={liveLogs.length > 0 ? "Active" : "Idle"}
          icon={<Terminal className="text-green-400" />}
          subValue="Real-time stream"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-slate-800 p-6 rounded-lg shadow-md border border-slate-700">
          <h2 className="text-lg font-semibold mb-4 flex justify-between items-center">
            <span className="flex items-center gap-2">
              <Activity size={20} className="text-blue-400" /> Server Performance Metrics
            </span>
            <span className="text-xs text-slate-500">Auto-refreshing every 5s</span>
          </h2>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={metrics}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis
                  dataKey="created_at"
                  stroke="#94a3b8"
                  tickFormatter={(t) => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                />
                <YAxis stroke="#94a3b8" />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px' }}
                  labelStyle={{ color: '#94a3b8' }}
                />
                <Legend />
                <Line type="monotone" dataKey="memory_usage" name="Memory Usage %" stroke="#fbbf24" strokeWidth={2} dot={false} isAnimationActive={true} />
                <Line type="monotone" dataKey="cpu_load" name="CPU Load" stroke="#f87171" strokeWidth={2} dot={false} isAnimationActive={true} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-slate-800 p-6 rounded-lg shadow-md border border-slate-700 flex flex-col h-[450px]">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Terminal size={20} className="text-green-400" /> Live Stream
          </h2>
          <div className="flex-1 overflow-y-auto bg-black p-4 rounded font-mono text-sm border border-slate-700">
            {liveLogs.length === 0 && <p className="text-slate-500 italic">Waiting for live logs...</p>}
            {liveLogs.map((log, idx) => (
              <div key={idx} className="mb-1">
                <span className="text-slate-500">[{new Date(log.timestamp).toLocaleTimeString()}]</span>{' '}
                <span className={log.level === 'ERROR' || log.level === 'REDIS_ERROR' ? 'text-red-400' : 'text-green-400'}>{log.level}</span>:{' '}
                <span className="text-slate-300">{log.message}</span>
              </div>
            ))}
            <div ref={logEndRef} />
          </div>
        </div>

        <div className="lg:col-span-2 bg-slate-800 p-6 rounded-lg shadow-md border border-slate-700 h-[500px] flex flex-col">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Terminal size={20} className="text-blue-400" /> Log History (Filtered)
          </h2>
          <div className="flex-1 overflow-y-auto rounded border border-slate-700">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-slate-700 text-slate-300">
                <tr>
                  <th className="p-2">Timestamp</th>
                  <th className="p-2">Level</th>
                  <th className="p-2">Message</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {logsLoading && <tr><td colSpan={3} className="p-4 text-center italic text-slate-500">Loading historical logs...</td></tr>}
                {historicalLogs?.length === 0 && !logsLoading && <tr><td colSpan={3} className="p-4 text-center italic text-slate-500">No logs found for current filters.</td></tr>}
                {historicalLogs?.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-700/50">
                    <td className="p-2 text-slate-400 whitespace-nowrap">{new Date(log.timestamp).toLocaleString()}</td>
                    <td className="p-2 font-bold">
                      <span className={log.level === 'ERROR' || log.level === 'REDIS_ERROR' ? 'text-red-400' : 'text-green-400'}>{log.level}</span>
                    </td>
                    <td className="p-2 text-slate-300">{log.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-slate-800 p-6 rounded-lg shadow-md border border-slate-700 h-[500px] flex flex-col">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <ShieldAlert size={20} className="text-red-400" /> Alert History
          </h2>
          <div className="flex-1 overflow-y-auto">
             {alertsLoading && <p className="italic text-slate-500 text-sm">Loading alerts...</p>}
             {alerts?.length === 0 && !alertsLoading && <p className="italic text-slate-500 text-sm">No alerts recorded.</p>}
             <div className="space-y-3">
               {alerts?.map((alert) => (
                 <div key={alert.id} className="p-3 bg-slate-900 border-l-4 border-red-500 rounded text-sm">
                   <div className="flex justify-between items-start mb-1">
                     <span className="font-bold text-red-400">{alert.type}</span>
                     <span className="text-xs text-slate-500">{new Date(alert.created_at).toLocaleString()}</span>
                   </div>
                   <p className="text-slate-300">{alert.message}</p>
                 </div>
               ))}
             </div>
          </div>
        </div>
      </div>
    </div>
  )
}

const StatCard: React.FC<{ title: string; value: string; icon: React.ReactNode; subValue: string }> = ({ title, value, icon, subValue }) => (
  <div className="bg-slate-800 p-5 rounded-lg shadow-md border border-slate-700">
    <div className="flex justify-between items-start mb-2">
      <span className="text-slate-400 text-sm font-medium">{title}</span>
      <div className="p-2 bg-slate-700 rounded-lg">{icon}</div>
    </div>
    <div className="text-2xl font-bold mb-1">{value}</div>
    <div className="text-xs text-slate-500">{subValue}</div>
  </div>
)

export default Dashboard
