This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

Start PostgreSQL and Redis:

```bash
docker compose up -d
```

The host-run application can connect with these default URLs:

```text
postgresql://meshmind:meshmind@localhost:5432/meshmind
redis://localhost:6379
```

The database name, username, password, and published ports can be overridden with
`POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_PORT`, and
`REDIS_PORT`.

Apply the database migrations before starting the application:

```bash
npm run db:migrate
```

Then run the development server on the host:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Database

The PostgreSQL connection is exported as `db` from `lib/db/index.ts`. The schema
and generated SQL migrations are managed with Drizzle.

```bash
npm run db:generate # Generate a migration after changing the schema
npm run db:migrate  # Apply pending migrations
npm run db:studio   # Open Drizzle Studio
```

## Email

SMTP configuration is listed in `.env.example`. The email service validates it
when an email is first sent, so SMTP credentials are not required during builds.

Use the service from server-side code only:

```ts
import { sendEmail } from "@/lib/email";

await sendEmail({
  to: "recipient@example.com",
  subject: "Hello",
  text: "Hello from MeshMind.",
  html: "<p>Hello from MeshMind.</p>",
});
```

`verifyEmailConnection()` can be used to check the SMTP connection without
sending a message.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
