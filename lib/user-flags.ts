export const USER_FLAGS = {
  ABSENT: "absent",
  SUSPECT: "suspect",
  FIDELE: "fidele",
  BANNI: "banni",
  VERIFIED: "verified",
} as const

export const USER_FLAGS_LIST = Object.values(USER_FLAGS)
export type UserFlag = (typeof USER_FLAGS)[keyof typeof USER_FLAGS]
