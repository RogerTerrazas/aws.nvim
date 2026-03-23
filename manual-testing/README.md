# Manual Testing

A Docker environment for manually testing aws.nvim against local project files.
The plugin is loaded directly from the repo — no GitHub clone needed.

## Prerequisites

- Docker
- AWS credentials at `~/.aws/`

> **x86-64?** Edit `Dockerfile` and change `nvim-linux-arm64.tar.gz` to `nvim-linux64.tar.gz`.

## Usage

From the repo root, build the image once:

```bash
docker build -t aws-nvim-test manual-testing/
```

Then run the container with the repo and AWS credentials mounted:

```bash
docker run -it --rm \
  -v "$(pwd)":/home/node/aws.nvim \
  -v "$(pwd)/manual-testing/nvim":/home/node/.config/nvim \
  -v "$HOME/.aws":/home/node/.aws:ro \
  aws-nvim-test
```

This drops you into a shell where the plugin has been built. Launch Neovim:

```bash
nvim
```

On first launch, lazy.nvim will bootstrap itself. Once it finishes, **quit and
reopen Neovim** — the remote plugin manifest is registered automatically on
startup, so `:NvimAws` will be available on the second launch.

## Cleanup

The container is created with `--rm` so it is deleted automatically when you
exit the shell. To remove the image when you no longer need it:

```bash
docker rmi aws-nvim-test
```

## Iterating on changes

Edit source files on your host, then rebuild inside the container:

```bash
cd /home/node/aws.nvim && npm run build
```

Restart Neovim to pick up the changes.
