import "server-only"

import {
  sendTransactionalEmail,
  type TransactionalEmail,
} from "@/lib/email"

export async function sendAuthEmail(input: TransactionalEmail) {
  await sendTransactionalEmail(input)
}
