import type { D1Database, R2Bucket } from '@cloudflare/workers-types' // ← R2Bucketを追加

export type Bindings = {
  DB: D1Database
  clinic_stock_images: R2Bucket // ← ここを "clinic_stock_images" ではなく R2Bucket にします
}

export type Variables = {
  tenantId: string
}

export type AppEnv = {
  Bindings: Bindings
  Variables: Variables
}