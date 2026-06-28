FROM node:24-alpine

WORKDIR /app

ENV CI=true
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH

RUN corepack enable

COPY . .

RUN pnpm install --frozen-lockfile
RUN pnpm db:generate

ARG NEXT_PUBLIC_API_BASE_URL=http://localhost:4000
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL

RUN pnpm build

ENV NODE_ENV=production

CMD ["pnpm", "--filter", "@openscore/api", "start"]
