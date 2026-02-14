import { generateHeader } from './index'

describe('generateHeader', () => {
  it('should generate a valid HMAC header', () => {
    const apiKey = 'test-api-key'
    const apiSecret = 'test-api-secret'
    const header = generateHeader(apiKey, apiSecret)

    expect(header).toContain('HMAC-SHA256')
    expect(header).toContain(`apiKey=${apiKey}`)
    expect(header).toContain('date=')
    expect(header).toContain('salt=')
    expect(header).toContain('signature=')
  })

  it('should generate different signatures for different calls', () => {
    const apiKey = 'test-api-key'
    const apiSecret = 'test-api-secret'
    const header1 = generateHeader(apiKey, apiSecret)
    const header2 = generateHeader(apiKey, apiSecret)

    expect(header1).not.toBe(header2)
  })
})
