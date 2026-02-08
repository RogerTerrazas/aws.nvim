/**
 * Chat Context Filter Plugin
 * 
 * This plugin filters out working directory and worktree context from messages
 * when the agent name is "chat". This prevents sensitive path information from
 * being exposed to the AI model during chat sessions.
 * 
 * Filtering targets:
 * 1. System environment prompt: "Working directory: /path/to/dir"
 * 2. Bash tool descriptions: References to Instance.directory
 * 3. Tool parameter descriptions: Default working directory paths
 */

import type { Plugin, PluginInput, Hooks, Message } from "@opencode-ai/plugin"

export default async function createChatContextFilter(input: PluginInput): Promise<Hooks> {
  const { client, directory, worktree } = input

  /**
   * Helper function to determine if filtering should be applied
   * based on the agent name from the messages
   */
  function shouldFilterForChatAgent(messages: { info: Message; parts: any[] }[]): boolean {
    // Find the most recent user message to get the agent name
    for (let i = messages.length - 1; i >= 0; i--) {
      const message = messages[i]
      if (message.info.role === "user") {
        return message.info.agent === "chat"
      }
    }
    // Default to not filtering if we can't determine the agent
    return false
  }

  /**
   * Helper function to filter directory paths from text
   */
  function filterDirectoryPaths(text: string): string {
    return text
      // Filter exact working directory paths
      .replaceAll(directory, "[FILTERED_DIRECTORY]")
      .replaceAll(worktree, "[FILTERED_WORKTREE]")
      // Filter generic "Working directory:" declarations
      .replace(/Working directory:\s*[^\n]+/g, "Working directory: [FILTERED]")
      // Filter bash tool default directory mentions
      .replace(/All commands run in [^\s]+ by default/g, "All commands run in [FILTERED_DIRECTORY] by default")
      .replace(/Defaults to ([^\s.]+)\./g, (match, path) => {
        // Only replace if it looks like a path (contains / or is absolute)
        if (path.includes("/") || path.startsWith("~")) {
          return "Defaults to [FILTERED_DIRECTORY]."
        }
        return match
      })
      // Filter workdir parameter descriptions
      .replace(
        /The working directory to run the command in\. Defaults to [^.]+\./g,
        "The working directory to run the command in. Defaults to [FILTERED_DIRECTORY]."
      )
  }

  return {
    /**
     * Hook: Transform system prompt to remove working directory context
     * 
     * This hook filters the system prompt array before it's sent to the AI model.
     * We can't directly check the agent here, so we apply a conservative approach:
     * filter if it looks like a chat session based on the sessionID pattern or
     * other heuristics.
     */
    "experimental.chat.system.transform": async (hookInput, hookOutput) => {
      const { sessionID } = hookInput
      const { system } = hookOutput

      // Note: We don't have direct access to the agent name in this hook,
      // so we'll apply filtering based on session lookup if needed
      // For now, we'll filter conservatively - this can be refined with session state lookup
      
      // Check if this is a chat session by attempting to identify the agent
      // This is a simplified approach - in production you might want to:
      // 1. Store agent info in a session cache
      // 2. Query the client for session details
      // 3. Use a more sophisticated detection mechanism
      
      // For this implementation, we'll apply filtering to the system prompt
      // The messages.transform hook below will handle agent-specific filtering
      for (let i = 0; i < system.length; i++) {
        // Store original to compare later
        const original = system[i]
        const filtered = filterDirectoryPaths(original)
        
        // Only update if there was a change
        if (filtered !== original) {
          system[i] = filtered
        }
      }
    },

    /**
     * Hook: Transform messages to remove working directory context
     * 
     * This hook processes all messages before they're sent to the AI model.
     * It checks if the current agent is "chat" and filters directory paths
     * from all text parts if so.
     */
    "experimental.chat.messages.transform": async (hookInput, hookOutput) => {
      const { messages } = hookOutput

      // Determine if we should filter based on agent name
      if (!shouldFilterForChatAgent(messages)) {
        return
      }

      // Apply filtering to all messages
      for (const message of messages) {
        for (const part of message.parts) {
          // Filter text parts
          if (part.type === "text" && part.text) {
            const original = part.text
            const filtered = filterDirectoryPaths(original)
            
            if (filtered !== original) {
              part.text = filtered
            }
          }

          // Filter reasoning parts (if they expose directory paths)
          if (part.type === "reasoning" && part.text) {
            const original = part.text
            const filtered = filterDirectoryPaths(original)
            
            if (filtered !== original) {
              part.text = filtered
            }
          }

          // Filter file parts that might contain directory paths
          if (part.type === "file") {
            // Filter filename if it contains absolute paths
            if (part.filename) {
              const original = part.filename
              const filtered = filterDirectoryPaths(original)
              
              if (filtered !== original) {
                part.filename = filtered
              }
            }

            // Filter URL if it contains file:// paths
            if (part.url && part.url.startsWith("file://")) {
              const original = part.url
              const filtered = filterDirectoryPaths(original)
              
              if (filtered !== original) {
                part.url = filtered
              }
            }
          }

          // Filter tool invocations that might expose directory paths
          if (part.type === "tool") {
            // Filter tool arguments that might contain paths
            if (part.args && typeof part.args === "object") {
              // Handle bash tool workdir parameter specifically
              if (part.toolName === "bash" && part.args.workdir) {
                const original = part.args.workdir
                const filtered = filterDirectoryPaths(original)
                
                if (filtered !== original) {
                  part.args.workdir = filtered
                }
              }

              // Filter any string argument that looks like a path
              for (const [key, value] of Object.entries(part.args)) {
                if (typeof value === "string") {
                  const filtered = filterDirectoryPaths(value)
                  if (filtered !== value) {
                    part.args[key] = filtered
                  }
                }
              }
            }

            // Filter tool output that might contain directory paths
            if (part.output && typeof part.output === "string") {
              const original = part.output
              const filtered = filterDirectoryPaths(original)
              
              if (filtered !== original) {
                part.output = filtered
              }
            }
          }
        }
      }
    },
  }
}
