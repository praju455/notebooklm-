# Deployment Guide

Complete guide for deploying Neuron to production using free hosting platforms.

## 🚀 Quick Deploy

**Backend:** Render.com (Free tier)  
**Frontend:** Vercel (Free tier)  
**Database:** Qdrant Cloud (Free tier)

Total cost: **$0/month** ✨

---

## Prerequisites

Before deploying, ensure you have:

1. ✅ GitHub account with your repository
2. ✅ Qdrant Cloud account with a cluster
3. ✅ At least one LLM API key (Groq recommended for free tier)
4. ✅ Render.com account
5. ✅ Vercel account

---

## Part 1: Deploy Backend to Render

### Step 1: Create Render Account

1. Go to https://render.com
2. Sign up with GitHub
3. Authorize Render to access your repositories

### Step 2: Create New Web Service

1. Click **"New +"** → **"Web Service"**
2. Connect your GitHub repository: `praju455/notebooklm-`
3. Configure the service:
   - **Name:** `neuron-backend` (or any name)
   - **Region:** Oregon (or closest to you)
   - **Branch:** `main`
   - **Root Directory:** `backend`
   - **Runtime:** Docker
   - **Plan:** Free

### Step 3: Add Environment Variables

Click **"Advanced"** and add these environment variables:

**Required:**
```
QDRANT_URL=https://your-cluster.qdrant.io
QDRANT_API_KEY=your-qdrant-api-key
GROQ_API_KEY=your-groq-api-key
ALLOWED_ORIGINS=*
ENVIRONMENT=production
```

**Optional (add if you have them):**
```
GEMINI_API_KEY=your-gemini-key
OPENAI_API_KEY=your-openai-key
ANTHROPIC_API_KEY=your-anthropic-key
TAVILY_API_KEY=your-tavily-key
```

### Step 4: Deploy

1. Click **"Create Web Service"**
2. Wait 5-10 minutes for the build to complete
3. Once deployed, you'll get a URL like: `https://neuron-backend.onrender.com`

### Step 5: Verify Backend

Visit: `https://your-backend-url.onrender.com/health`

You should see:
```json
{
  "status": "healthy",
  "version": "2.0.0"
}
```

**⚠️ Important:** Free tier sleeps after 15 minutes of inactivity. First request after sleep takes ~30 seconds.

---

## Part 2: Deploy Frontend to Vercel

### Step 1: Create Vercel Account

1. Go to https://vercel.com
2. Sign up with GitHub
3. Authorize Vercel to access your repositories

### Step 2: Import Project

1. Click **"Add New..."** → **"Project"**
2. Import `praju455/notebooklm-`
3. Configure:
   - **Framework Preset:** Next.js
   - **Root Directory:** `frontend`
   - **Build Command:** `npm run build` (auto-detected)
   - **Output Directory:** `.next` (auto-detected)

### Step 3: Add Environment Variables

Click **"Environment Variables"** and add:

```
NEXT_PUBLIC_API_URL=https://your-backend-url.onrender.com
```

**Optional (if using Google Auth):**
```
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-google-client-id
```

### Step 4: Deploy

1. Click **"Deploy"**
2. Wait 2-3 minutes for build
3. You'll get a URL like: `https://notebooklm-xyz.vercel.app`

### Step 5: Update Backend CORS

Go back to Render and update the `ALLOWED_ORIGINS` environment variable:

```
ALLOWED_ORIGINS=https://your-vercel-app.vercel.app,https://*.vercel.app
```

Then click **"Manual Deploy"** → **"Deploy latest commit"**

---

## Part 3: Configure Custom Domain (Optional)

### For Frontend (Vercel)

1. Go to your Vercel project → **Settings** → **Domains**
2. Add your custom domain (e.g., `neuron.yourdomain.com`)
3. Follow Vercel's DNS instructions
4. SSL certificate is automatic

### For Backend (Render)

1. Go to your Render service → **Settings** → **Custom Domain**
2. Add your custom domain (e.g., `api.yourdomain.com`)
3. Follow Render's DNS instructions
4. SSL certificate is automatic

---

## Local Development

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
# Edit .env with your API keys
uvicorn app.main:app --reload --port 8000
```

**Verify:**
- Health: http://localhost:8000/health
- Docs: http://localhost:8000/docs

### Frontend

```bash
cd frontend
npm install
cp .env.example .env.local
# Edit .env.local:
# NEXT_PUBLIC_API_URL=http://localhost:8000
npm run dev
```

**Open:** http://localhost:3000

---

## Docker Deployment (Self-Hosted)

### Backend

```bash
cd backend
docker build -t neuron-backend .
docker run -d \
  -p 8000:10000 \
  -e QDRANT_URL=your-url \
  -e QDRANT_API_KEY=your-key \
  -e GROQ_API_KEY=your-key \
  -e ALLOWED_ORIGINS=* \
  --name neuron-backend \
  neuron-backend
```

### Frontend

```bash
cd frontend
docker build -t neuron-frontend \
  --build-arg NEXT_PUBLIC_API_URL=https://your-backend-url .
docker run -d -p 3000:3000 --name neuron-frontend neuron-frontend
```

---

## Alternative Platforms

### Backend Alternatives

1. **Railway.app** (Free tier: $5 credit/month)
   - Similar to Render
   - Better performance on free tier
   - Deploy from GitHub

2. **Fly.io** (Free tier: 3 VMs)
   - Better global distribution
   - Requires `fly.toml` config

3. **Google Cloud Run** (Free tier: 2M requests/month)
   - Serverless
   - Auto-scaling
   - Requires Docker

### Frontend Alternatives

1. **Netlify** (Free tier)
   - Similar to Vercel
   - Great for static sites

2. **Cloudflare Pages** (Free tier)
   - Fast global CDN
   - Unlimited bandwidth

---

## Troubleshooting

### Backend Issues

**Problem:** Health check fails
- **Solution:** Check logs in Render dashboard
- Verify all required env vars are set
- Ensure Qdrant URL is accessible

**Problem:** 503 Service Unavailable
- **Solution:** Backend is initializing (takes 30-60s on free tier)
- Wait and refresh

**Problem:** CORS errors
- **Solution:** Update `ALLOWED_ORIGINS` to include your frontend URL
- Use `*` for testing (not recommended for production)

### Frontend Issues

**Problem:** API calls fail
- **Solution:** Check `NEXT_PUBLIC_API_URL` is correct
- Ensure backend is deployed and healthy
- Check browser console for errors

**Problem:** Build fails
- **Solution:** Check Vercel build logs
- Ensure all dependencies are in `package.json`
- Try `npm run build` locally first

### Performance Issues

**Problem:** Slow first request (Render free tier)
- **Solution:** This is normal - free tier sleeps after 15 min
- Consider upgrading to paid tier ($7/month)
- Or use a cron job to ping every 10 minutes

**Problem:** Rate limits
- **Solution:** Implement request queuing
- Use multiple API keys
- Upgrade to paid tiers

---

## Monitoring

### Render

- View logs: Dashboard → Your Service → Logs
- Metrics: Dashboard → Your Service → Metrics
- Set up alerts: Dashboard → Your Service → Notifications

### Vercel

- Analytics: Dashboard → Your Project → Analytics
- Logs: Dashboard → Your Project → Deployments → View Function Logs
- Speed Insights: Automatic

---

## Security Checklist

- [ ] Use environment variables for all secrets
- [ ] Enable HTTPS (automatic on Render/Vercel)
- [ ] Set proper CORS origins (not `*` in production)
- [ ] Rotate API keys regularly
- [ ] Enable rate limiting (already configured)
- [ ] Monitor error logs
- [ ] Set up Sentry for error tracking (optional)

---

## Cost Optimization

### Free Tier Limits

**Render Free:**
- 750 hours/month (enough for 1 service)
- Sleeps after 15 min inactivity
- 512 MB RAM
- Shared CPU

**Vercel Free:**
- 100 GB bandwidth/month
- Unlimited deployments
- Automatic SSL
- Global CDN

**Qdrant Cloud Free:**
- 1 GB storage
- 1 cluster
- Enough for ~100k documents

### When to Upgrade

Upgrade when you hit:
- Consistent traffic (backend always active)
- Need faster cold starts
- More than 1 GB vector storage
- Need dedicated resources

**Recommended paid tiers:**
- Render: $7/month (no sleep, better performance)
- Qdrant: $25/month (4 GB storage)
- Vercel: Free tier is usually enough

---

## Backup & Recovery

### Backup Qdrant Data

```bash
# Export collections
curl -X GET "https://your-cluster.qdrant.io/collections/rag_documents_v2/points/scroll" \
  -H "api-key: your-key" > backup.json
```

### Backup Environment Variables

Keep a secure copy of all environment variables in a password manager.

---

## CI/CD

Both Render and Vercel automatically deploy when you push to `main` branch.

**To disable auto-deploy:**
- Render: Settings → Auto-Deploy → Off
- Vercel: Settings → Git → Disable

**Manual deploy:**
- Render: Manual Deploy → Deploy latest commit
- Vercel: Deployments → Redeploy

---

## Support

- **Render Docs:** https://render.com/docs
- **Vercel Docs:** https://vercel.com/docs
- **Qdrant Docs:** https://qdrant.tech/documentation/

---

**🎉 Your app is now live!**

Share your deployment URL and start using Neuron in production!
