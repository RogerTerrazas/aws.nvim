-- Bootstrap lazy.nvim
local lazypath = vim.fn.stdpath("data") .. "/lazy/lazy.nvim"
if not vim.loop.fs_stat(lazypath) then
	vim.fn.system({
		"git",
		"clone",
		"--filter=blob:none",
		"https://github.com/folke/lazy.nvim.git",
		"--branch=stable",
		lazypath,
	})
end
vim.opt.rtp:prepend(lazypath)

-- Setup plugins
-- Uses the local project files mounted at /home/node/aws.nvim instead of
-- pulling from GitHub, so any local changes are reflected immediately after
-- a rebuild (npm run build) — no re-clone needed.
require("lazy").setup({
	{
		dir = "/home/node/aws.nvim",
	},
})

-- Register the remote plugin manifest automatically on every startup so
-- :NvimAws is always available without a manual :UpdateRemotePlugins step.
vim.api.nvim_create_autocmd("VimEnter", {
	once = true,
	callback = function()
		vim.cmd("UpdateRemotePlugins")
	end,
})
