import Image from 'next/image'

export function AmazonIcon({ className }: { className?: string }) {
  return (
    <Image
      src="/logos/amazon.png"
      alt="Amazon"
      width={20}
      height={20}
      className={className}
      unoptimized
    />
  )
}
