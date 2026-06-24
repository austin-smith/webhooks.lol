import { Button, Section, Text } from "react-email"

type PrimaryEmailActionProps = {
  href: string
  label: string
}

export function PrimaryEmailAction({ href, label }: PrimaryEmailActionProps) {
  return (
    <>
      <Section className="mb-7">
        <Button
          className="text-brandForeground box-border rounded-[4px] bg-brand px-5 py-3 text-center font-sans text-[14px] leading-5 font-semibold no-underline"
          data-skip-in-text="true"
          href={href}
        >
          {label}
        </Button>
      </Section>
      <Text className="mt-0 mr-0 mb-2 ml-0 font-sans text-[15px] leading-6 text-muted">
        If the button does not work, copy and paste this link into your browser:
      </Text>
    </>
  )
}
