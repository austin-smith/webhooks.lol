import "server-only"

import { sendOutboundEmail, type OutboundEmail } from "@/lib/email"

export async function sendEmail(input: OutboundEmail) {
  await sendOutboundEmail(input)
}
