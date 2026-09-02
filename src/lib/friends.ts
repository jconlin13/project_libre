import { prisma } from '@/lib/prisma'
import { toMemberSummary, type MemberSummary } from '@/lib/group-data'

/**
 * A friend is anyone you share a group with, plus anyone you've connected with
 * directly through an accepted friend request. Each friend carries the groups
 * you have in common so the UI can organize by group, and a flag for people
 * who are only a direct connection.
 */
export interface Friend extends MemberSummary {
  sharedGroups: Array<{ id: string; name: string }>
  isDirect: boolean
}

export interface GroupWithFriends {
  id: string
  name: string
  friends: Friend[]
}

export async function getFriendGraph(userId: string): Promise<{
  groups: GroupWithFriends[]
  directOnly: Friend[]
  all: Friend[]
}> {
  const memberships = await prisma.householdMember.findMany({
    where: { userId },
    include: { household: { include: { members: { include: { user: true } } } } },
  })

  const friendById = new Map<string, Friend>()
  const groups: GroupWithFriends[] = []

  for (const m of memberships) {
    const groupRef = { id: m.household.id, name: m.household.name }
    const groupFriends: Friend[] = []

    for (const hm of m.household.members) {
      if (hm.userId === userId) continue

      let friend = friendById.get(hm.userId)
      if (!friend) {
        friend = { ...toMemberSummary(hm.user), sharedGroups: [], isDirect: false }
        friendById.set(hm.userId, friend)
      }
      if (!friend.sharedGroups.some(g => g.id === groupRef.id)) {
        friend.sharedGroups.push(groupRef)
      }
      groupFriends.push(friend)
    }

    groups.push({ ...groupRef, friends: groupFriends })
  }

  // Accepted direct friendships, in either direction
  const accepted = await prisma.friendship.findMany({
    where: {
      status: 'accepted',
      OR: [{ requesterId: userId }, { addresseeId: userId }],
    },
    include: { requester: true, addressee: true },
  })

  const directOnly: Friend[] = []
  for (const f of accepted) {
    const other = f.requesterId === userId ? f.addressee : f.requester
    const existing = friendById.get(other.id)
    if (existing) {
      // Already a group co-member; note that they're also a direct friend
      existing.isDirect = true
      continue
    }
    const friend: Friend = { ...toMemberSummary(other), sharedGroups: [], isDirect: true }
    friendById.set(other.id, friend)
    directOnly.push(friend)
  }

  return { groups, directOnly, all: [...friendById.values()] }
}

/** Pending requests addressed to the user, and ones they've sent. */
export async function getPendingRequests(userId: string) {
  const [incoming, outgoing] = await Promise.all([
    prisma.friendship.findMany({
      where: { addresseeId: userId, status: 'pending' },
      include: { requester: true },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.friendship.findMany({
      where: { requesterId: userId, status: 'pending' },
      include: { addressee: true },
      orderBy: { createdAt: 'desc' },
    }),
  ])

  return {
    incoming: incoming.map(f => ({ id: f.id, user: toMemberSummary(f.requester), createdAt: f.createdAt })),
    outgoing: outgoing.map(f => ({ id: f.id, user: toMemberSummary(f.addressee), createdAt: f.createdAt })),
  }
}

/** True when the two users share a group or have an accepted friendship. */
export async function areConnected(userId: string, otherId: string): Promise<boolean> {
  const { all } = await getFriendGraph(userId)
  return all.some(f => f.id === otherId)
}
