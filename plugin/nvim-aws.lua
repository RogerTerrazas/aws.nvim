-- nvim-aws plugin initialization
-- This file is automatically loaded by Neovim

-- Prevent loading the plugin twice
if vim.g.loaded_nvim_aws then
	return
end
vim.g.loaded_nvim_aws = true

-- Create user command to open the plugin window
vim.api.nvim_create_user_command("NvimAws", function()
	require("nvim-aws").open()
end, { desc = "Open nvim-aws window" })
