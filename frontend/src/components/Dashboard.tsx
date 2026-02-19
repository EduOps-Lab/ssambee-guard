"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import {
  Activity,
  Thermometer,
  ShieldAlert,
  LogOut,
  Terminal,
  Search,
  Filter,
  Clock,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { useQueryState, parseAsString } from "nuqs";

interface ServerMetric {
  id: number;
  cpu_load: number;
  memory_usage: number;
  uptime: number;
  created_at: string;
}

interface LogData {
  id: number;
  level: string;
  message: string;
  metadata: string;
  timestamp: string;
}

interface AlertData {
  id: number;
  type: string;
  message: string;
  metadata: string;
  created_at: string;
}

interface DashboardProps {
  token: string;
  onLogout: () => void;
}

export default function Dashboard({ token, onLogout }: DashboardProps) {
  const [level, setLevel] = useQueryState('level', parseAsString.withDefault(''))
  const [alertType, _setAlertType] = useQueryState('type', parseAsString.withDefault(''))
  const [range, setRange] = useQueryState('range', parseAsString.withDefault('1h'))
  const [search, setSearch] = useQueryState('search', parseAsString.withDefault(''))

  const [liveLogs, setLiveLogs] = useState<LogData[]>([]);
  const logEndRef = useRef<HTMLDivElement>(null);

  const apiUrl = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/$/, '');

  const { data: historicalLogs, isLoading: logsLoading } = useQuery<LogData[]>({
    queryKey: ["logs", level, search, range],
    queryFn: async () => {
      const res = await axios.get(`${apiUrl}/logs`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { level, search, range },
      });
      return res.data;
    },
    refetchInterval: 30000,
  });

  const { data: alerts, isLoading: alertsLoading } = useQuery<AlertData[]>({
    queryKey: ["alerts", alertType, range],
    queryFn: async () => {
      const res = await axios.get(`${apiUrl}/alerts`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { type: alertType, range },
      });
      return res.data;
    },
  });

  const { data: metrics } = useQuery<ServerMetric[]>({
    queryKey: ["metrics", range],
    queryFn: async () => {
      const res = await axios.get(`${apiUrl}/metrics`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { range },
      });
      return res.data;
    },
    refetchInterval: 5000,
  });

  useEffect(() => {
    const sseUrl = `${apiUrl}/stream?token=${token}`;
    const eventSource = new EventSource(sseUrl, { withCredentials: true });

    eventSource.onmessage = (event) => {
      const payload = JSON.parse(event.data);
      if (payload.type === "log") {
        setLiveLogs((prev) => [...prev.slice(-50), payload.data]);
      }
    };

    eventSource.onerror = (err) => {
      console.error("SSE Error:", err);
      eventSource.close();
    };

    return () => eventSource.close();
  }, [token, apiUrl]);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [liveLogs]);

  const alertCount = alerts?.length || 0;
  const latestMetric = metrics?.[metrics.length - 1];

  return (
    <div className="p-6 min-h-screen bg-slate-900 text-slate-100">
      <header className="flex flex-col gap-4 justify-between items-center p-4 mb-8 rounded-lg border shadow-md md:flex-row bg-slate-800 border-slate-700">
        <div className="flex gap-3 items-center">
          <Activity className="w-8 h-8 text-blue-400" />
          <h1 className="text-xl font-bold">모니터링 중앙 제어</h1>
        </div>

        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="text"
              placeholder="로그 검색..."
              className="py-1 pr-3 pl-9 text-sm rounded-md border bg-slate-700 border-slate-600 focus:outline-none focus:border-blue-500"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="flex gap-2 items-center">
            <Filter size={16} className="text-slate-400" />
            <select
              className="px-2 py-1 text-sm rounded-md border bg-slate-700 border-slate-600 focus:outline-none"
              value={level}
              onChange={(e) => setLevel(e.target.value)}
            >
              <option value="">모든 레벨</option>
              <option value="INFO">정보 (INFO)</option>
              <option value="WARN">경고 (WARN)</option>
              <option value="ERROR">에러 (ERROR)</option>
              <option value="REDIS_ERROR">레디스 에러 (REDIS_ERROR)</option>
            </select>
          </div>

          <div className="flex gap-2 items-center">
            <Clock size={16} className="text-slate-400" />
            <select
              className="px-2 py-1 text-sm rounded-md border bg-slate-700 border-slate-600 focus:outline-none"
              value={range}
              onChange={(e) => setRange(e.target.value)}
            >
              <option value="1h">최근 1시간</option>
              <option value="24h">최근 24시간</option>
              <option value="7d">최근 7일</option>
            </select>
          </div>

          <button
            onClick={onLogout}
            className="flex items-center gap-2 px-4 py-1.5 bg-red-600 hover:bg-red-700 rounded text-sm transition font-medium"
          >
            <LogOut size={16} /> 로그아웃
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4 mb-8 md:grid-cols-4">
        <StatCard
          title="CPU 부하"
          value={
            latestMetric?.cpu_load
              ? `${latestMetric.cpu_load.toFixed(2)}`
              : "--"
          }
          icon={<Activity className="text-blue-400" />}
          subValue="시스템 부하"
        />
        <StatCard
          title="메모리 사용량"
          value={
            latestMetric?.memory_usage ? `${latestMetric.memory_usage}%` : "--"
          }
          icon={<Thermometer className="text-orange-400" />}
          subValue="RAM 사용율"
        />
        <StatCard
          title="알림 횟수"
          value={alertCount.toString()}
          icon={<ShieldAlert className="text-red-500" />}
          subValue="실제 발송된 알림"
        />
        <StatCard
          title="실시간 상태"
          value={liveLogs.length > 0 ? "활성" : "대기"}
          icon={<Terminal className="text-green-400" />}
          subValue="실시간 스트림"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="p-6 rounded-lg border shadow-md lg:col-span-2 bg-slate-800 border-slate-700">
          <h2 className="flex justify-between items-center mb-4 text-lg font-semibold">
            <span className="flex gap-2 items-center">
              <Activity size={20} className="text-blue-400" /> 서버 성능 지표
            </span>
            <span className="text-xs text-slate-500">
              5초마다 자동 갱신
            </span>
          </h2>
          <div className="w-full h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={metrics}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis
                  dataKey="created_at"
                  stroke="#94a3b8"
                  tickFormatter={(t) =>
                    new Date(t).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  }
                />
                <YAxis stroke="#94a3b8" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#1e293b",
                    border: "none",
                    borderRadius: "8px",
                  }}
                  labelStyle={{ color: "#94a3b8" }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="memory_usage"
                  name="메모리 사용량 %"
                  stroke="#fbbf24"
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={true}
                />
                <Line
                  type="monotone"
                  dataKey="cpu_load"
                  name="CPU 부하"
                  stroke="#f87171"
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={true}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-slate-800 p-6 rounded-lg shadow-md border border-slate-700 flex flex-col h-[450px]">
          <h2 className="flex gap-2 items-center mb-4 text-lg font-semibold">
            <Terminal size={20} className="text-green-400" /> 실시간 스트림
          </h2>
          <div className="overflow-y-auto flex-1 p-4 font-mono text-sm bg-black rounded border border-slate-700">
            {liveLogs.length === 0 && (
              <p className="italic text-slate-500">실시간 로그 대기 중...</p>
            )}
            {liveLogs.map((log, idx) => (
              <div key={idx} className="mb-1">
                <span className="text-slate-500">
                  [{new Date(log.timestamp).toLocaleTimeString()}]
                </span>{" "}
                <span
                  className={
                    log.level === "ERROR" || log.level === "REDIS_ERROR"
                      ? "text-red-400"
                      : "text-green-400"
                  }
                >
                  {log.level}
                </span>
                : <span className="text-slate-300">{log.message}</span>
              </div>
            ))}
            <div ref={logEndRef} />
          </div>
        </div>

        <div className="lg:col-span-2 bg-slate-800 p-6 rounded-lg shadow-md border border-slate-700 h-[500px] flex flex-col">
          <h2 className="flex gap-2 items-center mb-4 text-lg font-semibold">
            <Terminal size={20} className="text-blue-400" /> 로그 기록 (필터링됨)
          </h2>
          <div className="overflow-y-auto flex-1 rounded border border-slate-700">
            <table className="w-full text-sm text-left">
              <thead className="sticky top-0 bg-slate-700 text-slate-300">
                <tr>
                  <th className="p-2">타임스탬프</th>
                  <th className="p-2">레벨</th>
                  <th className="p-2">메시지</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {logsLoading && (
                  <tr>
                    <td
                      colSpan={3}
                      className="p-4 italic text-center text-slate-500"
                    >
                      로그 기록 로드 중...
                    </td>
                  </tr>
                )}
                {historicalLogs?.length === 0 && !logsLoading && (
                  <tr>
                    <td
                      colSpan={3}
                      className="p-4 italic text-center text-slate-500"
                    >
                      현재 필터에 해당하는 로그가 없습니다.
                    </td>
                  </tr>
                )}
                {historicalLogs?.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-700/50">
                    <td className="p-2 whitespace-nowrap text-slate-400">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="p-2 font-bold">
                      <span
                        className={
                          log.level === "ERROR" || log.level === "REDIS_ERROR"
                            ? "text-red-400"
                            : "text-green-400"
                        }
                      >
                        {log.level}
                      </span>
                    </td>
                    <td className="p-2 text-slate-300">{log.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-slate-800 p-6 rounded-lg shadow-md border border-slate-700 h-[500px] flex flex-col">
          <h2 className="flex gap-2 items-center mb-4 text-lg font-semibold">
            <ShieldAlert size={20} className="text-red-400" /> 알림 내역
          </h2>
          <div className="overflow-y-auto flex-1">
            {alertsLoading && (
              <p className="text-sm italic text-slate-500">알림 로드 중...</p>
            )}
            {alerts?.length === 0 && !alertsLoading && (
              <p className="text-sm italic text-slate-500">
                기록된 알림이 없습니다.
              </p>
            )}
            <div className="space-y-3">
              {alerts?.map((alert) => (
                <div
                  key={alert.id}
                  className="p-3 text-sm rounded border-l-4 border-red-500 bg-slate-900"
                >
                  <div className="flex justify-between items-start mb-1">
                    <span className="font-bold text-red-400">{alert.type}</span>
                    <span className="text-xs text-slate-500">
                      {new Date(alert.created_at).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-slate-300">{alert.message}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

function StatCard({
  title,
  value,
  icon,
  subValue,
}: {
  title: string;
  value: string;
  icon: React.ReactNode;
  subValue: string;
}) {
  return (
  <div className="p-5 rounded-lg border shadow-md bg-slate-800 border-slate-700">
    <div className="flex justify-between items-start mb-2">
      <span className="text-sm font-medium text-slate-400">{title}</span>
      <div className="p-2 rounded-lg bg-slate-700">{icon}</div>
    </div>
    <div className="mb-1 text-2xl font-bold">{value}</div>
    <div className="text-xs text-slate-500">{subValue}</div>
  </div>
  );
}
