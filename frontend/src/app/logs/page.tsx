'use client'

import { Terminal, Search, Filter, Clock, ArrowLeft } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import { useQueryState, parseAsString } from 'nuqs'
import Link from 'next/link'
import { useTheme } from '@/providers/ThemeProvider'

interface LogData {
  id: number
  level: string
  message: string
  metadata: string
  timestamp: string
}

export default function LogsPage() {
  const [level, setLevel] = useQueryState('level', parseAsString.withDefault(''))
  const [range, setRange] = useQueryState('range', parseAsString.withDefault('1h'))
  const [search, setSearch] = useQueryState('search', parseAsString.withDefault(''))
  const [page, setPage] = useQueryState('page', parseAsString.withDefault('1'))

  const apiUrl = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '')
  const { theme } = useTheme()

  const { data: logsResponse, isLoading } = useQuery<{ data: LogData[], total: number }>({
    queryKey: ['logs', level, search, range, page],
    queryFn: async () => {
      const res = await axios.get(`${apiUrl}/logs`, {
        params: { level, search, range, page: parseInt(page), limit: 50 },
      })
      return res.data
    },
  })

  const logs = logsResponse?.data
  const totalPages = Math.ceil((logsResponse?.total || 0) / 50)

  return (
    <div className="container px-4 py-8 mx-auto">
      <div className="mb-6">
        <Link
          href="/"
          className="inline-flex gap-2 items-center mb-4 text-sm transition-colors text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft size={16} />
          대시보드로 돌아가기
        </Link>

        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex gap-3 items-center">
            <Terminal className="w-8 h-8 text-blue-500" />
            <h1 className="text-2xl font-bold">로그 상세</h1>
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
                className="py-1.5 pr-3 pl-9 text-sm rounded-md border bg-background focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all w-64"
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
      </div>

      <div className="overflow-hidden rounded-lg border shadow-sm bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="sticky top-0 font-medium bg-muted text-muted-foreground">
              <tr>
                <th className="p-3 w-48">타임스탬프</th>
                <th className="p-3 w-32">레벨</th>
                <th className="p-3">메시지</th>
                <th className="p-3 w-48">메타데이터</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {isLoading && (
                <tr>
                  <td colSpan={4} className="p-8 italic text-center opacity-50">
                    로그 기록 로드 중...
                  </td>
                </tr>
              )}
              {logs?.length === 0 && !isLoading && (
                <tr>
                  <td colSpan={4} className="p-8 italic text-center opacity-50">
                    현재 필터에 해당하는 로그가 없습니다.
                  </td>
                </tr>
              )}
              {logs?.map((log) => (
                <tr key={log.id} className="transition-colors hover:bg-muted/50">
                  <td className="p-3 whitespace-nowrap opacity-60">
                    {new Date(log.timestamp).toLocaleString()}
                  </td>
                  <td className="p-3 font-bold">
                    <span
                      className={
                        log.level === 'ERROR' || log.level === 'REDIS_ERROR'
                          ? 'text-red-500'
                          : log.level === 'WARN'
                          ? 'text-yellow-500'
                          : 'text-green-500'
                      }
                    >
                      {log.level}
                    </span>
                  </td>
                  <td className="p-3 opacity-90">{log.message}</td>
                  <td className="p-3 font-mono text-xs opacity-60">
                    {log.metadata && (
                      <pre className="whitespace-pre-wrap">
                        {JSON.stringify(JSON.parse(log.metadata), null, 2)}
                      </pre>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex gap-2 justify-center p-4 border-t">
            <button
              onClick={() => setPage(String(Math.max(1, parseInt(page) - 1)))}
              disabled={parseInt(page) === 1}
              className="px-3 py-1.5 text-sm rounded-md border bg-background hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              이전
            </button>
            <span className="px-3 py-1.5 text-sm text-muted-foreground">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage(String(Math.min(totalPages, parseInt(page) + 1)))}
              disabled={parseInt(page) === totalPages}
              className="px-3 py-1.5 text-sm rounded-md border bg-background hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              다음
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
