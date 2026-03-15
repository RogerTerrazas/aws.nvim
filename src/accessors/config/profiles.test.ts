import { describe, expect, it } from 'vitest'
import { parseAwsConfig, parseAwsConfigContent } from './profiles.js'

describe('parseAwsConfigContent', () => {
  describe('profile extraction', () => {
    it('should parse [default] section', () => {
      const content = `[default]
region = us-east-1
output = json`

      const result = parseAwsConfigContent(content)

      expect(result).toEqual([{ name: 'default', region: 'us-east-1' }])
    })

    it('should parse [profile name] sections', () => {
      const content = `[profile staging]
region = eu-west-1

[profile production]
region = us-west-2`

      const result = parseAwsConfigContent(content)

      expect(result).toEqual([
        { name: 'staging', region: 'eu-west-1' },
        { name: 'production', region: 'us-west-2' },
      ])
    })

    it('should parse both default and named profiles', () => {
      const content = `[default]
region = us-east-1

[profile staging]
region = eu-west-1

[profile production]
region = us-west-2`

      const result = parseAwsConfigContent(content)

      expect(result).toEqual([
        { name: 'default', region: 'us-east-1' },
        { name: 'staging', region: 'eu-west-1' },
        { name: 'production', region: 'us-west-2' },
      ])
    })

    it('should return profile without region when region is not set', () => {
      const content = `[profile no-region]
output = json`

      const result = parseAwsConfigContent(content)

      expect(result).toEqual([{ name: 'no-region' }])
    })
  })

  describe('section filtering', () => {
    it('should skip sso-session sections', () => {
      const content = `[default]
region = us-east-1

[sso-session my-sso]
sso_start_url = https://example.awsapps.com/start
sso_region = us-east-1

[profile staging]
region = eu-west-1`

      const result = parseAwsConfigContent(content)

      expect(result).toEqual([
        { name: 'default', region: 'us-east-1' },
        { name: 'staging', region: 'eu-west-1' },
      ])
    })

    it('should skip unknown section types', () => {
      const content = `[services my-service]
key = value

[default]
region = us-east-1`

      const result = parseAwsConfigContent(content)

      expect(result).toEqual([{ name: 'default', region: 'us-east-1' }])
    })
  })

  describe('whitespace and comments', () => {
    it('should skip comment lines starting with #', () => {
      const content = `# This is a comment
[default]
# Another comment
region = us-east-1`

      const result = parseAwsConfigContent(content)

      expect(result).toEqual([{ name: 'default', region: 'us-east-1' }])
    })

    it('should skip comment lines starting with ;', () => {
      const content = `; This is a comment
[default]
; Another comment
region = us-east-1`

      const result = parseAwsConfigContent(content)

      expect(result).toEqual([{ name: 'default', region: 'us-east-1' }])
    })

    it('should skip empty lines', () => {
      const content = `

[default]

region = us-east-1

`

      const result = parseAwsConfigContent(content)

      expect(result).toEqual([{ name: 'default', region: 'us-east-1' }])
    })

    it('should handle whitespace around section headers', () => {
      const content = `  [default]
region = us-east-1

  [profile staging]
region = eu-west-1`

      const result = parseAwsConfigContent(content)

      expect(result).toEqual([
        { name: 'default', region: 'us-east-1' },
        { name: 'staging', region: 'eu-west-1' },
      ])
    })

    it('should handle whitespace around key-value pairs', () => {
      const content = `[default]
  region   =   us-east-1  `

      const result = parseAwsConfigContent(content)

      expect(result).toEqual([{ name: 'default', region: 'us-east-1' }])
    })
  })

  describe('edge cases', () => {
    it('should return empty array for empty content', () => {
      const result = parseAwsConfigContent('')

      expect(result).toEqual([])
    })

    it('should return empty array for content with only comments', () => {
      const content = `# Just a comment
; Another comment`

      const result = parseAwsConfigContent(content)

      expect(result).toEqual([])
    })

    it('should skip [profile ] with empty name', () => {
      const content = `[profile ]
region = us-east-1

[default]
region = us-west-2`

      const result = parseAwsConfigContent(content)

      expect(result).toEqual([{ name: 'default', region: 'us-west-2' }])
    })

    it('should handle profile names with hyphens', () => {
      const content = `[profile my-company-staging]
region = eu-west-1`

      const result = parseAwsConfigContent(content)

      expect(result).toEqual([
        { name: 'my-company-staging', region: 'eu-west-1' },
      ])
    })

    it('should only capture region from known keys', () => {
      const content = `[default]
region = us-east-1
output = json
aws_access_key_id = AKIA...
cli_pager = `

      const result = parseAwsConfigContent(content)

      expect(result).toEqual([{ name: 'default', region: 'us-east-1' }])
    })

    it('should handle a real-world config file', () => {
      const content = `# AWS config file
[default]
region = us-east-1
output = json

[profile dev]
region = us-east-1
output = json

[profile staging]
region = eu-west-1
role_arn = arn:aws:iam::123456789012:role/StagingRole
source_profile = dev

[sso-session my-sso]
sso_start_url = https://d-abc123.awsapps.com/start
sso_region = us-east-1
sso_registration_scopes = sso:account:access

[profile sso-user]
sso_session = my-sso
sso_account_id = 123456789012
sso_role_name = ReadOnly
region = ap-southeast-1`

      const result = parseAwsConfigContent(content)

      expect(result).toEqual([
        { name: 'default', region: 'us-east-1' },
        { name: 'dev', region: 'us-east-1' },
        { name: 'staging', region: 'eu-west-1' },
        { name: 'sso-user', region: 'ap-southeast-1' },
      ])
    })
  })
})

describe('parseAwsConfig', () => {
  it('should return empty array when config file does not exist', async () => {
    const result = await parseAwsConfig('/nonexistent/path/.aws/config')

    expect(result).toEqual([])
  })
})
