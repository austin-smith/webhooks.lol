import { docs } from "collections/server"
import { loader } from "fumadocs-core/source"

export const source = loader({
  baseUrl: "",
  source: docs.toFumadocsSource(),
  url(slugs) {
    return slugs.length === 0 ? "/" : `/${slugs.join("/")}`
  },
})
