import { ICON_SPRITE_HREF } from "@/generated/icon-sprite"
import { cn } from "@/lib/utils"

interface SpriteIconProps {
  name: string
  size?: number
  className?: string
}

export function SpriteIcon({ name, size = 20, className }: SpriteIconProps) {
  return (
    <svg
      width={size}
      height={size}
      aria-hidden="true"
      fill="currentColor"
      className={cn("text-current", className)}
    >
      <use href={`${ICON_SPRITE_HREF}#${name}`} />
    </svg>
  )
}
