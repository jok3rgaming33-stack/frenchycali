import {
  pgTable,
  serial,
  text,
  integer,
  doublePrecision,
  timestamp,
  boolean,
  jsonb,
  uniqueIndex,
} from "drizzle-orm/pg-core"

export type ProductVariant = { qty: number; price: number }
export type MediaAttachment = { type: "image" | "video"; url: string }
export type ProductMedia = MediaAttachment

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  token: text("token").notNull().unique(),
  pseudo: text("pseudo").notNull(),
  loyaltyAdjustment: integer("loyalty_adjustment").notNull().default(0),
  loyaltySpent: integer("loyalty_spent").notNull().default(0),
  flags: jsonb("flags").$type<string[]>().notNull().default([]),
  nickname: text("nickname"),
  tempPasswordHash: text("temp_password_hash"),
  tempPasswordExpires: timestamp("temp_password_expires", { withTimezone: true }),
  tempPasswordBlocked: boolean("temp_password_blocked").notNull().default(false),
  accessRestoreToken: text("access_restore_token"),
  accessRestoreExpires: timestamp("access_restore_expires", { withTimezone: true }),
  mustSetPassword: boolean("must_set_password").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
})

export const staffMembers = pgTable("staff_members", {
  id: serial("id").primaryKey(),
  pseudo: text("pseudo"),
  passwordHash: text("password_hash"),
  inviteToken: text("invite_token").notNull().unique(),
  canAdmin: boolean("can_admin").notNull().default(false),
  permissions: jsonb("permissions").$type<string[]>().notNull().default([]),
  inviteUsed: boolean("invite_used").notNull().default(false),
  active: boolean("active").notNull().default(true),
  customerToken: text("customer_token"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
})

export const webauthnCredentials = pgTable("webauthn_credentials", {
  id: serial("id").primaryKey(),
  userToken: text("user_token").notNull(),
  credentialId: text("credential_id").notNull().unique(),
  publicKey: text("public_key").notNull(),
  counter: integer("counter").notNull().default(0),
  transports: text("transports"),
  deviceLabel: text("device_label"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
})

export const webauthnChallenges = pgTable("webauthn_challenges", {
  id: text("id").primaryKey(),
  challenge: text("challenge").notNull(),
  userToken: text("user_token"),
  purpose: text("purpose").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
})

export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  section: text("section").notNull().default("featured"),
  // region: '31' | '94' | 'both' | 'delivery'
  region: text("region").notNull().default("both"),
  image: text("image"),
  media: jsonb("media").$type<ProductMedia[]>().notNull().default([]),
  symbol: text("symbol"),
  number: text("number"),
  description: text("description"),
  fullDescription: text("full_description"),
  stock: integer("stock").notNull().default(0),
  variants: jsonb("variants").$type<ProductVariant[]>().notNull().default([]),
  badges: jsonb("badges").$type<string[]>().notNull().default([]),
  discountType: text("discount_type"),
  discountValue: integer("discount_value"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
})

export const promoCodes = pgTable("promo_codes", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  type: text("type").notNull().default("fixed"),
  value: integer("value").notNull().default(0),
  productName: text("product_name"),
  minAmount: integer("min_amount").notNull().default(0),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
})

export const loyaltyCodes = pgTable("loyalty_codes", {
  id: serial("id").primaryKey(),
  userToken: text("user_token").notNull(),
  code: text("code").notNull().unique(),
  discount: integer("discount").notNull(),
  pointsCost: integer("points_cost").notNull(),
  minAmount: integer("min_amount").notNull().default(0),
  used: boolean("used").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
})

export const userVerifications = pgTable("user_verifications", {
  id: serial("id").primaryKey(),
  userToken: text("user_token").notNull().unique(),
  pseudo: text("pseudo"),
  photoPathname: text("photo_pathname"),
  videoPathname: text("video_pathname"),
  siteName: text("site_name"),
  recordedAt: text("recorded_at"),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  validatedAt: timestamp("validated_at", { withTimezone: true }),
})

export const reservedPseudos = pgTable("reserved_pseudos", {
  id: serial("id").primaryKey(),
  pseudo: text("pseudo").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
})

export const accountCreations = pgTable("account_creations", {
  id: serial("id").primaryKey(),
  ip: text("ip").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
})

export const orderThreads = pgTable("order_threads", {
  id: serial("id").primaryKey(),
  customerName: text("customer_name").notNull(),
  customerToken: text("customer_token"),
  trackingToken: text("tracking_token").notNull().unique(),
  summary: text("summary").notNull(),
  products: text("products"),
  total: integer("total").notNull().default(0),
  fulfillment: text("fulfillment").notNull().default("livraison"),
  address: text("address"),
  lat: doublePrecision("lat"),
  lng: doublePrecision("lng"),
  scheduledDate: text("scheduled_date"),
  scheduledSlot: text("scheduled_slot"),
  colissimoNumber: text("colissimo_number"),
  xmrWallet: text("xmr_wallet"),
  depositNotified: boolean("deposit_notified").notNull().default(false),
  depositConfirmed: boolean("deposit_confirmed").notNull().default(false),
  clientLastSeen: timestamp("client_last_seen", { withTimezone: true }),
  status: text("status").notNull().default("nouveau"),
  // shop: 'caliboyz31' | 'caliboyz94' | 'calidelivery'
  shop: text("shop").notNull().default("caliboyz31"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
})

export const threadMessages = pgTable("thread_messages", {
  id: serial("id").primaryKey(),
  threadId: integer("thread_id").notNull(),
  sender: text("sender").notNull(),
  body: text("body").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  clientReadAt: timestamp("client_read_at", { withTimezone: true }),
})

export const productBadges = pgTable("product_badges", {
  productKey: text("product_key").primaryKey(),
  badge: text("badge").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
})

export const pushSubscriptions = pgTable("push_subscriptions", {
  id: serial("id").primaryKey(),
  role: text("role").notNull().default("client"),
  customerToken: text("customer_token"),
  endpoint: text("endpoint").notNull().unique(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
})

export const news = pgTable("news", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  isActive: boolean("is_active").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
})

export const newsSlides = pgTable("news_slides", {
  id: serial("id").primaryKey(),
  newsId: integer("news_id").notNull(),
  order: integer("order").notNull().default(0),
  title: text("title"),
  content: text("content"),
  imageUrl: text("image_url"),
  media: jsonb("media").$type<MediaAttachment[]>().notNull().default([]),
  buttonText: text("button_text"),
  buttonLink: text("button_link"),
  promoCode: text("promo_code"),
  promoType: text("promo_type"),
  promoValue: integer("promo_value"),
  productName: text("product_name"),
  minAmount: integer("min_amount"),
  isSingleUse: boolean("is_single_use").notNull().default(true),
})

export const promoUsages = pgTable("promo_usages", {
  id: serial("id").primaryKey(),
  promoCode: text("promo_code").notNull(),
  userToken: text("user_token").notNull(),
  newsSlideId: integer("news_slide_id"),
  usedAt: timestamp("used_at", { withTimezone: true }).notNull().defaultNow(),
})

export const userNewsReads = pgTable(
  "user_news_reads",
  {
    id: serial("id").primaryKey(),
    userToken: text("user_token").notNull(),
    newsId: integer("news_id").notNull(),
    readAt: timestamp("read_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("user_news_reads_user_token_news_id_idx").on(t.userToken, t.newsId)],
)

export const adminAccounts = pgTable("admin_accounts", {
  id: serial("id").primaryKey(),
  pseudo: text("pseudo").notNull(),
  token: text("token").notNull().unique(),
  passwordHash: text("password_hash"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
})

export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  name: text("name").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
})

export const restockAlerts = pgTable("restock_alerts", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").notNull(),
  userToken: text("user_token").notNull(),
  notified: boolean("notified").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
})

export const appSettings = pgTable("app_settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").$type<Record<string, unknown>>().notNull().default({}),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
})

export const productCosts = pgTable("product_costs", {
  productId: integer("product_id").primaryKey(),
  costPrice: doublePrecision("cost_price").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
})

export const loginLogs = pgTable("login_logs", {
  id: serial("id").primaryKey(),
  userToken: text("user_token").notNull(),
  pseudo: text("pseudo").notNull(),
  ip: text("ip"),
  city: text("city"),
  country: text("country"),
  countryCode: text("country_code"),
  lat: doublePrecision("lat"),
  lng: doublePrecision("lng"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
})

export const broadcastNotifications = pgTable("broadcast_notifications", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  imageUrl: text("image_url"),
  media: jsonb("media").$type<MediaAttachment[]>().notNull().default([]),
  recipients: text("recipients").notNull().default("all"),
  sentCount: integer("sent_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
})

export const notificationReads = pgTable("notification_reads", {
  id: serial("id").primaryKey(),
  notificationId: integer("notification_id").notNull(),
  customerToken: text("customer_token").notNull(),
  readAt: timestamp("read_at", { withTimezone: true }).notNull().defaultNow(),
})

export const accountRecoveryClaims = pgTable("account_recovery_claims", {
  id: serial("id").primaryKey(),
  provisionalToken: text("provisional_token").notNull().unique(),
  claimedPseudo: text("claimed_pseudo").notNull(),
  originalUserId: integer("original_user_id"),
  threadId: integer("thread_id"),
  status: text("status").notNull().default("pending_kyc"),
  clientMessage: text("client_message"),
  adminNote: text("admin_note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
})

// Types
export type User = typeof users.$inferSelect
export type StaffMember = typeof staffMembers.$inferSelect
export type WebauthnCredential = typeof webauthnCredentials.$inferSelect
export type Product = typeof products.$inferSelect
export type PromoCode = typeof promoCodes.$inferSelect
export type LoyaltyCode = typeof loyaltyCodes.$inferSelect
export type UserVerification = typeof userVerifications.$inferSelect
export type ReservedPseudo = typeof reservedPseudos.$inferSelect
export type OrderThread = typeof orderThreads.$inferSelect
export type ThreadMessage = typeof threadMessages.$inferSelect
export type ProductBadge = typeof productBadges.$inferSelect
export type PushSubscription = typeof pushSubscriptions.$inferSelect
export type News = typeof news.$inferSelect
export type NewsSlide = typeof newsSlides.$inferSelect
export type PromoUsage = typeof promoUsages.$inferSelect
export type UserNewsRead = typeof userNewsReads.$inferSelect
export type AdminAccount = typeof adminAccounts.$inferSelect
export type Category = typeof categories.$inferSelect
export type RestockAlert = typeof restockAlerts.$inferSelect
export type AppSetting = typeof appSettings.$inferSelect
export type ProductCost = typeof productCosts.$inferSelect
export type LoginLog = typeof loginLogs.$inferSelect
export type BroadcastNotification = typeof broadcastNotifications.$inferSelect
export type NotificationRead = typeof notificationReads.$inferSelect
export type AccountRecoveryClaim = typeof accountRecoveryClaims.$inferSelect
