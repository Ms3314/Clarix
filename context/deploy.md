# Deploying Clarix on an Oracle Cloud VM

One small VM runs two containers with Docker Compose:

```
 Browser ──HTTPS──> Caddy  (container "web", ports 80/443)
                     ├─ /        -> built React SPA (static files in the image)
                     └─ /api/*   -> strip /api -> FastAPI (container "backend", :8000, not public)
                                     ├─> Postgres        (Supabase, hosted)
                                     ├─> Supabase Storage (PDFs, images)
                                     ├─> Chroma Cloud     (vectors, one collection per classroom)
                                     ├─> OpenRouter       (chat, quiz and question-paper LLM)
                                     ├─> OpenAI           (embeddings)
                                     └─> Tesseract/poppler (OCR, inside the backend image)
```

The "RAG service" is not a separate process: `backend/rag_service.py` runs inside the FastAPI app.
Everything heavy (LLM, embeddings, vectors, DB) is hosted, so the VM only runs Python, OCR and Caddy.
SPA and API share one origin, so the browser sees no CORS and the `clarix_token` cookie is `Secure`.

Files: `docker-compose.yml`, `backend/Dockerfile`, `frontend/Dockerfile`, `deploy/Caddyfile`,
`deploy/.env.example`, `backend/requirements-prod.txt`, `backend/llm.py` (provider switch).

## Sizing

Measured in a test run: the backend idles at about 75 MB, the Caddy container at about 15 MB, and the
backend image is about 1.3 GB. Uploading a PDF holds rendered page images in memory while it OCRs, so
memory peaks during uploads.

| Oracle shape | Works? | Notes |
| --- | --- | --- |
| Ampere A1 (Always Free, up to 4 OCPU / 24 GB, arm64) | Yes, recommended | Set `BACKEND_MEM_LIMIT=2g`. All images are multi-arch. |
| VM.Standard.E2.1.Micro (Always Free, 1 GB, x86) | Yes, tight | Add 2-4 GB swap **before** building (step 3). Keep `BACKEND_MEM_LIMIT=700m`. Building is slow; large scanned PDFs may be slow to index. |

Running Ollama on the box is not realistic on either free shape for an employer demo, so the deploy uses hosted APIs.

## 1. Accounts and keys you need

Collect these before you start. They go in `.env` on the server, never in git.

- **Domain**: a subdomain such as `clarix.yourdomain.com` that you can add an A record for.
- **Supabase project**: the Session pooler connection string (Project Settings -> Database -> Connect -> Session pooler, port 5432), the project URL and the `service_role` key (Project Settings -> API).
- **Chroma Cloud**: API key, tenant id and database name.
- **OpenRouter**: an API key (openrouter.ai -> Keys), with a little credit.
- **OpenAI**: an API key for embeddings (`text-embedding-3-small` costs very little).

## 2. Oracle networking (Console)

1. Instance -> Primary VNIC -> Subnet -> Security List (or the NSG on the VNIC) -> **Add Ingress Rules**:
   source `0.0.0.0/0`, TCP, destination ports `80` and `443`. (22 is usually already open.)
2. Note the instance's **public IP**.
3. At your DNS provider, add an **A record**: `clarix` -> that public IP. Wait until `dig +short clarix.yourdomain.com` prints the IP.

## 3. Prepare the VM (SSH in)

```bash
ssh ubuntu@<public-ip>          # Oracle Linux images use opc@ instead of ubuntu@

# Ubuntu images on Oracle ship iptables rules that block everything except 22.
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p udp --dport 443 -j ACCEPT
sudo netfilter-persistent save
# Oracle Linux instead: sudo firewall-cmd --permanent --add-service=http --add-service=https && sudo firewall-cmd --reload

# 1 GB machines only: add swap so the image build and PDF OCR don't get OOM-killed.
sudo fallocate -l 4G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

# Docker + Compose plugin
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER && newgrp docker
docker compose version
```

## 4. Get the code and configure

```bash
git clone https://github.com/Ms3314/Clarix.git clarix && cd clarix
cp deploy/.env.example .env
openssl rand -hex 32            # paste the output as SECRET_KEY
nano .env                       # fill in DOMAIN and every key
chmod 600 .env
```

Notes on `.env`:
- `DOMAIN` is the bare host name (no `https://`).
- `DATABASE_URL` must start with `postgresql://`. If your Supabase password has special characters, URL-encode them.
- `LLM_MODEL` is any OpenRouter model id. `openai/gpt-4o-mini` is cheap and good at returning the JSON the quiz generator needs.
- Switching embeddings means **existing Chroma collections built with nomic-embed won't match**. On a fresh deploy that's fine; otherwise use a new `CHROMA_DATABASE` or delete the old collections, then re-upload the PDFs.

## 5. Start it

```bash
docker compose up -d --build     # first build: a few minutes on Ampere, much longer on a 1 GB micro
docker compose ps                # backend should show (healthy), web Up
docker compose logs -f web       # watch Caddy obtain the certificate
```

Open `https://<DOMAIN>`. Check that you can sign up, log in, create a classroom, upload a small PDF
(it should show as indexed), ask the tutor a question, and generate a quiz.
API docs are at `https://<DOMAIN>/api/docs`.

Both containers use `restart: unless-stopped`, and Docker starts on boot, so the site comes back after a reboot.

## 6. Day-2 operations

```bash
# Deploy new code
cd ~/clarix && git pull && docker compose up -d --build && docker image prune -f

# Logs and memory
docker compose logs --tail 200 backend
docker stats --no-stream

# Restart one service
docker compose restart backend
```

Keep the `caddy-data` volume: it holds the TLS certificates. Deleting it re-issues certificates and
can hit Let's Encrypt rate limits.

## Troubleshooting

| Symptom | Likely cause |
| --- | --- |
| Browser can't connect at all | Security List ingress rule or the VM's iptables rule for 80/443 is missing (step 2/3). |
| Caddy log: `challenge failed` / no certificate | DNS A record doesn't point at the VM yet, or port 80 is blocked. |
| `backend` restarting, log says `SECRET_KEY must be set` | `SECRET_KEY` empty in `.env`. |
| Login works, then every request bounces to `/` | Token expired (20 min) or you're on `http://` (cookie is `Secure`). Use the https URL. |
| Upload succeeds but resource never shows "indexed" | Check `docker compose logs backend` for `[RAG]` lines: wrong Chroma or OpenAI key, or OOM (`docker compose ps` shows a restart; add swap or raise `BACKEND_MEM_LIMIT`). |
| Tutor replies "Here is what I found in the classroom resources: ..." | The LLM call failed (OpenRouter key, credit or model id); the app falls back to raw context. |
| Quiz generation returns 500 | The model didn't return clean JSON; try another `LLM_MODEL`. |
| `502` on `/api/*` | Backend down or still starting; `docker compose ps` and logs. |

## Before you share the link (known security gaps)

See [status-and-gotchas.md](status-and-gotchas.md#security-notes-fix-before-any-real-deployment). The deploy
now fixes the CORS allow-list (`CORS_ORIGINS=https://${DOMAIN}`), the `Secure` cookie and the required
`SECRET_KEY`. Still open: anyone can sign up as a teacher, Supabase buckets are public, and annotations
are not membership-checked. That's acceptable for a demo with sample PDFs, but don't upload anything private.
Also set a spending limit on the OpenRouter and OpenAI keys, since the site is public.
