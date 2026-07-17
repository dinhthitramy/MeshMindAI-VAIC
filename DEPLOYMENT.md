# Production Deployment

This guide deploys one MeshMind web process on a Linux host behind Nginx. PostgreSQL
and Redis are external services and are not started with Docker Compose in production.

## Prerequisites

- Node.js 20.9 or newer; use an active LTS release.
- npm, Git, Nginx 1.25.1 or newer, and systemd.
- A PostgreSQL database reachable from the application host.
- A Redis 6.2 or newer primary reachable from the application host.
- A DNS record for the application host and a trusted TLS certificate.

Only ports 80 and 443 should be publicly reachable. Restrict PostgreSQL and Redis
to private networks or provider allowlists, and bind the Next.js process to
`127.0.0.1`.

## External Services

Create the PostgreSQL database and credentials before deployment. The account used
by `npm run db:migrate` must be allowed to create tables, indexes, and Drizzle's
migration metadata. For stricter deployments, use a separate migration account and
a least-privilege runtime account. Inject the migration account's `DATABASE_URL`
only for the migration command; do not add it to the systemd environment file.

Redis stores sessions, authentication challenges, replay-prevention state, and rate
limits. Configure TLS, ACL credentials, persistence, high availability, and a
`noeviction` policy. Use a stable primary endpoint with Lua/`EVAL` support; the
application does not accept a Redis Cluster or Sentinel URL. Authentication fails
closed when Redis is unavailable.

Enable TLS for both services whenever traffic leaves the application host. Typical
connection URLs are:

```text
postgresql://APP_USER:URL_ENCODED_PASSWORD@db.internal.example.com:5432/meshmind?sslmode=verify-full
rediss://APP_USER:URL_ENCODED_PASSWORD@redis.internal.example.com:6379/0
```

URL-encode usernames and passwords before placing them in connection URLs. Configure
automated PostgreSQL backups and regularly test restoration. Install the provider's
CA on the host, or configure `NODE_EXTRA_CA_CERTS`, when it uses a private CA.

## Secrets And Environment

Keep production secrets outside version control in `/etc/meshmind-ai.env`, owned by
root and readable by the application group. Generate three independent 32-byte HMAC
keys with `openssl rand -base64 32`.

Provision the built-in superadmin once before creating the environment file:

```bash
npm run auth:provision-superadmin -- meshmind-operations
```

Store the generated login password and TOTP URI in the appropriate password manager.
Set only the generated identifier, password hash, and TOTP secret in the application
environment. Never set the plaintext `SUPERADMIN_PASSWORD` there.

```env
NODE_ENV=production

DATABASE_URL="postgresql://APP_USER:URL_ENCODED_PASSWORD@db.internal.example.com:5432/meshmind?sslmode=verify-full"

APP_URL=https://app.example.com
# Safe only because the provided Nginx config overwrites client forwarding headers.
AUTH_TRUST_PROXY_HEADERS=true

REDIS_URL="rediss://APP_USER:URL_ENCODED_PASSWORD@redis.internal.example.com:6379/0"
REDIS_KEY_PREFIX=mm:production:v1

# The first session key is active. Keep old keys after it during a rotation.
SESSION_HMAC_KEYS="k1:REPLACE_WITH_BASE64_KEY"
RATE_LIMIT_HMAC_KEY="REPLACE_WITH_INDEPENDENT_BASE64_KEY"
RESET_TOKEN_HMAC_KEY="REPLACE_WITH_INDEPENDENT_BASE64_KEY"

SUPERADMIN_IDENTIFIER=meshmind-operations
SUPERADMIN_PASSWORD_HASH="REPLACE_WITH_GENERATED_ARGON2_HASH"
SUPERADMIN_TOTP_SECRET="REPLACE_WITH_GENERATED_BASE32_SECRET"
SUPERADMIN_CREDENTIAL_VERSION=1

SMTP_HOST=smtp.example.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=replace-me
SMTP_PASSWORD=replace-me
SMTP_FROM="MeshMind <no-reply@example.com>"
```

Use the same environment when building and running the application. Values prefixed
with `NEXT_PUBLIC_` are embedded during `npm run build`; server-only variables are
read at runtime. The server port and hostname are passed directly to `next start`
because Next.js does not load `PORT` from an env file during server startup.

Restrict the environment file after creating it:

```bash
sudo chown root:meshmind /etc/meshmind-ai.env
sudo chmod 640 /etc/meshmind-ai.env
```

## Build A Release

Never run `npm ci` or `npm run build` inside the directory used by the running
process. Keep each release immutable so a failed deployment cannot replace live
chunks, dependencies, or static assets:

```text
/srv/meshmind-ai/
|-- current -> releases/20260717180000
`-- releases/
    `-- 20260717180000/
```

Create the release directories with ownership assigned to the application user:

```bash
sudo install -d -o meshmind -g meshmind /srv/meshmind-ai \
  /srv/meshmind-ai/releases
```

For each release, use a new directory and run this block as that user:

```bash
release_id="$(date -u +%Y%m%d%H%M%S)"
release_dir="/srv/meshmind-ai/releases/$release_id"
repository_url="https://github.com/your-org/meshmind-ai.git"
release_ref="v0.1.0"

git clone --branch "$release_ref" --depth 1 "$repository_url" "$release_dir"
ln -s /etc/meshmind-ai.env "$release_dir/.env"
cd "$release_dir"

npm ci --include=dev
npm test
npm run build
npm run db:migrate
npm prune --omit=dev
```

`npm run db:migrate` applies the versioned SQL files in `drizzle/`. Run it once for
each release before restarting the web process. Keep migrations forward-compatible
with the currently running application when doing zero-downtime deployments.

After every command succeeds, atomically activate the release:

```bash
ln -s "$release_dir" "/srv/meshmind-ai/current.$release_id"
mv -Tf "/srv/meshmind-ai/current.$release_id" /srv/meshmind-ai/current
```

Keep at least the previous complete release for rollback.

## Systemd

Create `/etc/systemd/system/meshmind-ai.service` with the following unit. Adjust the
user, group, Node/npm path, and working directory for the host:

```ini
[Unit]
Description=MeshMind AI web application
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=meshmind
Group=meshmind
WorkingDirectory=/srv/meshmind-ai/current
EnvironmentFile=/etc/meshmind-ai.env
ExecStart=/usr/bin/npm run start -- --hostname 127.0.0.1 --port 3000 --keepAliveTimeout 70000
Restart=on-failure
RestartSec=5
KillSignal=SIGTERM
TimeoutStopSec=30
NoNewPrivileges=true
PrivateTmp=true
UMask=0027

[Install]
WantedBy=multi-user.target
```

Enable and start the service:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now meshmind-ai
sudo systemctl status meshmind-ai
```

Next.js handles `SIGTERM` gracefully and finishes in-flight requests. The 30-second
stop timeout leaves room for pending work to complete.

## Nginx

Use `nginx.conf.example` as an HTTP-context site configuration, for example at
`/etc/nginx/conf.d/meshmind-ai.conf`. Replace `app.example.com` and the certificate
paths. Provision the certificate before enabling the HTTPS server block.

The example overwrites incoming forwarding headers before they reach the trusted
application, preserves the public host and protocol for Server Actions, supports
connection upgrades, and disables response buffering for Next.js streaming. If the
installed Nginx is older than 1.25.1, replace `http2 on;` with the legacy
`listen 443 ssl http2;` syntax.

The example assumes clients connect directly to Nginx. If another load balancer or
CDN is in front, configure Nginx's real-IP module with only that proxy's trusted CIDR
ranges before enabling `AUTH_TRUST_PROXY_HEADERS`.

Validate and reload Nginx:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

## Verify

Check the application directly before testing through Nginx:

```bash
curl --fail --show-error http://127.0.0.1:3000/
curl --fail --show-error https://app.example.com/
sudo journalctl -u meshmind-ai --since "10 minutes ago"
```

Also verify signup, login, logout, password recovery, superadmin TOTP, database writes,
session persistence, rate limiting, outbound email, TLS renewal, and PostgreSQL
restoration before accepting production traffic.

## Release Updates

For each release, repeat [Build A Release](#build-a-release) with the new immutable
Git tag, atomically activate it, then restart the service:

```bash
sudo systemctl restart meshmind-ai
sudo systemctl status meshmind-ai
```

Do not update the active release directory in place.

Application rollback means atomically pointing `/srv/meshmind-ai/current` to the
previous complete release and restarting the service. Database migrations are not
automatically rolled back; prefer additive migrations and perform destructive cleanup
only after older application versions are retired.

For multiple Next.js instances, use the same build and Server Action encryption key
on every instance, add a shared Next.js cache implementation, and coordinate cache
tag invalidation through Redis.
