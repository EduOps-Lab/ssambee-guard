'use client'

import React, { useState, useEffect, useRef } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { Activity, Thermometer, ShieldAlert, LogOut, Terminal } from 'lucide-react'

interface BiometricData {
  id: number
  device_id: string
  heart_rate: number
  systolic_bp: number
  diastolic_bp: number
  timestamp: string
}

interface LogData {
  id: number
  level: string
  message: string
  metadata: string
  timestamp: string
}

interface DashboardProps {
  token: string
  onLogout: () => void
}

const Dashboard: React.FC<DashboardProps> = ({ token, onLogout }) => {
  const [biometrics, setBiometrics] = useState<BiometricData[]>([])
  const [logs, setLogs] = useState<LogData[]>([])
  const [errorCount, setErrorCount] = useState(0)
  const logEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || ''
    const sseUrl = `${apiUrl}/stream?token=${token}`

    const eventSource = new EventSource(sseUrl)

    eventSource.onmessage = (event) => {
      const payload = JSON.parse(event.data)
      if (payload.type === 'biometric') {
        setBiometrics(prev => [...prev.slice(-20), payload.data])
      } else if (payload.type === 'log') {
        setLogs(prev => [...prev.slice(-100), payload.data])
        if (payload.data.level === 'ERROR') {
          setErrorCount(prev => prev + 1)
        }
      }
    }

    eventSource.onerror = (err) => {
      console.error('SSE Error:', err)
      eventSource.close()
    }

    return () => eventSource.close()
  }, [token])

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  const latestBio = biometrics[biometrics.length - 1]

  return (
    <div className="min-h-screen bg-slate-900 p-6">
      {/* Header */}
      <header className="flex justify-between items-center mb-8 bg-slate-800 p-4 rounded-lg shadow-md border border-slate-700">
        <div className="flex items-center gap-3">
          <Activity className="text-blue-400 w-8 h-8" />
          <h1 className="text-xl font-bold">Monitoring Central Control</h1>
        </div>
        <button
          onClick={onLogout}
          className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded transition"
        >
          <LogOut size={18} /> Logout
        </button>
      </header>

      {/* Top Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <StatCard
          title="Heart Rate"
          value={latestBio?.heart_rate ? `${latestBio.heart_rate} BPM` : '--'}
          icon={<Activity className="text-red-400" />}
          subValue="Live updates"
        />
        <StatCard
          title="Blood Pressure"
          value={latestBio?.systolic_bp ? `${latestBio.systolic_bp}/${latestBio.diastolic_bp}` : '--'}
          icon={<Thermometer className="text-orange-400" />}
          subValue="mmHg"
        />
        <StatCard
          title="System Errors"
          value={errorCount.toString()}
          icon={<ShieldAlert className="text-red-500" />}
          subValue="Total since session"
        />
        <StatCard
          title="Active Logs"
          value={logs.length.toString()}
          icon={<Terminal className="text-green-400" />}
          subValue="Last 100 entries"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart Section */}
        <div className="bg-slate-800 p-6 rounded-lg shadow-md border border-slate-700">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Activity size={20} className="text-blue-400" /> Biometric Signals
          </h2>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={biometrics}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis
                  dataKey="timestamp"
                  stroke="#94a3b8"
                  tickFormatter={(t) => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                />
                <YAxis stroke="#94a3b8" />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px' }}
                  labelStyle={{ color: '#94a3b8' }}
                />
                <Legend />
                <Line type="monotone" dataKey="heart_rate" name="Heart Rate" stroke="#f87171" strokeWidth={2} dot={false} isAnimationActive={false} />
                <Line type="monotone" dataKey="systolic_bp" name="Systolic BP" stroke="#fbbf24" strokeWidth={2} dot={false} isAnimationActive={false} />
                <Line type="monotone" dataKey="diastolic_bp" name="Diastolic BP" stroke="#60a5fa" strokeWidth={2} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Log Viewer Section */}
        <div className="bg-slate-800 p-6 rounded-lg shadow-md border border-slate-700 flex flex-col h-[450px]">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Terminal size={20} className="text-green-400" /> Live Morgan Logs
          </h2>
          <div className="flex-1 overflow-y-auto bg-black p-4 rounded font-mono text-sm border border-slate-700">
            {logs.length === 0 && <p className="text-slate-500 italic">Waiting for logs...</p>}
            {logs.map((log) => (
              <div key={log.id} className="mb-1">
                <span className="text-slate-500">[{new Date(log.timestamp).toLocaleTimeString()}]</span>{' '}
                <span className={log.level === 'ERROR' ? 'text-red-400' : 'text-green-400'}>{log.level}</span>:{' '}
                <span className="text-slate-300">{log.message}</span>
              </div>
            ))}
            <div ref={logEndRef} />
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
