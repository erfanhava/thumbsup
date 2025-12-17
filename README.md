# Job-Report-Static  
**One-page HTML app** that turns photos + voice notes into a branded PDF report in <30 s—no backend server, no build step.  
Deploy free to **Vercel** (or GitHub Pages) in two clicks.

## Live demo
Replace this line with your Vercel URL after first deploy.

## Features
- Camera snapshots (mobile PWA)  
- Web-speech dictation → auto-cleaned bullets via Google Gemini 1.5 Flash  
- Client-side PDF (jsPDF) with photo grid & logo spot  
- One-click shareable link (PDF auto-uploaded to Supabase storage)  
- Works offline once cached (service-worker)

## Stack (all free tiers)
| Service      | Free allowance        | Where to grab key |
|--------------|-----------------------|-------------------|
| Supabase     | 50 k MAU, 500 MB      | Project settings → API |
| Cloudinary   | 25 GB/month           | Dashboard → Account |
| Gemini       | 60 requests/min       | [Google AI Studio](https://makersuite.google.com) |
| Vercel       | 100 GB-hours          | GitHub import |

## 30-second setup
1. Fork / clone this repo  
2. Create `.env` file (Vercel will read it)  
