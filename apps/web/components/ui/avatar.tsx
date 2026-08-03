"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

function Avatar({
  className,
  size = "default",
  ...props
}: React.ComponentProps<"span"> & {
  size?: "default" | "sm" | "lg"
}) {
  return (
    <span
      data-slot="avatar"
      data-size={size}
      className={cn(
        "group/avatar relative flex size-8 shrink-0 rounded-full select-none after:absolute after:inset-0 after:rounded-full after:border after:border-border after:mix-blend-darken data-[size=lg]:size-10 data-[size=sm]:size-6 dark:after:mix-blend-lighten",
        className
      )}
      {...props}
    />
  )
}

// Render the image in the server HTML so cached avatars do not flash the
// fallback before hydration.
function AvatarImage({
  alt,
  className,
  onError,
  onLoad,
  src,
  ...props
}: Omit<React.ComponentProps<"img">, "ref"> & { alt: string }) {
  const imageRef = React.useRef<HTMLImageElement>(null)
  const [status, setStatus] = React.useState<"loading" | "loaded" | "error">(
    "loading"
  )
  const [prevSrc, setPrevSrc] = React.useState(src)

  // Reset when the image source changes in place.
  if (prevSrc !== src) {
    setPrevSrc(src)
    setStatus("loading")
  }

  // A cached image may load before hydration and miss onLoad.
  React.useEffect(() => {
    const image = imageRef.current

    if (image?.complete && status === "loading") {
      setStatus(image.naturalWidth > 0 ? "loaded" : "error")
    }
  }, [status])

  return (
    // OAuth avatars are small external images; optimization adds a proxy hop
    // and requires configuration for each remote host.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      alt={alt}
      src={src}
      ref={imageRef}
      data-slot="avatar-image"
      data-status={status}
      onLoad={(event) => {
        setStatus("loaded")
        onLoad?.(event)
      }}
      onError={(event) => {
        setStatus("error")
        onError?.(event)
      }}
      className={cn(
        "peer/avatar-image absolute inset-0 aspect-square size-full rounded-full object-cover",
        status === "error" && "hidden",
        className
      )}
      {...props}
    />
  )
}

function AvatarFallback({
  className,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="avatar-fallback"
      className={cn(
        "flex size-full items-center justify-center rounded-full bg-muted text-sm text-muted-foreground group-data-[size=sm]/avatar:text-xs peer-data-[status=loaded]/avatar-image:invisible",
        className
      )}
      {...props}
    />
  )
}

function AvatarBadge({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="avatar-badge"
      className={cn(
        "absolute right-0 bottom-0 z-10 inline-flex items-center justify-center rounded-full bg-primary text-primary-foreground bg-blend-color ring-2 ring-background select-none",
        "group-data-[size=sm]/avatar:size-2 group-data-[size=sm]/avatar:[&>svg]:hidden",
        "group-data-[size=default]/avatar:size-2.5 group-data-[size=default]/avatar:[&>svg]:size-2",
        "group-data-[size=lg]/avatar:size-3 group-data-[size=lg]/avatar:[&>svg]:size-2",
        className
      )}
      {...props}
    />
  )
}

function AvatarGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="avatar-group"
      className={cn(
        "group/avatar-group flex -space-x-2 *:data-[slot=avatar]:ring-2 *:data-[slot=avatar]:ring-background",
        className
      )}
      {...props}
    />
  )
}

function AvatarGroupCount({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="avatar-group-count"
      className={cn(
        "relative flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-sm text-muted-foreground ring-2 ring-background group-has-data-[size=lg]/avatar-group:size-10 group-has-data-[size=sm]/avatar-group:size-6 [&>svg]:size-4 group-has-data-[size=lg]/avatar-group:[&>svg]:size-5 group-has-data-[size=sm]/avatar-group:[&>svg]:size-3",
        className
      )}
      {...props}
    />
  )
}

export {
  Avatar,
  AvatarImage,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
  AvatarBadge,
}
