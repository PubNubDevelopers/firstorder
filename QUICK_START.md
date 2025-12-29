# Quick Start - Deployment Commands

## ✅ Already Done (Migration Complete)

- ✅ Netlify functions created
- ✅ PubNub App Context storage adapter built
- ✅ Environment files configured
- ✅ Dependencies installed
- ✅ You're logged into Netlify

---

## 🚀 Deploy in 4 Commands

### 1. Initialize Site

```bash
npx netlify init
```

Choose:
- "Yes, create and deploy site manually"
- Team: PubNub
- Site name: **firstorder**
- Accept defaults for build settings

### 2. Set Environment Variables

```bash
npx netlify env:set PUBNUB_PUBLISH_KEY "pub-c-66ab3e60-11b7-4792-a753-92b7e510a21e"
npx netlify env:set PUBNUB_SUBSCRIBE_KEY "sub-c-05287a7e-383f-11e3-b39b-02ee2ddab7fe"
```

### 3. Deploy

```bash
npm run deploy
```

### 4. Update client/.env and Redeploy

After Step 3, you'll get a URL like `https://firstorder.netlify.app`.

Edit `client/.env`:
```env
VITE_PUBNUB_FUNCTION_URL=https://firstorder.netlify.app/api/game
```

Then redeploy:
```bash
npm run deploy
```

---

## ⚠️ Don't Forget: Enable PubNub App Context

Before deploying, go to https://dashboard.pubnub.com:

1. Your keyset → App Context
2. Enable App Context
3. Choose region: **aws-iad-1**
4. Enable Channel Metadata Events
5. Save

---

## 🎯 That's It!

Your app will be live at: `https://firstorder.netlify.app`

Full instructions: See `DEPLOY_NOW.md`
