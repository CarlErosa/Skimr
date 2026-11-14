# Skimr

Skimr helps busy readers decide whether an article is worth their time.
Paste up to five links, or paste article text, and it returns a `read`, `skim`,
or `skip` verdict with a short reason and source-backed claims.

The app is in [`skimr/`](./skimr/). See [`skimr/README.md`](./skimr/README.md)
for the full product overview, design decisions, and implementation details.

## Live demo

Try the deployed app at [skimr-article.vercel.app](https://skimr-article.vercel.app).

## Run locally

```bash
cd skimr
npm install
cp .env.example .env.local
```

Add your Gemini API key and model name to `.env.local`, then start the
development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Verify the project

Run the checks from `skimr/`:

```bash
npm test
npm run lint
npm run build
```

`npm test` runs the quote-verification tests without making network requests.
