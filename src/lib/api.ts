// Tiny fetch wrapper for the app's JSON API. Throws with the server's error message.

export async function api<T = unknown>(
  url: string,
  opts: { method?: "GET" | "POST" | "PATCH" | "DELETE"; body?: unknown; keepalive?: boolean } = {},
): Promise<T> {
  const hasBody = opts.body !== undefined
  const res = await fetch(url, {
    method: opts.method ?? (hasBody ? "POST" : "GET"),
    headers: hasBody ? { "Content-Type": "application/json" } : undefined,
    body: hasBody ? JSON.stringify(opts.body) : undefined,
    keepalive: opts.keepalive,
  })
  if (!res.ok) {
    let message = `Something went wrong (${res.status})`
    try {
      const data = await res.json()
      if (data?.error) message = data.error
    } catch {}
    throw new Error(message)
  }
  return res.json() as Promise<T>
}
