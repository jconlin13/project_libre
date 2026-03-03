import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logAudit } from '@/lib/audit'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin()
    if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { id } = await params
    const body = await request.json()
    const { name, email } = body

    const target = await prisma.user.findUnique({ where: { id } })
    if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    const updates: Record<string, string> = {}
    if (name?.trim()) updates.name = name.trim()
    if (email?.trim()) {
      const normalizedEmail = email.trim().toLowerCase()
      if (normalizedEmail !== target.email) {
        const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } })
        if (existing) return NextResponse.json({ error: 'Email already in use' }, { status: 409 })
        updates.email = normalizedEmail
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No changes' }, { status: 400 })
    }

    const updated = await prisma.user.update({
      where: { id },
      data: updates,
      select: { id: true, name: true, email: true },
    })

    await logAudit({ userId: admin.id, action: 'admin_user_edit', targetId: id, details: updates })

    return NextResponse.json({ data: updated })
  } catch (error) {
    console.error('Admin user update error:', error)
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin()
    if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { id } = await params

    // Don't allow deleting self
    if (id === admin.id) {
      return NextResponse.json({ error: 'Cannot delete your own account from admin panel' }, { status: 400 })
    }

    const target = await prisma.user.findUnique({ where: { id } })
    if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    await logAudit({ userId: admin.id, action: 'admin_user_delete', targetId: id, details: { email: target.email, name: target.name } })

    await prisma.user.delete({ where: { id } })

    return NextResponse.json({ data: { deleted: true } })
  } catch (error) {
    console.error('Admin user delete error:', error)
    return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 })
  }
}
