import { prisma } from '@/lib/db'

/**
 * Get a platform setting by key, with an optional default value.
 */
export async function getPlatformSetting(
  key: string,
  defaultValue: string = ''
): Promise<string> {
  try {
    const setting = await prisma.platformSetting.findUnique({
      where: { key },
    })
    return setting?.value ?? defaultValue
  } catch {
    // Database unavailable (e.g., build time on OSC) — return default
    return defaultValue
  }
}

/**
 * Get multiple platform settings at once.
 * Returns a map of key -> value, with defaults for missing keys.
 */
export async function getPlatformSettings(
  keys: Record<string, string>
): Promise<Record<string, string>> {
  try {
    const settings = await prisma.platformSetting.findMany({
      where: { key: { in: Object.keys(keys) } },
    })

    const result: Record<string, string> = { ...keys }
    for (const setting of settings) {
      result[setting.key] = setting.value
    }
    return result
  } catch {
    // Database unavailable (e.g., build time on OSC) — return defaults
    return { ...keys }
  }
}

/**
 * Set a platform setting. Creates if it doesn't exist, updates if it does.
 */
export async function setPlatformSetting(
  key: string,
  value: string,
  type: string = 'string'
): Promise<void> {
  await prisma.platformSetting.upsert({
    where: { key },
    update: { value, type },
    create: { key, value, type },
  })
}
