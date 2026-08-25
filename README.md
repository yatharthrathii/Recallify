# Recallify

A flashcard web app with quiz mode and gamified progress tracking.

**Live:** https://recallify-fawn.vercel.app

> **Note on v2.** This is v1. A rewrite is in progress that replaces Firebase with
> a NestJS + PostgreSQL backend and implements FSRS spaced-repetition scheduling.
> An earlier version of this README described features this code does not have —
> see [Corrections](#corrections) below. The rewrite exists to make the
> description and the code match.

---

## What it actually does

- Email/password auth via Firebase Identity Toolkit (called over REST)
- Create, edit, and delete flashcards (`front` / `back` text)
- Cards are stored per user in Firebase Realtime Database
- Quiz mode: multiple-choice questions generated on demand by an LLM from a
  topic you type
- XP, level, streak and badges, with a bar chart of recent XP
- Protected routes; dark UI

## What it does not do

Stated plainly, because a previous version of this file claimed otherwise:

- **No spaced repetition.** There is no scheduling algorithm, no interval, no
  ease factor, and no due date anywhere in this codebase. A card is
  `{ question, answer }`.
- **Quiz does not use your own cards.** Quiz questions come either from a
  hardcoded sample array or from the LLM. Your saved flashcards are not part of
  the quiz.
- **No OpenAI.** Generation goes through OpenRouter using a free DeepSeek model.

## Tech stack

| | |
|---|---|
| Framework | React 19 + Vite 6 |
| Styling | Tailwind CSS v4, Radix primitives |
| Routing | React Router 7 |
| State | React Context API (`AuthContext`, `FlashcardContext`, `StatsContext`) |
| Storage | Firebase Realtime Database, over the REST API (no Firebase SDK for data) |
| Auth | Firebase Identity Toolkit, over REST |
| AI | OpenRouter (`deepseek/deepseek-chat-v3.1:free`) |
| Charts | Recharts, plus a hand-built bar chart |
| Deploy | Vercel |

## Running locally

```bash
npm install
cp .env.example .env    # fill in your own Firebase project values
npm run dev
```

Requires a Firebase project with Realtime Database enabled. Database rules must
restrict reads and writes to the authenticated owner:

```json
{
  "rules": {
    "users": {
      "$uid": {
        ".read":  "auth != null && auth.uid === $uid",
        ".write": "auth != null && auth.uid === $uid"
      }
    }
  }
}
```

## Known issues

These are fixed by design in v2 rather than patched here.

| Issue | Location |
|---|---|
| The AI key is a `VITE_` variable, so it is bundled into the client and publicly readable | `FlashcardForm.jsx`, `Quiz.jsx` |
| `newXP = newXP % 100` discards total XP once past 100 | `StatsContext.jsx` |
| Daily XP history is overwritten rather than accumulated, so the chart is wrong | `StatsContext.jsx`, `firebase.js` |
| The Firebase ID token is never refreshed, so the session silently breaks after 1 hour | `AuthContext.jsx` |
| `handleUsernameSave` calls `login(userObject)` but `login` takes `(email, password)`, so saving a username has never worked | `Profile.jsx` |
| Quiz runs on a hardcoded sample array, not the user's cards | `FlashcardContext.jsx` |
| `npm run lint` reports 1 error and 6 warnings | — |
| Local development and production share one Firebase project, so local data appears on the live site | `.env` |

## Corrections

A previous version of this README stated:

| Claimed | Actual |
|---|---|
| "AI-Powered" using the OpenAI API | OpenRouter with a free DeepSeek model; no OpenAI |
| Spaced repetition / "smart repetition" | Not implemented at all |
| Storage: `localStorage`, "offline first" | Firebase Realtime Database; requires a network |
| State: `useState`, `useEffect` | React Context API |

These have been corrected. The AI claim is now specific about what is used, and
the spaced-repetition claim has been removed until the code supports it.

## License

MIT
