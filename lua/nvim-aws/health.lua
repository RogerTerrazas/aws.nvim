-- Health check for aws.nvim
-- Run with :checkhealth aws

local M = {}

-- Resolve the plugin's root directory regardless of how it was installed.
-- The health file lives at <root>/lua/nvim-aws/health.lua, so walk two levels up.
local function plugin_root()
  local this_file = debug.getinfo(1, 'S').source:sub(2) -- strip leading '@'
  -- <root>/lua/nvim-aws/health.lua  →  <root>
  return vim.fn.fnamemodify(this_file, ':h:h:h')
end

local function check_executable(name)
  if vim.fn.executable(name) == 1 then
    local version = vim.fn.system(name .. ' --version'):gsub('\n', '')
    vim.health.ok(('`%s` found: %s'):format(name, version))

    if name == 'node' then
      local major = tonumber(version:match('v(%d+)'))
      if major == nil or major < 20 then
        vim.health.error(
          ('Node.js >= 20 is required, but found: %s'):format(version),
          'Upgrade Node.js to v20 or later (https://nodejs.org).'
            .. ' If you use a version manager (nvm, fnm, volta),'
            .. ' run `nvm install 20` (or equivalent) and ensure the correct'
            .. ' version is active when Neovim starts.'
        )
        return false
      end
    end

    return true
  else
    vim.health.error(
      ('`%s` not found on $PATH'):format(name),
      ('Install Node.js >= 20 (https://nodejs.org) and ensure `%s` is available in the'):format(name)
        .. ' PATH that Neovim uses. If you use a version manager (nvm, fnm, volta),'
        .. ' initialise it in your shell rc file (e.g. ~/.zshrc) rather than an'
        .. ' interactive-only file.'
    )
    return false
  end
end

local function check_dist(root)
  local dist = root .. '/dist/index.js'
  if vim.fn.filereadable(dist) == 1 then
    vim.health.ok('`dist/index.js` exists (plugin has been built)')
    return true
  else
    vim.health.error(
      '`dist/index.js` not found — the plugin has not been built',
      'Run the following in the plugin directory:\n'
        .. '  npm install -g neovim\n'
        .. '  npm install && npm run build\n'
        .. 'Then run :UpdateRemotePlugins and restart Neovim.'
    )
    return false
  end
end

local function check_node_modules(root)
  local pkg = root .. '/node_modules/neovim/package.json'
  if vim.fn.filereadable(pkg) == 1 then
    vim.health.ok('`neovim` npm package found in node_modules/')
    return true
  else
    vim.health.warn(
      '`neovim` npm package not found in node_modules/',
      'Run the following in the plugin directory:\n'
        .. '  cd ' .. root .. ' && npm install -g neovim && npm install\n'
        .. 'Then restart Neovim.'
    )
    return false
  end
end

local function check_rplugin_manifest()
  -- The manifest file registers the NvimAws command.
  local manifest = vim.fn.stdpath('data') .. '/rplugin.vim'
  if vim.fn.filereadable(manifest) == 1 then
    local content = vim.fn.readfile(manifest)
    for _, line in ipairs(content) do
      if line:find('nvim%-aws') or line:find('NvimAws') then
        vim.health.ok('`NvimAws` command found in remote-plugin manifest')
        return true
      end
    end
    vim.health.warn(
      '`NvimAws` command not found in remote-plugin manifest',
      'Run :UpdateRemotePlugins and restart Neovim.\n'
        .. 'If this is a first install, a restart is required for the manifest to take effect.'
    )
  else
    vim.health.warn(
      'Remote-plugin manifest not found',
      'Run :UpdateRemotePlugins and restart Neovim.\n'
        .. 'If this is a first install, a restart is required for the manifest to take effect.'
    )
  end
  return false
end

function M.check()
  vim.health.start('aws.nvim')

  local root = plugin_root()
  vim.health.info('Plugin root: ' .. root)

  -- 1. Node.js
  vim.health.start('Node.js')
  local has_node = check_executable('node')

  -- 2. npm
  vim.health.start('npm')
  check_executable('npm')

  -- 3. Build output
  vim.health.start('Build')
  check_dist(root)

  -- 4. neovim npm package
  vim.health.start('Dependencies')
  check_node_modules(root)

  -- 5. Remote plugin manifest
  vim.health.start('Remote plugin registration')
  check_rplugin_manifest()

  -- 6. AWS credentials hint (non-blocking)
  vim.health.start('AWS credentials')
  if has_node and vim.fn.executable('aws') == 1 then
    vim.health.ok('AWS CLI found — credentials can be verified with `aws sts get-caller-identity`')
  elseif vim.fn.filereadable(vim.fn.expand('~/.aws/config')) == 1 then
    vim.health.ok('`~/.aws/config` found')
  else
    vim.health.warn(
      '`~/.aws/config` not found',
      'Configure AWS credentials with `aws configure` or by creating ~/.aws/config manually.'
    )
  end
end

return M
