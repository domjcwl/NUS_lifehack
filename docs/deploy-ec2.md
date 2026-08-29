# Deploying Floe to a single EC2 instance

A runbook, start to finish. Roughly 40 minutes if nothing surprises you.

Floe is two processes and a database file:

```
                       ┌──────────────────────────────────────┐
  phone ──── https ───▶│ nginx  :80 → :443                    │
                       │   └── / ............ next  :3000     │  ← owns everything
                       │        (same origin, so no CORS)     │    except chat answers
                       │                                      │
                       │        next ──http──▶ uvicorn :8000  │  ← chat knowledge
                       └──────────────────────────────────────┘    service
                                    web/data/floe.db (SQLite, WAL)
```

Both app processes bind to `127.0.0.1` only. nginx is the single thing the
internet can reach.

## Decisions this runbook makes for you

**TLS is not optional.** Three screens call `navigator.geolocation` — the bins
list, the map and the chat "near me" flow — and every browser blocks that API on
a non-secure origin. Serve Floe over plain HTTP and the map cannot centre on the
judge standing in front of you. Same for the QR path: a camera app opening an
`http://` link on a phone is a warning screen, not a demo.

**No domain purchase.** `sslip.io` resolves `<your-ip>.sslip.io` to that IP, and
Let's Encrypt will issue a real certificate for it. Costs nothing, takes two
minutes, and the padlock is genuine. If you own a domain, use it instead — the
certbot step is identical.

**t3.small, not t3.micro.** `next build` on 1 GB of RAM gets OOM-killed partway
through and leaves a confusing half-built `.next`. 2 GB plus swap builds cleanly.
The instance costs about USD 0.02/hour — under a dollar for the whole weekend.

**systemd, not `tmux` or `nohup`.** Judging is 12:00–14:30 on Sunday and you will
not be at the keyboard for all of it. systemd restarts a crashed process and
survives a reboot; a background job in a dropped SSH session does neither.

---

## Phase 0 — Launch the instance (AWS console, ~10 min)

1. **EC2 → Launch instance.** Region **ap-southeast-1 (Singapore)** — judges and
   phones are in Singapore, and it keeps latency invisible.
2. **Name:** `floe`.
3. **AMI:** Ubuntu Server 24.04 LTS (x86_64).
4. **Instance type:** `t3.small`.
5. **Key pair:** create one, name it `floe`, download `floe.pem`. This is your
   only copy — AWS will not show it again.
6. **Network settings → Edit.** Create a security group with exactly three
   inbound rules:

   | Type  | Port | Source | Why |
   |-------|------|--------|-----|
   | SSH   | 22   | My IP  | Not `0.0.0.0/0`. The box is on the public internet with a file full of API keys. |
   | HTTP  | 80   | Anywhere `0.0.0.0/0` | Let's Encrypt validates over port 80, and it redirects to 443. |
   | HTTPS | 443  | Anywhere `0.0.0.0/0` | The actual app. |

   **Do not open 3000 or 8000.** Nothing outside the box should reach the app
   processes directly, and an exposed `:8000` is an unauthenticated endpoint that
   spends your OpenAI credit.

7. **Storage:** 20 GB gp3. The default 8 GB is tight once `node_modules` and a
   Python venv are on disk.
8. **Launch instance.**
9. **Elastic IP** — easy to skip, expensive to skip. EC2 → Elastic IPs →
   *Allocate*, then *Actions → Associate* to the `floe` instance. Without it,
   stopping and starting the instance hands you a **new public IP**, which
   invalidates your TLS certificate and every QR code you printed.

Note the Elastic IP. It appears below as `<IP>`.

---

## Phase 1 — Connect

From PowerShell on your laptop, in the folder holding `floe.pem`:

```powershell
icacls floe.pem /inheritance:r /grant:r "$($env:USERNAME):(R)"
ssh -i floe.pem ubuntu@<IP>
```

The `icacls` line is the Windows equivalent of `chmod 400` — OpenSSH refuses a
key file that other users can read.

Everything from here runs **on the server**.

---

## Phase 2 — Base system (~8 min)

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y nginx git python3-venv sqlite3
sudo apt install -y certbot python3-certbot-nginx
```

Two short lines rather than one long one on purpose: a long line pasted into a
terminal can arrive split at the wrap point, and the tail then runs as its own
command (`Command 'certbot' not found` or similar). Re-running any `apt install`
is harmless, so if that happens, just paste it again.

Node 24, from NodeSource. **The version matters**: `web/src/lib/db.ts` imports
`node:sqlite`, which is unflagged from Node 23.4 and stable in 24. Ubuntu's apt
Node is far older and the app will not start on it.

```bash
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
sudo apt install -y nodejs
node -v    # must print v24.x
```

Swap, so a memory spike during `next build` never kills the build:

```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
free -h    # Swap: 2.0Gi
```

---

## Phase 3 — Code and secrets

```bash
cd ~
git clone https://github.com/domjcwl/NUS_lifehack.git
cd NUS_lifehack
```

The repo is public, so no deploy key is needed. `web/data/bins.json` (1.5 MB,
13,004 NEA points) is tracked, so you do **not** need to re-run the fetch script.

**The `.env` files are git-ignored and therefore absent from the clone.** They
have to be written by hand, here, once:

```bash
cat > ~/NUS_lifehack/web/.env <<'ENVEOF'
OPENAI_API_KEY=sk-proj-REPLACE_ME
OPENAI_MODEL=gpt-4o-mini
OPENAI_VISION_MODEL=gpt-4o-mini
CHATBOT_URL=http://127.0.0.1:8000
ENVEOF

cat > ~/NUS_lifehack/fastAPI_chatbot/.env <<'ENVEOF'
OPENAI_API_KEY=sk-proj-REPLACE_ME
OPENAI_MODEL=gpt-4o-mini
ENV=production
DEBUG=false
CORS_ORIGINS=*
ENVEOF

chmod 600 ~/NUS_lifehack/web/.env ~/NUS_lifehack/fastAPI_chatbot/.env
nano ~/NUS_lifehack/web/.env             # paste the real key
nano ~/NUS_lifehack/fastAPI_chatbot/.env
```

`CORS_ORIGINS=*` is safe here because the chat service is not reachable from
outside — nginx never proxies to it, only the Next server does, over loopback.

Write the key **before** building. Next evaluates module-level code during the
build, and `api/validate/route.ts` reads `process.env.OPENAI_API_KEY` at module
scope.

---

## Phase 4 — Build and smoke-test both services (~6 min)

Next.js:

```bash
cd ~/NUS_lifehack/web
npm ci
npm run build
```

`npm ci` prints three warnings that are all safe to ignore: a deprecation notice
for `eslint` (a dev dependency, not in the running app), an npm major-version
notice (do not upgrade npm mid-event — matching your laptop is worth more than
being current), and a blocked install script for `unrs-resolver`. That last one
is npm 11 refusing to run postinstall scripts by default, which is a good
default; the package is a native resolver used by ESLint, not by the app. Only
if the build itself complains about it, run
`npm install-scripts approve unrs-resolver` and build again.

The line that matters is `found 0 vulnerabilities` — and then a route table at
the end of `npm run build`.

Python:

```bash
cd ~/NUS_lifehack/fastAPI_chatbot
python3 -m venv venv
venv/bin/pip install --upgrade pip
venv/bin/pip install -r requirements.txt
```

Prove each one works alone before adding nginx to the picture:

```bash
cd ~/NUS_lifehack/fastAPI_chatbot && venv/bin/python -m uvicorn app.main:app --port 8000
# in a second SSH session:
curl -s localhost:8000/health
# {"status":"ok","chunks":N,"bins":13004,"places_cached":N,"model_configured":true}
```

`bins: 13004` and `model_configured: true` are the two numbers worth reading.
`bins: 0` means `BINS_PATH` did not resolve — it defaults to
`../web/data/bins.json`, so it only breaks if the two folders got separated.

```bash
cd ~/NUS_lifehack/web && npm run start
curl -s -o /dev/null -w '%{http_code}\n' localhost:3000    # 200
```

Ctrl-C both once they answer.

---

## Phase 5 — systemd units

```bash
sudo tee /etc/systemd/system/floe-chat.service <<'UNITEOF'
[Unit]
Description=Floe chat knowledge service (FastAPI)
After=network.target

[Service]
User=ubuntu
WorkingDirectory=/home/ubuntu/NUS_lifehack/fastAPI_chatbot
ExecStart=/home/ubuntu/NUS_lifehack/fastAPI_chatbot/venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
UNITEOF

sudo tee /etc/systemd/system/floe-web.service <<'UNITEOF'
[Unit]
Description=Floe web app (Next.js)
After=network.target floe-chat.service

[Service]
User=ubuntu
WorkingDirectory=/home/ubuntu/NUS_lifehack/web
Environment=NODE_ENV=production
Environment=PORT=3000
ExecStart=/usr/bin/npm run start
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
UNITEOF

sudo systemctl daemon-reload
sudo systemctl enable --now floe-chat floe-web
sudo systemctl status floe-chat floe-web --no-pager
```

`WorkingDirectory` on the web unit is load-bearing: `db.ts` opens
`process.cwd()/data/floe.db`. Start the process from anywhere else and it
silently creates an empty database somewhere else.

---

## Phase 6 — nginx and TLS

Work out your public hostname first — the nginx config needs it, and so does
certbot. `sslip.io` resolves `<your-ip-with-dashes>.sslip.io` straight back to
that IP, so there is no DNS to configure:

```bash
IP=$(curl -s https://checkip.amazonaws.com)
HOST=$(echo "$IP" | tr '.' '-').sslip.io
echo "IP=$IP  HOST=$HOST"
```

Keep that shell open; `$HOST` is used by every command below.

```bash
sudo tee /etc/nginx/sites-available/floe <<'NGINXEOF'
server {
    listen 80;
    # Replaced with the real hostname by the sed below. It must NOT stay as `_`:
    # certbot's nginx installer finds the block to edit by matching the domain
    # against server_name, and a catch-all matches nothing by name. You get an
    # issued certificate that fails to install.
    server_name SERVER_NAME_PLACEHOLDER;

    # A verification photo arrives as a base64 data URL inside a JSON body. The
    # client downscales to 1024px, but base64 adds ~33% — nginx's 1 MB default
    # would 413 a detailed photo, which on screen looks like a broken camera.
    client_max_body_size 12m;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';

        # lib/qr.ts builds the QR's absolute URL out of these headers. Get them
        # wrong and the sticker you print points at http:// or at 127.0.0.1 —
        # and it fails silently, in a camera app, at the bin.
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;

        # The chat service does retrieval + a model call + a ground check, and
        # allows itself 25s. Give nginx more headroom than that.
        proxy_read_timeout 90s;
        proxy_cache_bypass $http_upgrade;
    }
}
NGINXEOF

sudo sed -i "s/SERVER_NAME_PLACEHOLDER/$HOST/" /etc/nginx/sites-available/floe
grep -n server_name /etc/nginx/sites-available/floe      # check it took

sudo ln -sf /etc/nginx/sites-available/floe /etc/nginx/sites-enabled/floe
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```

Check `http://$HOST/` in a browser now — it should be Floe, padlock absent. Then
get the certificate. Two checks first; they turn a failed challenge into a
five-second diagnosis, by proving the hostname resolves here *and* that port 80
is reachable, which is everything the HTTP-01 challenge needs:

```bash
getent hosts "$HOST"                    # must print your IP back
curl -sI "http://$HOST" | head -1       # must be HTTP/1.1 200 OK

sudo certbot --nginx -d "$HOST" --agree-tos -m YOUR_EMAIL --redirect
```

Put your own address in place of `YOUR_EMAIL` — Let's Encrypt uses it for expiry
warnings.

certbot rewrites the server block in place, adds the 443 listener, sets up the
http→https redirect and installs a renewal timer. Verify:

```bash
sudo systemctl status certbot.timer --no-pager
curl -sI "https://$HOST" | head -1      # HTTP/2 200
curl -sI "http://$HOST"  | head -1      # HTTP/1.1 301
```

Your app URL is now `https://$HOST`. **Use it everywhere from here** — your own
testing, anything printed, and the Devpost submission. The bare IP stays on plain
HTTP, is not covered by the certificate, and will keep failing geolocation.

If certbot reports *"Could not automatically find a matching server block"*, the
`sed` above did not take and `server_name` is still `_`. Fix it and install the
certificate you already have — do not re-run `certbot --nginx` and choose
"renew & replace", which spends a duplicate-certificate rate limit for nothing:

```bash
sudo sed -i "s/server_name _;/server_name $HOST;/" /etc/nginx/sites-available/floe
sudo nginx -t && sudo systemctl reload nginx
sudo certbot install --cert-name "$HOST" --redirect
```

---

## Phase 7 — Verify the things that actually break

Run every one of these on a **phone**, not the laptop.

| # | Check | Proves |
|---|-------|--------|
| 1 | `https://<host>/` loads with a padlock | TLS is real, not self-signed |
| 2 | `https://<host>/api/chat/health` returns `bins: 13004` | The Next → uvicorn loopback hop works |
| 3 | `/bins` prompts for location and centres the map | Geolocation is unblocked — this is what HTTP would have cost you |
| 4 | `/bins/<code>/qr` — read the QR's URL out | Must start `https://` and carry your host. This is the forwarded-header check. |
| 5 | Scan → photo → submit, with a real 12 MP phone photo | `client_max_body_size` and the OpenAI key |
| 6 | `sudo reboot`, wait 40s, reload the site | systemd brings both services back unattended |

Check 6 is the one people skip and regret. Do it on Saturday, not when the
instance reboots itself on Sunday morning.

---

## Phase 8 — Demo-day operations

Logs, live:

```bash
journalctl -fu floe-web        # Next: route errors, OpenAI failures
journalctl -fu floe-chat       # uvicorn: retrieval, geocode, ground checks
```

Deploying a change (~40s of downtime on the web service):

```bash
cd ~/NUS_lifehack && git pull
cd web && npm ci && npm run build && sudo systemctl restart floe-web
sudo systemctl restart floe-chat     # only if Python changed
```

**Back the database up before judging.** SQLite is in WAL mode, so copying
`floe.db` on its own loses recent writes:

```bash
cd ~/NUS_lifehack/web/data
sqlite3 floe.db ".backup floe-backup-$(date +%H%M).db"
```

The server starts with an **empty** database — `floe.db` is git-ignored and the
schema is created on first request. Demo data you built up locally is on your
laptop, not here; if you want it, `.backup` it there and `scp` the result up.

**Cost control.** Stop the instance when the hackathon ends. An Elastic IP is
billed while it is *not* attached to a running instance, so if the box stays
stopped for days, release the IP too.

**Keep the laptop build as plan B.** Rule 1 in `CLAUDE.md` is that demo-ability
beats completeness, and hosting adds venue wifi to your list of single points of
failure. `npm run dev` on your laptop with the phone on the same network is the
fallback that needs no internet at all.
