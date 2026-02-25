/**
 * Normalizes a list of names by trimming whitespace and filtering out empty values.
 */
export function normalizeNameList(names?: string[]): string[] {
  return (names || []).map((name) => name.trim()).filter(Boolean)
}

/**
 * Builds the data structure for creating event people (speakers, etc.).
 */
export function buildPeopleCreateData(speakerNames: string[], jobTitles: string[], organizations: string[]) {
  return speakerNames.map((name, index) => ({
    name,
    title: jobTitles[index] || null,
    sortOrder: index,
    socialLinks: {
      __kind: 'EVENT_PEOPLE',
      role: 'SPEAKER',
      ...(organizations[index] ? { organization: organizations[index] } : {}),
    },
  }))
}
