'use client'

import React, { useState } from 'react'
import AuthenticatedLayout from '@/components/AuthenticatedLayout'
import { useAuth } from '@/providers/AuthProvider'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { Users, UserPlus, UserMinus, Shield, ShieldAlert, Trash2, Check, X } from 'lucide-react'
import { jwtDecode } from 'jwt-decode'

interface UserData {
  id: number
  username: string
  role: string
  is_approved: number
  created_at: string
}

export default function UsersPage() {
  const { token } = useAuth()
  const queryClient = useQueryClient()
  const [actionLoading, setActionLoading] = useState<number | null>(null)

  let myRole = 'member'
  let myId = -1
  try {
    if (token) {
      const decoded: any = jwtDecode(token)
      myRole = decoded.role
      myId = decoded.userId
    }
  } catch (e) {}

  const apiUrl = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '')

  const { data: users, isLoading } = useQuery<UserData[]>({
    queryKey: ['users'],
    queryFn: async () => {
      const res = await axios.get(`${apiUrl}/users`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      return res.data
    },
    enabled: !!token && myRole === 'admin',
  })

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      await axios.patch(`${apiUrl}/users/${id}`, data, {
        headers: { Authorization: `Bearer ${token}` },
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      setActionLoading(null)
    },
    onError: () => setActionLoading(null)
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await axios.delete(`${apiUrl}/users/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      setActionLoading(null)
    },
    onError: () => setActionLoading(null)
  })

  const handleApprove = (id: number) => {
    setActionLoading(id)
    updateMutation.mutate({ id, data: { is_approved: 1 } })
  }

  const handleReject = (id: number) => {
    setActionLoading(id)
    deleteMutation.mutate(id)
  }

  const handleToggleRole = (id: number, currentRole: string) => {
    setActionLoading(id)
    const newRole = currentRole === 'admin' ? 'member' : 'admin'
    updateMutation.mutate({ id, data: { role: newRole } })
  }

  const handleWithdrawRequest = async () => {
    if (!confirm('정말로 탈퇴하시겠습니까? 관리자의 승인 후 처리됩니다.')) return
    try {
      await axios.post(`${apiUrl}/users/withdraw`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      })
      alert('탈퇴 요청이 전송되었습니다.')
    } catch (e) {
      alert('탈퇴 요청 중 오류가 발생했습니다.')
    }
  }

  if (myRole !== 'admin') {
    return (
      <AuthenticatedLayout>
        <div className="max-w-md mx-auto mt-12 p-8 rounded-xl border bg-card text-center shadow-lg">
          <ShieldAlert className="w-16 h-16 text-orange-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">내 프로필</h1>
          <p className="text-muted-foreground mb-6">회원님의 정보 및 상태를 확인할 수 있습니다.</p>

          <div className="bg-muted/50 p-4 rounded-lg mb-8 text-left space-y-2">
            <div className="flex justify-between">
              <span className="opacity-60">권한:</span>
              <span className="font-bold uppercase text-blue-500">{myRole}</span>
            </div>
          </div>

          <button
            onClick={handleWithdrawRequest}
            className="w-full py-2.5 rounded-lg border border-red-500/50 text-red-500 hover:bg-red-500 hover:text-white transition-all font-medium"
          >
            탈퇴 요청하기
          </button>
        </div>
      </AuthenticatedLayout>
    )
  }

  return (
    <AuthenticatedLayout>
      <div className="flex flex-col gap-6">
        <div className="flex justify-between items-center p-4 rounded-lg border bg-card">
          <div className="flex items-center gap-3">
            <Users className="w-8 h-8 text-blue-500" />
            <h1 className="text-xl font-bold">사용자 관리 센터</h1>
          </div>
          <div className="text-xs text-muted-foreground">
            전체 사용자: <strong>{users?.length || 0}</strong>명
          </div>
        </div>

        <div className="rounded-lg border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted text-muted-foreground font-medium border-b">
                <tr>
                  <th className="p-4">사용자</th>
                  <th className="p-4">권한</th>
                  <th className="p-4">상태</th>
                  <th className="p-4 text-right">관리 작업</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {isLoading ? (
                  <tr>
                    <td colSpan={4} className="p-12 text-center opacity-50">데이터를 불러오는 중...</td>
                  </tr>
                ) : users?.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-12 text-center opacity-50">사용자가 없습니다.</td>
                  </tr>
                ) : (
                  users?.map((user) => (
                    <tr key={user.id} className="hover:bg-muted/30 transition-colors">
                      <td className="p-4">
                        <div className="flex flex-col">
                          <span className="font-bold">{user.username}</span>
                          <span className="text-[10px] opacity-40">{new Date(user.created_at).toLocaleString()}</span>
                        </div>
                      </td>
                      <td className="p-4">
                        <button
                          onClick={() => handleToggleRole(user.id, user.role)}
                          disabled={actionLoading === user.id || user.id === myId}
                          className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-bold uppercase transition-all ${
                            user.role === 'admin'
                              ? 'bg-blue-500/10 text-blue-500 border border-blue-500/20'
                              : 'bg-slate-500/10 text-slate-500 border border-slate-500/20'
                          } disabled:opacity-50`}
                        >
                          <Shield size={12} />
                          {user.role}
                        </button>
                      </td>
                      <td className="p-4">
                        {user.is_approved === 1 ? (
                          <span className="inline-flex items-center gap-1 text-green-500 text-xs font-medium bg-green-500/10 px-2 py-0.5 rounded-full border border-green-500/20">
                            <Check size={12} /> 승인됨
                          </span>
                        ) : user.is_approved === 0 ? (
                          <span className="inline-flex items-center gap-1 text-orange-500 text-xs font-medium bg-orange-500/10 px-2 py-0.5 rounded-full border border-orange-500/20">
                            <Clock size={12} /> 승인 대기
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-red-500 text-xs font-medium bg-red-500/10 px-2 py-0.5 rounded-full border border-red-500/20 animate-pulse">
                            <ShieldAlert size={12} /> 탈퇴 요청
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex justify-end gap-2">
                          {user.is_approved === 0 && (
                            <button
                              onClick={() => handleApprove(user.id)}
                              disabled={actionLoading === user.id}
                              className="p-1.5 rounded-md bg-green-500 text-white hover:bg-green-600 transition-colors"
                              title="가입 승인"
                            >
                              <UserPlus size={16} />
                            </button>
                          )}
                          {user.is_approved === 2 && (
                            <button
                              onClick={() => handleApprove(user.id)}
                              disabled={actionLoading === user.id}
                              className="p-1.5 rounded-md bg-blue-500 text-white hover:bg-blue-600 transition-colors"
                              title="탈퇴 요청 거절 (유지)"
                            >
                              <Check size={16} />
                            </button>
                          )}
                          {user.is_approved === 0 && (
                            <button
                              onClick={() => handleReject(user.id)}
                              disabled={actionLoading === user.id}
                              className="p-1.5 rounded-md bg-orange-500 text-white hover:bg-orange-600 transition-colors"
                              title="가입 거절 (삭제)"
                            >
                              <X size={16} />
                            </button>
                          )}
                          {user.is_approved === 2 && (
                            <button
                              onClick={() => handleReject(user.id)}
                              disabled={actionLoading === user.id}
                              className="p-1.5 rounded-md bg-red-600 text-white hover:bg-red-700 transition-colors"
                              title="탈퇴 요청 승인 (삭제)"
                            >
                              <UserMinus size={16} />
                            </button>
                          )}
                          {user.id !== myId && (
                            <button
                              onClick={() => {
                                if (confirm('정말로 이 사용자를 삭제하시겠습니까?')) {
                                  setActionLoading(user.id)
                                  deleteMutation.mutate(user.id)
                                }
                              }}
                              disabled={actionLoading === user.id}
                              className="p-1.5 rounded-md bg-red-500 text-white hover:bg-red-600 transition-colors"
                              title="삭제"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AuthenticatedLayout>
  )
}
