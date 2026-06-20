import type { ReactNode } from "react"
import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Tailwind,
  Text,
  pixelBasedPreset,
} from "react-email"

type EmailLayoutProps = {
  children: ReactNode
  heading: string
  preview: string
}

export function EmailLayout({ children, heading, preview }: EmailLayoutProps) {
  return (
    <Html lang="en">
      <Head />
      <Preview>{preview}</Preview>
      <Tailwind
        config={{
          presets: [pixelBasedPreset],
          theme: {
            extend: {
              colors: {
                accent: "#efe9ef",
                border: "#d3d1d7",
                brand: "#da047f",
                brandForeground: "#fcfcfc",
                ink: "#0d0d16",
                muted: "#575762",
                mutedPanel: "#f1f0f3",
                panel: "#fefeff",
                shell: "#fbfafc",
              },
              fontFamily: {
                mono: [
                  "SFMono-Regular",
                  "Consolas",
                  "Liberation Mono",
                  "Menlo",
                  "monospace",
                ],
                sans: [
                  "Inter",
                  "-apple-system",
                  "BlinkMacSystemFont",
                  "Segoe UI",
                  "Arial",
                  "sans-serif",
                ],
              },
            },
          },
        }}
      >
        <Body className="bg-panel text-ink m-0 px-0 py-0 font-sans">
          <Container className="mx-auto w-full max-w-[560px] px-6 py-6">
            <Section>
              <Text className="text-ink m-0 font-mono text-[14px] leading-5 font-semibold tracking-tight">
                WEBHOOKS<span className="text-brand">.LOL</span>
              </Text>
            </Section>
            <Hr className="my-5 border-0 border-t border-solid border-border" />
            <Heading className="text-ink m-0 pb-3 font-mono text-[24px] leading-8 font-semibold tracking-tight">
              {heading}
            </Heading>
            {children}
          </Container>
        </Body>
      </Tailwind>
    </Html>
  )
}

type EmailBodyTextProps = {
  children: ReactNode
  spacing?: "default" | "last"
}

export function EmailBodyText({
  children,
  spacing = "default",
}: EmailBodyTextProps) {
  const spacingClass = spacing === "last" ? "mb-0" : "mb-5"

  return (
    <Text
      className={`mt-0 mr-0 ml-0 font-sans text-[15px] leading-6 text-muted ${spacingClass}`}
    >
      {children}
    </Text>
  )
}

type PlainLinkProps = {
  href: string
}

export function PlainLink({ href }: PlainLinkProps) {
  return (
    <Text className="bg-mutedPanel mt-0 mr-0 mb-4 ml-0 rounded-[4px] px-3 py-2 font-mono text-[12px] leading-5 break-all text-muted">
      {href}
    </Text>
  )
}
