"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { PencilIcon, SaveIcon } from "lucide-react"

import { UserAvatar } from "@/components/auth/user-avatar"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { authClient } from "@/lib/auth/client"
import {
  MAX_USER_PROFILE_IMAGE_URL_LENGTH,
  MAX_USER_PROFILE_NAME_LENGTH,
  normalizeUserProfileUpdate,
  type UserProfileField,
  type UserProfileFieldErrors,
} from "@/lib/auth/user-profile-validation"

type AccountProfileUser = {
  email: string
  image?: string | null
  name: string
}

export function AccountProfileEditDialog({
  user,
}: {
  user: AccountProfileUser
}) {
  const router = useRouter()
  const [isOpen, setIsOpen] = React.useState(false)
  const [name, setName] = React.useState(user.name)
  const [image, setImage] = React.useState(user.image ?? "")
  const [fieldErrors, setFieldErrors] = React.useState<UserProfileFieldErrors>(
    {}
  )
  const [formError, setFormError] = React.useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const savedImage = user.image ?? ""
  const savedName = user.name
  const hasChanges = name !== savedName || image !== savedImage

  async function updateProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError(null)

    const validation = normalizeUserProfileUpdate({
      image,
      name,
    })

    if (!validation.ok) {
      setFieldErrors(validation.fieldErrors)
      setFormError(validation.formError)
      return
    }

    setFieldErrors({})
    setIsSubmitting(true)

    try {
      const result = await authClient.updateUser({
        image: validation.data.image ?? null,
        name: validation.data.name ?? name.trim(),
      })

      if (result.error) {
        setFormError(result.error.message ?? "Could not update profile.")
        return
      }

      setIsOpen(false)
      router.refresh()
    } finally {
      setIsSubmitting(false)
    }
  }

  function setDialogOpen(open: boolean) {
    if (isSubmitting) {
      return
    }

    setIsOpen(open)
    setFieldErrors({})
    setFormError(null)

    if (open) {
      setName(savedName)
      setImage(savedImage)
    }
  }

  function updateField(
    field: UserProfileField,
    value: string,
    setValue: (value: string) => void
  ) {
    setValue(value)
    setFormError(null)
    setFieldErrors((currentErrors) => {
      if (!currentErrors[field]) {
        return currentErrors
      }

      const remainingErrors = { ...currentErrors }
      delete remainingErrors[field]
      return remainingErrors
    })
  }

  return (
    <Dialog open={isOpen} onOpenChange={setDialogOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          aria-label="Edit profile"
        >
          <PencilIcon data-icon="inline-start" />
        </Button>
      </DialogTrigger>
      <DialogContent aria-describedby={undefined} className="sm:max-w-xs">
        <form
          className="flex flex-col gap-4"
          onSubmit={updateProfile}
          noValidate
        >
          <DialogHeader>
            <DialogTitle>Edit profile</DialogTitle>
          </DialogHeader>
          <div className="flex min-w-0 items-center gap-3">
            <UserAvatar
              user={{
                email: user.email,
                image: image.trim() || null,
                name,
              }}
              size="lg"
            />
            <div className="min-w-0">
              <p className="truncate text-sm">{name.trim() || user.email}</p>
              <p className="truncate text-[0.68rem] text-muted-foreground">
                {user.email}
              </p>
            </div>
          </div>
          <FieldGroup className="gap-3">
            <Field
              data-disabled={isSubmitting || undefined}
              data-invalid={Boolean(fieldErrors.name)}
            >
              <FieldLabel
                htmlFor="profile-name"
                className="text-[0.68rem] tracking-wide text-muted-foreground"
              >
                DISPLAY NAME
              </FieldLabel>
              <Input
                id="profile-name"
                aria-describedby={
                  fieldErrors.name ? "profile-name-error" : undefined
                }
                aria-invalid={Boolean(fieldErrors.name)}
                autoComplete="name"
                disabled={isSubmitting}
                maxLength={MAX_USER_PROFILE_NAME_LENGTH}
                onChange={(event) =>
                  updateField("name", event.target.value, setName)
                }
                value={name}
              />
              <FieldError id="profile-name-error">
                {fieldErrors.name}
              </FieldError>
            </Field>
            <Field
              data-disabled={isSubmitting || undefined}
              data-invalid={Boolean(fieldErrors.image)}
            >
              <FieldLabel
                htmlFor="profile-image"
                className="text-[0.68rem] tracking-wide text-muted-foreground"
              >
                AVATAR URL
              </FieldLabel>
              <Input
                id="profile-image"
                aria-describedby={
                  fieldErrors.image ? "profile-image-error" : undefined
                }
                aria-invalid={Boolean(fieldErrors.image)}
                autoComplete="url"
                disabled={isSubmitting}
                maxLength={MAX_USER_PROFILE_IMAGE_URL_LENGTH}
                onChange={(event) =>
                  updateField("image", event.target.value, setImage)
                }
                placeholder="https://example.com/avatar.jpg"
                type="url"
                value={image}
              />
              <FieldError id="profile-image-error">
                {fieldErrors.image}
              </FieldError>
            </Field>
          </FieldGroup>
          {formError ? (
            <p className="text-[0.68rem] text-destructive" role="alert">
              {formError}
            </p>
          ) : null}
          <DialogFooter>
            <DialogClose asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-sm text-xs"
                disabled={isSubmitting}
              >
                Cancel
              </Button>
            </DialogClose>
            <Button
              type="submit"
              size="sm"
              className="rounded-sm text-xs"
              disabled={isSubmitting || !hasChanges}
            >
              <SaveIcon data-icon="inline-start" />
              {isSubmitting ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
