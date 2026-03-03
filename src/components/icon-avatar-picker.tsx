'use client'

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { AVATAR_ICONS } from '@/lib/avatar-icons'

interface IconAvatarPickerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentIcon: string | null
  onSelect: (key: string | null) => void
}

export function IconAvatarPicker({ open, onOpenChange, currentIcon, onSelect }: IconAvatarPickerProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Choose Your Avatar</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-6 gap-2 py-4">
          {AVATAR_ICONS.map(icon => (
            <button
              key={icon.key}
              onClick={() => {
                onSelect(icon.key)
                onOpenChange(false)
              }}
              className={`flex items-center justify-center rounded-lg p-2 text-2xl transition-all cursor-pointer hover:bg-muted ${
                currentIcon === icon.key
                  ? 'ring-2 ring-primary bg-primary/10'
                  : ''
              }`}
              title={icon.label}
            >
              {icon.emoji}
            </button>
          ))}
        </div>
        {currentIcon && (
          <button
            onClick={() => {
              onSelect(null)
              onOpenChange(false)
            }}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            Remove avatar icon
          </button>
        )}
      </DialogContent>
    </Dialog>
  )
}
