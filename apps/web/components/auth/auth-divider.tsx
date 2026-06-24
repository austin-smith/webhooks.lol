export function AuthDivider() {
  return (
    <div className="flex items-center gap-4" aria-hidden="true">
      <div className="h-px flex-1 bg-border" />
      <span className="text-[0.68rem] text-muted-foreground">or</span>
      <div className="h-px flex-1 bg-border" />
    </div>
  )
}
