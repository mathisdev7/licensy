# Licensy v3 🔑

A powerful Discord bot for managing license keys and premium memberships within your Discord server.

## 📋 Table of Contents

- [Features](#-features)
- [Prerequisites](#-prerequisites)
- [Installation](#-installation)
- [Configuration](#-configuration)
- [Usage](#-usage)
- [Commands](#-commands)
- [Database Schema](#-database-schema)
- [Contributing](#-contributing)
- [Support](#-support)
- [Author](#-author)
- [License](#-license)

## ✨ Features

- **License Key Management**: Create, redeem, and manage license keys with expiration dates
- **Role Assignment**: Automatically assign roles when license keys are redeemed
- **Premium System**: Enhanced features for premium guilds with higher limits
- **Logging System**: Track license activities with customizable logging
- **Database Integration**: PostgreSQL database with Prisma ORM
- **Cooldown System**: Built-in command cooldowns to prevent spam
- **Permission System**: Role-based permissions for different commands

## 🔧 Prerequisites

- [Node.js](https://nodejs.org/) v20.0.0 or higher
- [pnpm](https://pnpm.io/) package manager
- [PostgreSQL](https://www.postgresql.org/) database
- Discord Bot Token and Application

## 🚀 Installation

1. **Clone the repository**

   ```bash
   git clone https://github.com/mathisdev7/licensy.git
   cd licensy
   ```

2. **Install dependencies**

   ```bash
   pnpm install
   ```

3. **Set up environment variables**

   ```bash
   cp .env.example .env
   ```

   Edit the `.env` file with your configuration:

   ```env
   DISCORD_TOKEN=your_discord_bot_token
   CLIENT_ID=your_discord_client_id
   GUILD_ID=your_discord_guild_id
   DATABASE_URL=postgresql://username:password@localhost:5432/licensy
   environment=prod
   ```

4. **Set up the database**

   ```bash
   pnpm dlx prisma migrate deploy
   pnpm dlx prisma generate
   ```

5. **Build the project**

   ```bash
   pnpm run build
   ```

6. **Deploy slash commands**

   ```bash
   pnpm run deploy
   ```

7. **Start the bot**
   ```bash
   pnpm start
   ```

## ⚙️ Configuration

### Environment Variables

| Variable        | Description                               | Required |
| --------------- | ----------------------------------------- | -------- |
| `DISCORD_TOKEN` | Your Discord bot token                    | ✅       |
| `CLIENT_ID`     | Your Discord application client ID        | ✅       |
| `GUILD_ID`      | Your Discord server ID (for development)  | ✅       |
| `DATABASE_URL`  | PostgreSQL connection string              | ✅       |
| `environment`   | Environment mode (`dev`, `prod`, `debug`) | ✅       |

### Bot Permissions

Make sure your bot has the following permissions:

- Send Messages
- Use Slash Commands
- Manage Roles
- Read Message History
- Embed Links

## 📖 Usage

### Basic Workflow

1. **Create License Keys**: Use `/license-create` to generate license keys with specific roles and expiration times
2. **Distribute Keys**: Share the generated keys with your users
3. **Redeem Keys**: Users can redeem keys using `/license-redeem`
4. **Manage Licenses**: Monitor and manage active licenses with various commands

### Premium Features

Premium guilds get enhanced limits:

- **Standard**: 50 licenses max, 10 per command
- **Premium**: 200 licenses max, 30 per command

## 🎯 Commands

### License Commands

- `/license-create <role> <time> [amount]` - Create new license keys
- `/license-redeem <key>` - Redeem a license key
- `/license-info <key>` - Get information about a license
- `/license-list` - List all licenses in the server
- `/license-delete <key>` - Delete a specific license
- `/license-delete-all` - Delete all licenses
- `/license-active` - Show active licenses
- `/license-stop <key>` - Stop/deactivate a license
- `/license-logs` - View license activity logs

### Premium Commands

- `/premium-add <user> <time> <guildid>` - Add premium to a user/guild
- `/premium-delete <user> <guildid>` - Remove premium
- `/premium-edit <user> <guildid> <time>` - Edit premium duration
- `/premium-info <user> <guildid>` - Get premium information
- `/premium-list` - List all premium users

### General Commands

- `/help` - Show help information
- `/ping` - Check bot latency

## 🗄️ Database Schema

The bot uses PostgreSQL with the following main tables:

- **License**: Stores license keys, roles, expiration dates, and redemption status
- **Premium**: Manages premium memberships for users and guilds
- **Logs**: Tracks license-related activities
- **Locale**: Stores language preferences per guild

## 🛠️ Development

### Scripts

- `pnpm start` - Build and start the bot
- `pnpm run build` - Compile TypeScript
- `pnpm run watch` - Watch for changes and recompile
- `pnpm run deploy` - Deploy slash commands
- `pnpm run clean` - Clean build directory

### Project Structure

```
src/
├── commands/          # Slash commands
│   ├── general/      # General utility commands
│   ├── license/      # License management commands
│   ├── premium/      # Premium system commands
│   └── context/      # Context menu commands
├── events/           # Discord.js event handlers
├── structures/       # Base classes and utilities
├── languages/        # Internationalization files
├── misc/            # Utility functions
└── types/           # TypeScript type definitions
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 🆘 Support

If you encounter any issues or have questions:

1. Check the [Issues](https://github.com/mathisdev7/licensy/issues) page
2. Create a new issue if your problem isn't already reported
3. Provide detailed information about your setup and the error

## 👨‍💻 Author

**Mathis** (frost.wrld)

- GitHub: [@mathisdev7](https://github.com/mathisdev7)
- Discord: frost.wrld

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

⭐ If you find this project helpful, please consider giving it a star on GitHub!
