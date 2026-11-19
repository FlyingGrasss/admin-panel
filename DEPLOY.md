# Deployment

Production assets: `Dockerfile`, `.dockerignore`, `docker-compose.yml`, and `scripts/start.sh`.

The image builds the Next.js app with pnpm, then runs two processes in one container as the non-root `node` user (UID 1000): the Express API on loopback `127.0.0.1:4400` and `next start -p 3000`. `scripts/start.sh` waits for `GET /api/health` before starting Next and forwards `SIGTERM`/`SIGINT` to both children. No secrets are baked into the image.

## Start

Create a `.env` next to `docker-compose.yml` (the existing `.env.example` is a starting point):

```bash
cat > .env <<'EOF'
ADMIN_PASSWORD=replace-with-a-strong-password
APP_ORIGINS=https://admin.example.com
TRUST_PROXY=1
EOF

docker compose up -d --build
docker compose logs -f app
```

Required environment variables:

| Variable | Purpose |
| --- | --- |
| `ADMIN_PASSWORD` | Panel administrator password. Required; the compose file refuses to start without it. |
| `APP_ORIGINS` | Comma-separated public origin(s), for example `https://admin.example.com`. Required in production. |
| `TRUST_PROXY` | Optional. Set `1` when exactly one trusted reverse proxy sits in front, so forwarded protocol/client IP are honored. |

Fixed inside the container: `API_PORT=4400`, `API_HOST=127.0.0.1`, and `NODE_ENV=production`.

## Ports and networking

- Published: `3000` (Next.js). The Express API on `4400` is not published and is reached by Next's `/api/*` rewrite.
- Health check: `GET http://127.0.0.1:4400/api/health` (compose healthcheck).
- Reverse proxy: terminate TLS in front of port 3000. A commented Caddy block is in `docker-compose.yml`.

## Data

`./data` is bind-mounted at `/app/data`; SQLite lives in `data/kavram.db` plus `-wal` and `-shm`. Back up all three together. On Linux, create the directory with UID 1000 ownership before the first start:

```bash
mkdir -p data && sudo chown -R 1000:1000 data
```

The image keeps full `node_modules` because `tsx` runs the API; this is larger than a production-only install but avoids a compile step at runtime. Stop with `docker compose down` (data survives).
