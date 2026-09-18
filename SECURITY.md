# Security Notes

- Passwords are hashed in this starter; production should use a dedicated password hashing algorithm such as Argon2 or bcrypt.
- Never commit `.env` or real API keys to GitHub.
- The device check is a basic anti-duplicate mechanism, not a complete fraud-prevention system.
- Production accounts should use secure sessions/JWTs, rate limiting, email verification, password reset, audit logs, and abuse monitoring.