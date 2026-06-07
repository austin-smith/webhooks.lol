import { WebhookInspector } from "@/components/webhook-inspector/webhook-inspector"
import { readDocsUrl } from "@/lib/docs-url"

export default function Page() {
  return <WebhookInspector docsUrl={readDocsUrl()} />
}
