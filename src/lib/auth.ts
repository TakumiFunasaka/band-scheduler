const JWT_KEY_PREFIX = 'bs_jwt_'

export function saveJwt(slug: string, jwt: string) {
  sessionStorage.setItem(JWT_KEY_PREFIX + slug, jwt)
  sessionStorage.setItem('bs_current_slug', slug)
}

export function getJwt(): string | null {
  const slug = sessionStorage.getItem('bs_current_slug')
  if (!slug) return null
  return sessionStorage.getItem(JWT_KEY_PREFIX + slug)
}

export function getJwtForSlug(slug: string): string | null {
  return sessionStorage.getItem(JWT_KEY_PREFIX + slug)
}

export function setCurrentSlug(slug: string) {
  sessionStorage.setItem('bs_current_slug', slug)
}

export function clearJwt(slug: string) {
  sessionStorage.removeItem(JWT_KEY_PREFIX + slug)
}

export function decodeJwtPayload<T = Record<string, unknown>>(jwt: string): T | null {
  try {
    const [, payload] = jwt.split('.')
    return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/'))) as T
  } catch {
    return null
  }
}

export function jwtExpired(jwt: string): boolean {
  const p = decodeJwtPayload<{ exp?: number }>(jwt)
  if (!p?.exp) return false
  return Date.now() / 1000 > p.exp
}
