import { describe, expect, it } from 'vitest'
import { signInSchema, signUpSchema } from './auth-validation'

describe('authentication validation', () => {
  it('accepts a valid sign-in', () => {
    expect(
      signInSchema.safeParse({
        email: 'person@example.com',
        password: 'password1',
      }).success,
    ).toBe(true)
  })

  it('rejects malformed email addresses', () => {
    expect(
      signInSchema.safeParse({ email: 'person', password: 'password1' })
        .success,
    ).toBe(false)
  })

  it('requires matching sign-up passwords', () => {
    const result = signUpSchema.safeParse({
      name: 'Example Person',
      email: 'person@example.com',
      password: 'password1',
      passwordConfirmation: 'password2',
    })
    expect(result.success).toBe(false)
  })
})
