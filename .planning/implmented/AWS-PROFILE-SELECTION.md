# nvim-aws Roadmap

## Feature: AWS Account Management — Profile Switching

### Summary

Users can switch between named AWS profiles from `~/.aws/config` directly inside
Neovim. The selected profile determines which credentials and region are used for
all AWS SDK calls (DynamoDB and future services). Selection is session-scoped —
it resets when Neovim restarts.

### Requirements

#### Functional

| #   | Requirement                                                                    | Status |
| --- | ------------------------------------------------------------------------------ | ------ |
| F1  | Parse `~/.aws/config` and list all `[default]` / `[profile X]` sections        | Done   |
| F2  | Display profiles in a new buffer view (`nvim-aws-accounts`) with name + region | Done   |
| F3  | `<CR>` on a profile sets it as the active profile for the session              | Done   |
| F4  | All AWS SDK clients use the selected profile's credentials and region          | Done   |
| F5  | Active profile and region shown in buffer names across all views               | Done   |
| F6  | `:NvimAws route aws_accounts` opens the profile picker at any time             | Done   |
| F7  | `a` keybinding on the tables view opens the profile picker                     | Done   |
| F8  | No profile selected → default credential chain (zero regression)               | Done   |

#### Non-Functional

| #   | Requirement                                                     | Status |
| --- | --------------------------------------------------------------- | ------ |
| N1  | Profile selection is session-only — no file is written          | Done   |
| N2  | Profile parsing is pure Node.js (no `aws` CLI dependency)       | Done   |
| N3  | Follows existing layer architecture: accessor → view → commands | Done   |
| N4  | New tests achieve coverage parity with existing tests           | Done   |
| N5  | TypeScript strict mode passes cleanly                           | Done   |

### Architecture

```
src/
├── accessors/config/
│   ├── profiles.ts          # parseAwsConfig() → AwsProfile[]
│   └── profiles.test.ts     # 18 tests
├── session/
│   ├── index.ts             # get/set/clear ActiveProfile, createDynamoDBClient(), getBufferTitle()
│   └── index.test.ts        # 8 tests
└── views/accounts/
    ├── accounts.ts          # initializeAccountsView() + accountsViewEntry
    ├── accounts.test.ts     # 5 tests
    ├── commands.ts          # selectAccount(), initializeAccountsCommands()
    └── commands.test.ts     # 7 tests
```

### User Workflow

1. `:NvimAws route aws_accounts` (or press `a` on the tables view)
2. Buffer lists all profiles from `~/.aws/config`:
   ```
   ▶ default       us-east-1
     staging       eu-west-1
     production    us-west-2
   ```
3. Press `<CR>` on a profile → sets it active, navigates to DynamoDB tables
4. Buffer titles now show: `nvim-aws | DynamoDB Tables | staging | eu-west-1`
5. All AWS calls use the `staging` profile's credentials and `eu-west-1` region

### Keybindings

| View     | Key    | Action                              |
| -------- | ------ | ----------------------------------- |
| Accounts | `<CR>` | Select profile → navigate to tables |
| Accounts | `q`    | Go back (jump list)                 |
| Tables   | `a`    | Open profile switcher               |
