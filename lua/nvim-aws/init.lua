-- nvim-aws main module
local M = {}

local window = require("nvim-aws.window")

--- Setup function for plugin configuration
---@param opts? table Optional configuration table
function M.setup(opts)
  -- Future: merge opts with defaults
  M.config = opts or {}
end

--- Open the nvim-aws window
function M.open()
  window.open()
end

--- Close the nvim-aws window
function M.close()
  window.close()
end

return M
