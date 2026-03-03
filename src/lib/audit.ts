import { prisma } from '@/lib/prisma'

interface AuditEntry {
  userId?: string | null
  action: string
  targetId?: string | null
  details?: Record<string, unknown> | null
  ipAddress?: string | null
}

export async function logAudit({ userId, action, targetId, details, ipAddress }: AuditEntry) {
  try {
    await prisma.auditLog.create({
      data: {
        userId: userId || null,
        action,
        targetId: targetId || null,
        details: details ? JSON.stringify(details) : null,
        ipAddress: ipAddress || null,
      },
    })
  } catch (error) {
    // Audit logging should never block the main operation
    console.error('Audit log write failed:', error)
  }
}
