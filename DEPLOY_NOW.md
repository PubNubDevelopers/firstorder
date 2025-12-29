# 🚀 Deploy to Netlify - Quick Start

## You're Ready! Everything is configured.

All the code migration is complete. Follow these simple steps to deploy:

---

## Step 1: Initialize Netlify Site (One-time setup)

Run this command:

```bash
npx netlify init
```

When prompted:
1. **Create site without git?** → Choose **"Yes, create and deploy site manually"**
2. **Team** → Select **"PubNub"** (or your team)
3. **Site name** → Enter **"firstorder"** (or "pn-firstorder" if taken)
4. **Build command** → Press Enter (uses netlify.toml: `cd client && npm install && npm run build`)
5. **Publish directory** → Press Enter (uses netlify.toml: `client/dist`)
6. **Netlify functions folder** → Press Enter (uses netlify.toml: `netlify/functions`)

This creates a `.netlify` directory with your site configuration.

---

## Step 2: Set Environment Variables

```bash
npx netlify env:set PUBNUB_PUBLISH_KEY "pub-c-66ab3e60-11b7-4792-a753-92b7e510a21e"
npx netlify env:set PUBNUB_SUBSCRIBE_KEY "sub-c-05287a7e-383f-11e3-b39b-02ee2ddab7fe"
```

---

## Step 3: Enable PubNub App Context

**IMPORTANT**: Before deploying, enable App Context in PubNub:

1. Go to: https://dashboard.pubnub.com
2. Navigate to your keyset
3. Click on **"App Context"** in the left sidebar
4. Click **"Enable App Context"**
5. Choose region: **aws-iad-1** (US East Virginia)
6. Enable these features:
   - ✅ User Metadata Events
   - ✅ Channel Metadata Events
   - ✅ Membership Events
7. Click **"Save Changes"**

---

## Step 4: Deploy!

```bash
npm run deploy
```

This will:
- Build the client (`cd client && npm install && npm run build`)
- Deploy to Netlify production
- Give you a URL like: `https://firstorder.netlify.app`

---

## Step 5: Update Client Environment Variable

After deployment, you'll get a URL like `https://firstorder.netlify.app`.

Update `client/.env`:

```env
VITE_PUBNUB_FUNCTION_URL=https://firstorder.netlify.app/api/game
```

---

## Step 6: Redeploy with Updated URL

```bash
npm run deploy
```

This second deployment ensures the client uses the production API endpoint.

---

## ✅ Done!

Your app is now live at: `https://firstorder.netlify.app` (or similar)

---

## 🧪 Testing Checklist

After deployment, test these features:

- [ ] Open the app URL
- [ ] Register with a player name
- [ ] Create a new game
- [ ] See the game in the lobby
- [ ] Join the game from another browser/tab
- [ ] Start the game (as host)
- [ ] Make moves and verify they sync
- [ ] Complete a game and see winner dialog
- [ ] Check that random messages display

---

## 📊 Monitoring

- **Netlify Dashboard**: https://app.netlify.com
  - View deployments
  - Check function logs
  - Monitor usage

- **PubNub Debug Console**: https://dashboard.pubnub.com
  - Monitor real-time messages
  - Check App Context data
  - View presence events

---

## 🐛 Troubleshooting

### Functions not working?

Check:
1. Environment variables are set in Netlify
2. PubNub App Context is enabled
3. Function logs in Netlify dashboard

### CORS errors?

Verify:
- `netlify.toml` has CORS headers (it does ✅)
- API endpoint URL is correct in `client/.env`

### Storage errors?

Ensure:
- App Context is enabled in PubNub dashboard
- Region is selected
- Channel Metadata events are enabled

---

## 🔄 Future Deployments

After the initial setup, deploying updates is simple:

```bash
npm run deploy
```

That's it! Netlify will build and deploy automatically.

---

## 🎉 You're All Set!

The architecture migration is complete and ready to deploy. Just follow the steps above!

**Questions?** Check the logs:
- Netlify: `npx netlify logs`
- Functions: In Netlify dashboard → Functions → Logs
