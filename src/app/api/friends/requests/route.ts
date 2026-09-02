import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logAudit } from '@/lib/audit'

export const dynamic = 'force-dynamic'

// Send a friend request by email. Email lookup (rather than browsing users)
// keeps the app from exposing a directory of everyone who has an account.
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { email } = await request.json()
    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Email required' }, { status: 400 })
    }

    const target = await prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
      select: { id: true, name: true },
    })

    // Same response whether or not the address exists, so this can't be used
    // to probe which emails have accounts.
    const vagueOk = NextResponse.json({
      data: { message: 'If that person has an account, they will see your request.' },
    })

    if (!target || target.id === user.id) return vagueOk

    const existing = await prisma.friendship.findFirst({
      where: {
        OR: [
          { requesterId: user.id, addresseeId: target.id },
          { requesterId: target.id, addresseeId: user.id },
        ],
      },
    })

    if (existing) {
      // If they already asked us, treat this as accepting
      if (existing.status === 'pending' && existing.addresseeId === user.id) {
        await prisma.friendship.update({
          where: { id: existing.id },
          data: { status: 'accepted' },
        })
        return NextResponse.json({ data: { message: `You and ${target.name} are now friends.` } })
      }
      return vagueOk
    }

    await prisma.friendship.create({
      data: { requesterId: user.id, addresseeId: target.id, status: 'pending' },
    })
    await logAudit({ userId: user.id, action: 'friend_request', targetId: target.id })

    return vagueOk
  } catch (error) {
    console.error('Friend request error:', error)
    return NextResponse.json({ error: 'Failed to send request' }, { status: 500 })
  }
}

// Accept or decline a request addressed to the caller.
export async function PATCH(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id, action } = await request.json()
    if (!id || !['accept', 'decline'].includes(action)) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }

    const friendship = await prisma.friendship.findUnique({ where: { id } })
    if (!friendship || friendship.addresseeId !== user.id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    if (action === 'accept') {
      await prisma.friendship.update({ where: { id }, data: { status: 'accepted' } })
      await logAudit({ userId: user.id, action: 'friend_accept', targetId: friendship.requesterId })
    } else {
      await prisma.friendship.delete({ where: { id } })
    }

    return NextResponse.json({ data: { ok: true } })
  } catch (error) {
    console.error('Friend request update error:', error)
    return NextResponse.json({ error: 'Failed to update request' }, { status: 500 })
  }
}

// Remove a direct friendship (group-based connections can't be removed here —
// leaving the group is the way to end those).
export async function DELETE(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const friendId = new URL(request.url).searchParams.get('friendId')
    if (!friendId) {
      return NextResponse.json({ error: 'friendId required' }, { status: 400 })
    }

    await prisma.friendship.deleteMany({
      where: {
        OR: [
          { requesterId: user.id, addresseeId: friendId },
          { requesterId: friendId, addresseeId: user.id },
        ],
      },
    })

    return NextResponse.json({ data: { ok: true } })
  } catch (error) {
    console.error('Remove friend error:', error)
    return NextResponse.json({ error: 'Failed to remove friend' }, { status: 500 })
  }
}
