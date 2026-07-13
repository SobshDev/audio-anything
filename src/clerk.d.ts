export {}

declare global {
  interface CustomJwtSessionClaims {
    metadata?: {
      role?: "admin"
    }
  }

  interface UserPublicMetadata {
    role?: "admin"
  }
}
