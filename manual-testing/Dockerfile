FROM node:22

# Install Neovim (arm64 — change to nvim-linux64.tar.gz for x86-64)
RUN curl -LO https://github.com/neovim/neovim/releases/latest/download/nvim-linux-arm64.tar.gz \
    && tar -C /usr/local -xzf nvim-linux-arm64.tar.gz \
    && ln -sf /usr/local/nvim-linux-arm64/bin/nvim /usr/local/bin/nvim \
    && rm nvim-linux-arm64.tar.gz

# Install the Neovim Node.js provider globally
RUN npm install -g neovim

USER node

# Build the plugin from the mounted source
# Run as a separate step so the image layer is cached but the build
# always runs against the live bind-mounted files at container start.
CMD ["bash", "-c", "cd /home/node/aws.nvim && npm install && npm run build && bash"]
