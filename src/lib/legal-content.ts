import { prisma } from '@/lib/db'

export type LegalContentType = 'legal_tos' | 'legal_about' | 'legal_privacy'

export type LegalContent = {
  html: string
  plainText: string
  updatedAt: string
}

export type ContactContent = {
  email: string
  phone: string
  companyName: string
  address: string
  businessHours: string
  updatedAt: string
}

export async function getLegalContent(key: LegalContentType): Promise<LegalContent | null> {
  const setting = await prisma.platformSetting.findUnique({
    where: { key },
  })

  if (!setting || !setting.value) {
    return null
  }

  try {
    return JSON.parse(setting.value) as LegalContent
  } catch {
    return null
  }
}

export async function getContactContent(): Promise<ContactContent | null> {
  const setting = await prisma.platformSetting.findUnique({
    where: { key: 'legal_contact' },
  })

  if (!setting || !setting.value) {
    return null
  }

  try {
    return JSON.parse(setting.value) as ContactContent
  } catch {
    return null
  }
}

export async function getAllLegalContent() {
  const settings = await prisma.platformSetting.findMany({
    where: {
      key: {
        in: ['legal_tos', 'legal_about', 'legal_privacy', 'legal_contact'],
      },
    },
  })

  const result: {
    tos: LegalContent | null
    about: LegalContent | null
    privacy: LegalContent | null
    contact: ContactContent | null
  } = {
    tos: null,
    about: null,
    privacy: null,
    contact: null,
  }

  for (const setting of settings) {
    try {
      const parsed = JSON.parse(setting.value)
      switch (setting.key) {
        case 'legal_tos':
          result.tos = parsed
          break
        case 'legal_about':
          result.about = parsed
          break
        case 'legal_privacy':
          result.privacy = parsed
          break
        case 'legal_contact':
          result.contact = parsed
          break
      }
    } catch {
      // Skip invalid JSON
    }
  }

  return result
}
