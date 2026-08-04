export const USER_FLAGS = ["absent", "suspect", "fidele", "banni"] as const
export type UserFlag = (typeof USER_FLAGS)[number]
