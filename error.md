Prisma schema loaded from prisma/schema.prisma.
Error: Prisma schema validation - (get-config wasm)

Error code: P1012
error: The datasource property `url` is no longer supported in schema files. Move connection URLs for Migrate to `prisma.config.ts` and pass either `adapter` for a direct database connection or `accelerateUrl` for Accelerate to the `PrismaClient` constructor. See https://pris.ly/d/config-datasource and https://pris.ly/d/prisma7-client-config

  -->  prisma/schema.prisma:8
   | 
 7 |   provider = "postgresql"
 8 |   url      = env("DATABASE_URL")
   | 
Validation Error Count: 1
[Context: getConfig]
Prisma CLI Version : 7.8.0
npm error code 1
npm error path /app
npm error command failed
npm error command sh -c prisma generate
npm notice
npm notice New major version of npm available! 10.9.8 -> 11.15.0
npm notice Changelog: https://github.com/npm/cli/releases/tag/v11.15.0
npm notice To update run: npm install -g npm@11.15.0
npm notice
Build Failed: build daemon returned an error < failed to solve: process "/bin/sh -c npm ci" did not complete successfully: exit code: 1 >