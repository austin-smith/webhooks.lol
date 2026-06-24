import { getUserDisplayName, UserAvatar } from "@/components/auth/user-avatar"

type AccountMenuIdentityUser = {
  email: string
  image?: string | null
  name: string
}

export function AccountMenuIdentity({
  user,
}: {
  user: AccountMenuIdentityUser
}) {
  return (
    <div className="flex min-w-0 flex-col items-center gap-2 rounded-md border bg-muted/40 px-3 py-3 text-center">
      <UserAvatar user={user} />
      <span className="min-w-0">
        <span className="block truncate text-xs font-medium text-foreground">
          {getUserDisplayName(user)}
        </span>
        <span className="block truncate text-[0.68rem] text-muted-foreground">
          {user.email}
        </span>
      </span>
    </div>
  )
}
