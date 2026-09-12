# Sewa Nominal Roll Management System

## Environment Setup

Create a `.env` file in the project root with your Supabase credentials:

```
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

You can find these in your Supabase dashboard under Settings > API.

## Local Development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
npm run preview
```

## Deploy on Vercel

1. Push this repo to GitHub
2. Go to vercel.com and import the repo
3. Add environment variables:
   - VITE_SUPABASE_URL
   - VITE_SUPABASE_ANON_KEY
4. Deploy

## Deploy on Netlify

1. Push this repo to GitHub
2. Go to netlify.com and import the repo
3. Build command: npm run build
4. Publish directory: dist
5. Add environment variables:
   - VITE_SUPABASE_URL
   - VITE_SUPABASE_ANON_KEY
6. Deploy

## Deploy on GitHub Pages

1. Push this repo to GitHub
2. Go to Settings > Pages
3. Source: GitHub Actions
4. Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to GitHub Pages
on:
  push:
    branches: [main]
permissions:
  contents: read
  pages: write
  id-token: write
jobs:
  deploy:
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npm run build
        env:
          VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
          VITE_SUPABASE_ANON_KEY: ${{ secrets.VITE_SUPABASE_ANON_KEY }}
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist
      - id: deployment
        uses: actions/deploy-pages@v4
```

5. Add secrets in Settings > Secrets and variables > Actions:
   - VITE_SUPABASE_URL
   - VITE_SUPABASE_ANON_KEY
6. Push to main branch to trigger deployment

## Database

The SQL migration is in `supabase/migrations/`. Run it in your Supabase SQL Editor if setting up a new project.
