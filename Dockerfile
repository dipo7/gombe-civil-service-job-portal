FROM node:22-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Inlined into the browser bundle at build time; leave empty to disable Turnstile.
ARG NEXT_PUBLIC_TURNSTILE_SITE_KEY=""
ENV NEXT_PUBLIC_TURNSTILE_SITE_KEY=$NEXT_PUBLIC_TURNSTILE_SITE_KEY

RUN npx prisma generate && npx next build

# Dev dependencies stay: the same image runs the worker (tsx) and Prisma migrations.
ENV NODE_ENV=production HOSTNAME=0.0.0.0 PORT=3000
EXPOSE 3000
CMD ["npm", "start"]
