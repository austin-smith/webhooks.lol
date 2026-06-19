import { WebhookInspector } from "@/components/webhook-inspector/webhook-inspector"
import { readDocsUrl } from "@/lib/app-urls"

export default function Page() {
  return <WebhookInspector docsUrl={readDocsUrl()} />
}
