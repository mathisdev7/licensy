# Docker Setup Guide

## Prerequisites

- Docker Engine 20.10+
- Docker Compose 2.0+

## Development Mode

### Option 1: With Docker PostgreSQL (Recommended for fresh setup)

1. Copy `.env.example` to `.env` and fill in your Discord bot credentials:

   ```bash
   cp .env.example .env
   ```

   Edit `.env` and set:

   - `DISCORD_TOKEN`
   - `GUILD_ID`
   - `CLIENT_ID`

2. Start the development environment:

   ```bash
      docker compose up
   ```

   Or run in detached mode:

   ```bash
   docker compose up -d
   ```

3. View logs:
   ```bash
   docker compose logs -f bot
   ```

**Features:**

- PostgreSQL database automatically configured
- Hot reload: changes to `src/` are watched and rebuilt
- Database migrations run automatically on startup
- Default credentials: `licensy` / `licensy_dev_pass`

### Option 2: With External PostgreSQL (Use existing dev database)

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
2. Edit `.env` with your Discord credentials and existing database:

   ```env
   DISCORD_TOKEN="your_token"
   GUILD_ID="your_guild_id"
   CLIENT_ID="your_client_id"

   # Your existing development database
   DATABASE_URL="postgresql://user:password@localhost:5432/licensy_dev?schema=public"
   # For PostgreSQL on host machine (Linux):
   # DATABASE_URL="postgresql://user:password@172.17.0.1:5432/licensy_dev?schema=public"
   ```

3. Start only the bot (no PostgreSQL container):
   ```bash
   docker compose -f docker-compose.dev-external-db.yml up
   ```

**Features:**

- Uses your existing PostgreSQL instance
- Hot reload enabled
- Migrations applied to your database on startup

### Useful Commands

```bash
# Stop all services
docker compose down

# Stop and remove volumes (fresh database)
docker compose down -v

# Rebuild the bot image
docker compose build bot

# Run Prisma commands
docker compose exec bot pnpm prisma studio
docker compose exec bot pnpm prisma migrate dev

# Access database
docker compose exec postgres psql -U licensy -d licensy
```

## Production Mode

### Setup

1. Copy `.env.example` to `.env.prod` and configure:

   ```bash
   cp .env.example .env.prod
   ```

   Edit `.env.prod` and set:

   - `DISCORD_TOKEN`
   - `GUILD_ID`
   - `CLIENT_ID`
   - `POSTGRES_PASSWORD` (strong password!)
   - Optional: `POSTGRES_USER`, `POSTGRES_DB`, `POSTGRES_PORT`

2. Start production environment:

   ```bash
   docker compose -f docker-compose.prod.yml --env-file .env.prod up -d
   ```

3. View logs:
   ```bash
   docker compose -f docker-compose.prod.yml logs -f bot
   ```

### Production Features

- Optimized multi-stage build
- Persistent database volumes
- Automatic restart on failure
- Database migrations run on startup

### Useful Commands

```bash
# Stop production services
docker compose -f docker-compose.prod.yml down

# View logs
docker compose -f docker-compose.prod.yml logs -f

# Rebuild and restart
docker compose -f docker-compose.prod.yml up -d --build

# Backup database
docker compose -f docker-compose.prod.yml exec postgres pg_dump -U licensy licensy > backup.sql

# Restore database
docker compose -f docker-compose.prod.yml exec -T postgres psql -U licensy licensy < backup.sql
```

## Using External Database

If you already have a PostgreSQL database (e.g., on your VPS), use the dedicated compose file:

### Production with External Database (Recommended for VPS)

1. Configure `.env.prod` with your existing database:

   ```bash
   cp .env.example .env.prod
   ```

   Edit `.env.prod`:

   ```env
   # Discord credentials
   DISCORD_TOKEN="your_token"
   GUILD_ID="your_guild_id"
   CLIENT_ID="your_client_id"

   # Your existing PostgreSQL database
   DATABASE_URL="postgresql://user:password@localhost:5432/licensy?schema=public"
   # Or if PostgreSQL is on a different host:
   # DATABASE_URL="postgresql://user:password@your-db-host:5432/licensy?schema=public"
   ```

2. Start the bot only (no PostgreSQL container):

   ```bash
   docker compose -f docker-compose.prod-external-db.yml --env-file .env.prod up -d
   ```

3. View logs:
   ```bash
   docker compose -f docker-compose.prod-external-db.yml logs -f bot
   ```

**Note:** If your PostgreSQL is on the host machine (not in Docker), use:

- `DATABASE_URL="postgresql://user:password@host.docker.internal:5432/licensy?schema=public"` (Mac/Windows)
- `DATABASE_URL="postgresql://user:password@172.17.0.1:5432/licensy?schema=public"` (Linux - Docker bridge IP)
- Or add `network_mode: "host"` to the bot service and use `localhost`

### Alternative: Modify Existing Compose File

If you prefer to modify `docker-compose.prod.yml` directly:

1. Comment out the postgres service:

   ```yaml
   # Comment or remove this entire section
   # postgres:
   #   image: postgres:16-alpine
   #   ...
   ```

2. Remove the dependency:

   ```yaml
   bot:
     build:
       context: .
       target: production
     # Remove or comment out:
     # depends_on:
     #   postgres:
     #     condition: service_healthy
   ```

3. Set `DATABASE_URL` in `.env.prod` to your existing database

4. Start:
   ```bash
   docker compose -f docker-compose.prod.yml --env-file .env.prod up -d
   ```

## Troubleshooting

### Bot fails to connect to database

- Check if postgres service is healthy: `docker compose ps`
- Verify DATABASE_URL is correct
- Check logs: `docker compose logs postgres`

### Permission issues

- Ensure Docker has proper permissions
- On Linux, you may need to run with `sudo` or add your user to docker group

### Port conflicts

- If port 5432 is already in use, change it in docker-compose.yml:
  ```yaml
  ports:
    - "5433:5432" # Use 5433 on host
  ```

### Fresh start

```bash
# Remove everything and start fresh
docker compose down -v
docker system prune -a
docker compose up --build
```
