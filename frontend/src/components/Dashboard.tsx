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
  Terminal,
  Search,
  Filter,
  Clock,
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { useQueryState, parseAsString } from "nuqs";
import { useTheme } from "@/providers/ThemeProvider";
import Link from "next/link";

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

export default function Dashboard({ token }: { token: string }) {
  const [level, setLevel] = useQueryState('level', parseAsString.withDefault(''))
  const [alertType] = useQueryState('type', parseAsString.withDefault(''))
  const [range, setRange] = useQueryState('range', parseAsString.withDefault('1h'))
  const [search, setSearch] = useQueryState('search', parseAsString.withDefault(''))

  const [liveLogs, setLiveLogs] = useState<LogData[]>([]);
  const logEndRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const apiUrl = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/$/, '');

  const { data: historicalLogsResponse, isLoading: logsLoading } = useQuery<{ data: LogData[] }>({
    queryKey: ["logs", level, search, range, 1],
    queryFn: async () => {
      const res = await axios.get(`${apiUrl}/logs`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { level, search, range, page: 1, limit: 10 },
      });
      return res.data;
    },
    refetchInterval: 30000,
  });

  const historicalLogs = historicalLogsResponse?.data;

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
    refetchInterval: 10000,
  });

  useEffect(() => {
    const sseUrl = `${apiUrl}/stream?token=${token}`;
    const eventSource = new EventSource(sseUrl);

    eventSource.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === "log") {
          setLiveLogs((prev) => [...prev.slice(-49), payload.data]);
        } else if (payload.type === "alert") {
          queryClient.setQueryData(["alerts", alertType, range], (old: AlertData[] | undefined) => {
            return [payload.data, ...(old || [])].slice(0, 100);
          });
        } else if (payload.type === "metric") {
          queryClient.setQueryData(["metrics", range], (old: ServerMetric[] | undefined) => {
            return [...(old || []), payload.data].slice(-100);
          });
        }
      } catch (e) {
        // ignore
      }
    };

    eventSource.onerror = (err) => {
      console.error("SSE Error:", err);
      eventSource.close();
    };

    return () => eventSource.close();
  }, [token, apiUrl, queryClient, alertType, range]);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [liveLogs]);

  const alertCount = alerts?.length || 0;
  const latestMetric = metrics?.[metrics.length - 1];

  const { theme } = useTheme();

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4 justify-between items-center p-4 rounded-lg border shadow-sm md:flex-row bg-card">
        <div className="flex gap-3 items-center">
          <Activity className="w-8 h-8 text-blue-500" />
          <h1 className="text-xl font-bold">대시보드 요약</h1>
        </div>

        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <input
              type="text"
              placeholder="로그 검색..."
              className="py-1.5 pr-3 pl-9 text-sm rounded-md border bg-background focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="flex gap-2 items-center">
            <Filter size={16} className="text-muted-foreground" />
            <select
              className="px-2 py-1.5 text-sm rounded-md border bg-background focus:outline-none focus:ring-2 focus:ring-blue-500/20"
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
            <Clock size={16} className="text-muted-foreground" />
            <select
              className="px-2 py-1.5 text-sm rounded-md border bg-background focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              value={range}
              onChange={(e) => setRange(e.target.value)}
            >
              <option value="1h">최근 1시간</option>
              <option value="24h">최근 24시간</option>
              <option value="7d">최근 7일</option>
            </select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <StatCard
          title="CPU 부하"
          value={
            latestMetric?.cpu_load
              ? `${latestMetric.cpu_load.toFixed(2)}`
              : "--"
          }
          icon={<Activity className="text-blue-500" />}
          subValue="시스템 부하"
        />
        <StatCard
          title="메모리 사용량"
          value={
            latestMetric?.memory_usage ? `${latestMetric.memory_usage}%` : "--"
          }
          icon={<Thermometer className="text-orange-500" />}
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
          icon={<Terminal className="text-green-500" />}
          subValue="실시간 스트림"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="p-6 rounded-lg border shadow-sm lg:col-span-2 bg-card">
          <h2 className="flex justify-between items-center mb-4 text-lg font-semibold">
            <span className="flex gap-2 items-center">
              <Activity size={20} className="text-blue-500" /> 서버 성능 지표
            </span>
            <span className="text-xs text-muted-foreground font-normal">
              실시간 스트리밍 중
            </span>
          </h2>
          <div className="w-full h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={metrics}>
                <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? '#334155' : '#e2e8f0'} />
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
                    backgroundColor: theme === 'dark' ? '#1e293b' : '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: "8px",
                  }}
                  labelStyle={{ color: "#94a3b8" }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="memory_usage"
                  name="메모리 사용량 %"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
                <Line
                  type="monotone"
                  dataKey="cpu_load"
                  name="CPU 부하"
                  stroke="#ef4444"
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-card p-6 rounded-lg shadow-sm border flex flex-col h-[450px]">
          <h2 className="flex gap-2 items-center mb-4 text-lg font-semibold">
            <Terminal size={20} className="text-green-500" /> 실시간 스트림
          </h2>
          <div className="overflow-y-auto flex-1 p-4 font-mono text-xs bg-slate-950 text-slate-300 rounded-md border border-border">
            {liveLogs.length === 0 && (
              <p className="italic opacity-50">실시간 로그 대기 중...</p>
            )}
            {liveLogs.map((log, idx) => (
              <div key={idx} className="mb-1.5 break-all">
                <span className="opacity-40">
                  [{new Date(log.timestamp).toLocaleTimeString()}]
                </span>{" "}
                <span
                  className={
                    log.level === "ERROR" || log.level === "REDIS_ERROR"
                      ? "text-red-400 font-bold"
                      : "text-green-400 font-bold"
                  }
                >
                  {log.level}
                </span>
                : <span className="text-slate-200">{log.message}</span>
              </div>
            ))}
            <div ref={logEndRef} />
          </div>
        </div>

        <div className="lg:col-span-2 bg-card p-6 rounded-lg shadow-sm border h-[500px] flex flex-col">
          <div className="flex justify-between items-center mb-4">
            <h2 className="flex gap-2 items-center text-lg font-semibold">
              <Terminal size={20} className="text-blue-500" /> 최근 로그 기록
            </h2>
            <Link href="/logs" className="text-xs text-blue-500 hover:underline">
              전체 보기 →
            </Link>
          </div>
          <div className="overflow-y-auto flex-1 rounded-md border border-border">
            <table className="w-full text-sm text-left">
              <thead className="sticky top-0 bg-muted text-muted-foreground font-medium">
                <tr>
                  <th className="p-3">타임스탬프</th>
                  <th className="p-3">레벨</th>
                  <th className="p-3">메시지</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {logsLoading && (
                  <tr>
                    <td
                      colSpan={3}
                      className="p-8 italic text-center opacity-50"
                    >
                      로그 기록 로드 중...
                    </td>
                  </tr>
                )}
                {historicalLogs?.length === 0 && !logsLoading && (
                  <tr>
                    <td
                      colSpan={3}
                      className="p-8 italic text-center opacity-50"
                    >
                      현재 필터에 해당하는 로그가 없습니다.
                    </td>
                  </tr>
                )}
                {historicalLogs?.map((log) => (
                  <tr key={log.id} className="hover:bg-muted/50 transition-colors">
                    <td className="p-3 whitespace-nowrap opacity-60">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="p-3 font-bold">
                      <span
                        className={
                          log.level === "ERROR" || log.level === "REDIS_ERROR"
                            ? "text-red-500"
                            : "text-green-500"
                        }
                      >
                        {log.level}
                      </span>
                    </td>
                    <td className="p-3 opacity-90">{log.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-card p-6 rounded-lg shadow-sm border h-[500px] flex flex-col">
          <h2 className="flex gap-2 items-center mb-4 text-lg font-semibold">
            <ShieldAlert size={20} className="text-red-500" /> 알림 내역
          </h2>
          <div className="overflow-y-auto flex-1 space-y-3">
            {alertsLoading && (
              <p className="text-sm italic opacity-50">알림 로드 중...</p>
            )}
            {alerts?.length === 0 && !alertsLoading && (
              <p className="text-sm italic opacity-50">
                기록된 알림이 없습니다.
              </p>
            )}
            {alerts?.map((alert) => (
              <div
                key={alert.id}
                className="p-4 text-sm rounded-lg border-l-4 border-red-500 bg-muted/30 hover:bg-muted/50 transition-all"
              >
                <div className="flex justify-between items-start mb-2">
                  <span className="font-bold text-red-500 uppercase">{alert.type}</span>
                  <span className="text-[10px] opacity-40">
                    {new Date(alert.created_at).toLocaleString()}
                  </span>
                </div>
                <p className="opacity-90 leading-relaxed">{alert.message}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

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
  <div className="p-5 rounded-lg border shadow-sm bg-card hover:shadow-md transition-shadow">
    <div className="flex justify-between items-start mb-3">
      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{title}</span>
      <div className="p-2 rounded-lg bg-muted text-blue-500">{icon}</div>
    </div>
    <div className="mb-1 text-2xl font-bold">{value}</div>
    <div className="text-xs text-muted-foreground">{subValue}</div>
  </div>
  );
}
