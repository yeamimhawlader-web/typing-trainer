import { describe, expect, it } from 'vitest'

import { parseAccounts } from './accounts.ts'

describe('switching accounts on', () => {
  it('is off when neither value is given, and off is a normal way to run', () => {
    expect(parseAccounts(undefined, undefined)).toBeNull()
    expect(parseAccounts('', '   ')).toBeNull()
  })

  it('takes both values, trimmed', () => {
    expect(parseAccounts(' https://project.supabase.co ', ' key ')).toEqual({
      url: 'https://project.supabase.co',
      anonKey: 'key',
    })
  })

  it('takes the key under either name Supabase has used for it', () => {
    // A project made now is given a publishable key; an older one has an anon
    // key. Whichever the dashboard showed is what someone will paste.
    expect(parseAccounts('https://project.supabase.co', 'sb_publishable_abc', undefined)?.anonKey).toBe(
      'sb_publishable_abc',
    )
    expect(parseAccounts('https://project.supabase.co', undefined, 'legacy-anon')?.anonKey).toBe('legacy-anon')
    expect(parseAccounts('https://project.supabase.co', '', 'legacy-anon')?.anonKey).toBe('legacy-anon')
  })

  it('refuses half a configuration, at startup rather than at the first sign-in', () => {
    expect(() => parseAccounts('https://project.supabase.co', undefined, undefined)).toThrow(/together/)
    expect(() => parseAccounts(undefined, 'key')).toThrow(/together/)
  })

  it('refuses an address that is not https, since a token would travel over it', () => {
    expect(() => parseAccounts('http://project.supabase.co', 'key')).toThrow(/https/)
  })
})
