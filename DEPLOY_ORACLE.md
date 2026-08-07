# Oracle Cloud IP-Only Deployment (Docker + Caddy)

This guide deploys DLOG on one Oracle Cloud VM using:
- `backend` container (Node API)
- `caddy` container (serves frontend static files + reverse proxy)
- `docker-compose`

Target public IP in this setup: `92.5.68.152`

## 1. Oracle Cloud networking checklist

In Oracle Cloud (Security List or NSG), add **Ingress rules**:
- TCP `22` (SSH)
- TCP `80` (HTTP)

Use these values in the rule form:
- Source type: `CIDR`
- Source CIDR: `0.0.0.0/0` for port `80`
- Source CIDR: your public IP `/32` for port `22` if you want to restrict SSH
- Destination port range: `22` and `80`

If you attached an NSG to the VM, make sure the rule is added to that NSG. If you are using a Security List instead, make sure the subnet is using that list.

On the VM firewall (if enabled), allow:
- `22`
- `80`

## 2. Install Docker and Compose plugin on VM (Ubuntu)

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker $USER
newgrp docker
```

Validate:

```bash
docker --version
docker compose version
```

## 3. Pull project on VM

```bash
mkdir -p ~/apps
cd ~/apps

git clone https://github.com/jaxteller2016/DLOG-IT-Operations-Platform.git dlog
cd dlog
```

If already cloned:

```bash
cd ~/apps/dlog
git pull origin main
```

## 4. Create production env file

```bash
cp .env.production.example .env.production
```

Edit `.env.production` and set at least:
- `JWT_SECRET` to a long random value
- `FRONTEND_URL=http://92.5.68.152`

Example strong secret generation:

```bash
openssl rand -hex 48
```

## 5. Start the stack

```bash
docker compose up -d --build
```

Check status:

```bash
docker compose ps
```

View logs:

```bash
docker compose logs -f backend
docker compose logs -f caddy
```

## 6. Verify deployment

From your local machine/browser:
- App UI: `http://92.5.68.152`
- Backend health: `http://92.5.68.152/health`

Because the frontend is built with `VITE_API_URL=/api`, API calls are proxied by Caddy to backend and do not conflict with static `/assets/*` files.

If the browser times out on `http://92.5.68.152` while `docker compose ps` shows healthy containers, the problem is almost always Oracle ingress, not Docker. Recheck the NSG or Security List rules and ensure port `80` is open to `0.0.0.0/0`.

## 7. Update flow after new push

```bash
cd ~/apps/dlog
git pull origin main
docker compose up -d --build
```

## 8. Restart / stop

```bash
# restart
docker compose restart

# stop
docker compose down
```

## 9. Data persistence and backup

The SQLite database is persisted in Docker volume `dlog_backend_data`.

Create backup:

```bash
mkdir -p ~/backups

docker run --rm \
  -v dlog_dlog_backend_data:/from \
  -v ~/backups:/to \
  alpine sh -c "cd /from && tar -czf /to/dlog-backup-$(date +%F-%H%M).tar.gz ."
```

Restore (when needed):

```bash
docker compose down

docker run --rm \
  -v dlog_dlog_backend_data:/to \
  -v ~/backups:/from \
  alpine sh -c "cd /to && rm -rf ./* && tar -xzf /from/<backup-file>.tar.gz -C /to"

docker compose up -d
```

## 10. Notes

- This is IP-only over HTTP (no public TLS cert for raw IP).
- When you later add a domain, Caddy can be upgraded to automatic HTTPS with minimal config changes.
