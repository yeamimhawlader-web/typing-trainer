import { describe, expect, it } from 'vitest'

import { parseAccounts } from './accounts.ts'

/** The two values that switch accounts on, with nothing said about Google. */
const given = (url: string | undefined, ...keys: readonly (string | undefined)[]) =>
  parseAccounts({ url, keys, google: undefined })

describe('switching accounts on', () => {
  it('is off when neither value is given, and off is a normal way to run', () => {
    expect(given(undefined, undefined)).toBeNull()
    expect(given('', '   ')).toBeNull()
  })

  it('takes both values, trimmed', () => {
    expect(given(' https://project.supabase.co ', ' key ')).toEqual({
      url: 'https://project.supabase.co',
      anonKey: 'key',
      google: false,
    })
  })

  it('takes the key under either name Supabase has used for it', () => {
    // A project made now is given a publishable key; an older one has an anon
    // key. Whichever the dashboard showed is what someone will paste.
    expect(given('https://project.supabase.co', 'sb_publishable_abc', undefined)?.anonKey).toBe(
      'sb_publishable_abc',
    )
    expect(given('https://project.supabase.co', undefined, 'legacy-anon')?.anonKey).toBe('legacy-anon')
    expect(given('https://project.supabase.co', '', 'legacy-anon')?.anonKey).toBe('legacy-anon')
  })

  it('refuses half a configuration, at startup rather than at the first sign-in', () => {
    expect(() => given('https://project.supabase.co', undefined, undefined)).toThrow(/together/)
    expect(() => given(undefined, 'key')).toThrow(/together/)
  })

  it('refuses an address that is not https, since a token would travel over it', () => {
    expect(() => given('http://project.supabase.co', 'key')).toThrow(/https/)
  })
})

describe('whether Google is offered', () => {
  const withGoogle = (google: string | undefined) =>
    parseAccounts({ url: 'https://project.supabase.co', keys: ['key'], google })

  it('is off unless it plainly says otherwise', () => {
    // A project has no Google client until someone registers one, and offering
    // a way in that answers "provider is not enabled" is worse than not
    // offering it: it is the only door to an account, and it is a dead end.
    expect(withGoogle(undefined)?.google).toBe(false)
    expect(withGoogle('')?.google).toBe(false)
    expect(withGoogle('false')?.google).toBe(false)
    expect(withGoogle('0')?.google).toBe(false)
    expect(withGoogle('maybe')?.google).toBe(false)
  })

  it('is on for the words a deployment is likely to be given', () => {
    expect(withGoogle('true')?.google).toBe(true)
    expect(withGoogle(' TRUE ')?.google).toBe(true)
    expect(withGoogle('1')?.google).toBe(true)
    expect(withGoogle('on')?.google).toBe(true)
    expect(withGoogle('yes')?.google).toBe(true)
  })
})
