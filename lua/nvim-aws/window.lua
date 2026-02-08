-- nvim-aws window module
-- Handles creating and managing the plugin window

local M = {}

-- Store buffer and window handles
M.buf = nil
M.win = nil

--- Create a new buffer for the plugin
---@return number bufnr The buffer number
local function create_buffer()
  local buf = vim.api.nvim_create_buf(false, true) -- unlisted, scratch buffer

  -- Set buffer options
  vim.api.nvim_set_option_value("buftype", "nofile", { buf = buf })
  vim.api.nvim_set_option_value("bufhidden", "wipe", { buf = buf })
  vim.api.nvim_set_option_value("swapfile", false, { buf = buf })
  vim.api.nvim_set_option_value("modifiable", false, { buf = buf })

  -- Set buffer name
  vim.api.nvim_buf_set_name(buf, "nvim-aws")

  return buf
end

--- Set the buffer content
---@param buf number The buffer number
---@param lines string[] The lines to set
local function set_content(buf, lines)
  vim.api.nvim_set_option_value("modifiable", true, { buf = buf })
  vim.api.nvim_buf_set_lines(buf, 0, -1, false, lines)
  vim.api.nvim_set_option_value("modifiable", false, { buf = buf })
end

--- Open the plugin window
function M.open()
  -- If window already exists and is valid, focus it
  if M.win and vim.api.nvim_win_is_valid(M.win) then
    vim.api.nvim_set_current_win(M.win)
    return
  end

  -- Create buffer if needed
  if not M.buf or not vim.api.nvim_buf_is_valid(M.buf) then
    M.buf = create_buffer()
  end

  -- Open a vertical split on the left
  vim.cmd("topleft vsplit")
  M.win = vim.api.nvim_get_current_win()

  -- Set the buffer in the window
  vim.api.nvim_win_set_buf(M.win, M.buf)

  -- Set window options
  vim.api.nvim_set_option_value("number", false, { win = M.win })
  vim.api.nvim_set_option_value("relativenumber", false, { win = M.win })
  vim.api.nvim_set_option_value("wrap", false, { win = M.win })
  vim.api.nvim_set_option_value("cursorline", true, { win = M.win })
  vim.api.nvim_set_option_value("signcolumn", "no", { win = M.win })

  -- Set window width
  vim.api.nvim_win_set_width(M.win, 40)

  -- Set content
  set_content(M.buf, { "Hello" })

  -- Set up keymaps for the buffer
  vim.keymap.set("n", "q", function()
    M.close()
  end, { buffer = M.buf, noremap = true, silent = true, desc = "Close nvim-aws window" })
end

--- Close the plugin window
function M.close()
  if M.win and vim.api.nvim_win_is_valid(M.win) then
    vim.api.nvim_win_close(M.win, true)
  end
  M.win = nil
  M.buf = nil
end

return M
