'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Users, Home, BookOpen, ThumbsUp, Activity, Search, Pencil, Trash2, ChevronLeft, ChevronRight, FileText } from 'lucide-react'
import { toast } from 'sonner'
import { getAvatarEmoji } from '@/lib/avatar-icons'

type Tab = 'overview' | 'users' | 'households' | 'audit'

interface Stats {
  userCount: number
  householdCount: number
  articleCount: number
  recommendationCount: number
  activeUsersLast30Days: number
}

interface AdminUser {
  id: string
  name: string
  email: string
  avatarUrl: string | null
  avatarIcon: string | null
  isAdmin: boolean
  hardcoverUsername: string | null
  createdAt: string
  households: { id: string; name: string; role: string }[]
}

interface AdminHousehold {
  id: string
  name: string
  inviteCode: string
  createdAt: string
  members: { id: string; name: string; email: string; avatarIcon: string | null; role: string }[]
}

interface AuditEntry {
  id: string
  action: string
  user: { id: string; name: string; email: string } | null
  targetId: string | null
  details: Record<string, unknown> | null
  ipAddress: string | null
  createdAt: string
}

export function AdminContent() {
  const [tab, setTab] = useState<Tab>('overview')

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Admin Dashboard</h1>
        <p className="text-muted-foreground text-sm">Site administration and management</p>
      </div>

      <div className="flex gap-2 border-b pb-2">
        {(['overview', 'users', 'households', 'audit'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium rounded-t cursor-pointer transition-colors ${
              tab === t ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
            }`}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {tab === 'overview' && <OverviewTab />}
      {tab === 'users' && <UsersTab />}
      {tab === 'households' && <HouseholdsTab />}
      {tab === 'audit' && <AuditTab />}
    </div>
  )
}

function OverviewTab() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/admin/stats')
      .then(r => r.json())
      .then(r => setStats(r.data))
      .catch(() => toast.error('Failed to load stats'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <p className="text-muted-foreground">Loading stats...</p>
  if (!stats) return <p className="text-muted-foreground">Failed to load stats.</p>

  const cards = [
    { label: 'Total Users', value: stats.userCount, icon: Users },
    { label: 'Households', value: stats.householdCount, icon: Home },
    { label: 'Articles Shared', value: stats.articleCount, icon: BookOpen },
    { label: 'Recommendations', value: stats.recommendationCount, icon: ThumbsUp },
    { label: 'Active (30d)', value: stats.activeUsersLast30Days, icon: Activity },
  ]

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
      {cards.map(c => (
        <Card key={c.label}>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5">
              <c.icon className="h-3.5 w-3.5" />
              {c.label}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{c.value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function UsersTab() {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [editUser, setEditUser] = useState<AdminUser | null>(null)
  const [editName, setEditName] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleteUser, setDeleteUser] = useState<AdminUser | null>(null)
  const [deleting, setDeleting] = useState(false)

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' })
      if (search) params.set('search', search)
      const res = await fetch(`/api/admin/users?${params}`)
      const json = await res.json()
      setUsers(json.data.users)
      setTotalPages(json.data.totalPages)
    } catch {
      toast.error('Failed to load users')
    } finally {
      setLoading(false)
    }
  }, [page, search])

  useEffect(() => { fetchUsers() }, [fetchUsers])

  const handleEdit = async () => {
    if (!editUser) return
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/users/${editUser.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName, email: editEmail }),
      })
      if (!res.ok) {
        const err = await res.json()
        toast.error(err.error || 'Failed to update')
        return
      }
      toast.success('User updated')
      setEditUser(null)
      fetchUsers()
    } catch {
      toast.error('Failed to update user')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteUser) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/admin/users/${deleteUser.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const err = await res.json()
        toast.error(err.error || 'Failed to delete')
        return
      }
      toast.success('User deleted')
      setDeleteUser(null)
      fetchUsers()
    } catch {
      toast.error('Failed to delete user')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2 items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search users..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            className="pl-9"
          />
        </div>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="divide-y">
              {users.map(user => {
                const emoji = getAvatarEmoji(user.avatarIcon)
                return (
                  <div key={user.id} className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar className="h-9 w-9">
                        <AvatarFallback className={emoji ? 'text-lg' : 'text-xs'}>
                          {emoji || user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium truncate">{user.name}</span>
                          {user.isAdmin && <Badge variant="secondary" className="text-xs">Admin</Badge>}
                        </div>
                        <p className="text-sm text-muted-foreground truncate">{user.email}</p>
                        {user.households.length > 0 && (
                          <div className="flex gap-1 mt-0.5 flex-wrap">
                            {user.households.map(h => (
                              <Badge key={h.id} variant="outline" className="text-xs">
                                {h.name} ({h.role})
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="cursor-pointer"
                        onClick={() => {
                          setEditUser(user)
                          setEditName(user.name)
                          setEditEmail(user.email)
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      {!user.isAdmin && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="cursor-pointer text-destructive hover:text-destructive"
                          onClick={() => setDeleteUser(user)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                )
              })}
              {users.length === 0 && (
                <p className="p-4 text-center text-muted-foreground">No users found.</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage(p => p - 1)}
            className="cursor-pointer"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage(p => p + 1)}
            className="cursor-pointer"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Edit User Dialog */}
      <Dialog open={!!editUser} onOpenChange={open => !open && setEditUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>Update user details.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Name</label>
              <Input value={editName} onChange={e => setEditName(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium">Email</label>
              <Input value={editEmail} onChange={e => setEditEmail(e.target.value)} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditUser(null)} className="cursor-pointer">Cancel</Button>
              <Button onClick={handleEdit} disabled={saving} className="cursor-pointer">
                {saving ? 'Saving...' : 'Save'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete User Dialog */}
      <Dialog open={!!deleteUser} onOpenChange={open => !open && setDeleteUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete User</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>{deleteUser?.name}</strong> ({deleteUser?.email})?
              This will permanently delete their account and all related data.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeleteUser(null)} className="cursor-pointer">Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting} className="cursor-pointer">
              {deleting ? 'Deleting...' : 'Delete User'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function HouseholdsTab() {
  const [households, setHouseholds] = useState<AdminHousehold[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/admin/households')
      .then(r => r.json())
      .then(r => setHouseholds(r.data))
      .catch(() => toast.error('Failed to load households'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <p className="text-muted-foreground">Loading households...</p>

  return (
    <div className="space-y-4">
      {households.length === 0 ? (
        <p className="text-muted-foreground">No households found.</p>
      ) : (
        households.map(h => (
          <Card key={h.id}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{h.name}</CardTitle>
                <Badge variant="outline" className="text-xs font-mono">{h.inviteCode}</Badge>
              </div>
              <CardDescription>
                {h.members.length} member{h.members.length !== 1 ? 's' : ''} &middot; Created {new Date(h.createdAt).toLocaleDateString()}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {h.members.map(m => {
                  const emoji = getAvatarEmoji(m.avatarIcon)
                  return (
                    <div key={m.id} className="flex items-center gap-2 text-sm">
                      <Avatar className="h-6 w-6">
                        <AvatarFallback className={`text-xs ${emoji ? '' : ''}`}>
                          {emoji || m.name[0]?.toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span>{m.name}</span>
                      <span className="text-muted-foreground">({m.email})</span>
                      {m.role === 'admin' && <Badge variant="secondary" className="text-xs">Admin</Badge>}
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  )
}

const ACTION_LABELS: Record<string, string> = {
  login: 'Login',
  register: 'Registration',
  logout: 'Logout',
  profile_update: 'Profile Update',
  account_delete: 'Account Deleted',
  household_rename: 'Household Renamed',
  household_leave: 'Left Household',
  invite_regen: 'Invite Code Regenerated',
  role_change: 'Role Changed',
  member_remove: 'Member Removed',
  admin_user_edit: 'Admin: User Edited',
  admin_user_delete: 'Admin: User Deleted',
}

function AuditTab() {
  const [logs, setLogs] = useState<AuditEntry[]>([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [actionFilter, setActionFilter] = useState('')

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), limit: '30' })
      if (actionFilter) params.set('action', actionFilter)
      const res = await fetch(`/api/admin/audit?${params}`)
      const json = await res.json()
      setLogs(json.data.logs)
      setTotalPages(json.data.totalPages)
    } catch {
      toast.error('Failed to load audit logs')
    } finally {
      setLoading(false)
    }
  }, [page, actionFilter])

  useEffect(() => { fetchLogs() }, [fetchLogs])

  const actionTypes = Object.keys(ACTION_LABELS)

  return (
    <div className="space-y-4">
      <div className="flex gap-2 items-center flex-wrap">
        <Button
          variant={actionFilter === '' ? 'default' : 'outline'}
          size="sm"
          className="cursor-pointer"
          onClick={() => { setActionFilter(''); setPage(1) }}
        >
          All
        </Button>
        {actionTypes.map(a => (
          <Button
            key={a}
            variant={actionFilter === a ? 'default' : 'outline'}
            size="sm"
            className="cursor-pointer text-xs"
            onClick={() => { setActionFilter(a); setPage(1) }}
          >
            {ACTION_LABELS[a]}
          </Button>
        ))}
      </div>

      {loading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : logs.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <FileText className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-muted-foreground">No audit logs found.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="divide-y">
              {logs.map(log => (
                <div key={log.id} className="p-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Badge variant="outline" className="text-xs shrink-0">
                        {ACTION_LABELS[log.action] || log.action}
                      </Badge>
                      <span className="truncate">
                        {log.user ? (
                          <span className="font-medium">{log.user.name}</span>
                        ) : (
                          <span className="text-muted-foreground italic">Deleted user</span>
                        )}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString()}
                    </span>
                  </div>
                  {log.details && Object.keys(log.details).length > 0 && (
                    <p className="text-xs text-muted-foreground mt-1 truncate">
                      {Object.entries(log.details).map(([k, v]) => `${k}: ${v}`).join(', ')}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage(p => p - 1)}
            className="cursor-pointer"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage(p => p + 1)}
            className="cursor-pointer"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  )
}
