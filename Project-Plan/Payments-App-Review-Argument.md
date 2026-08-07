# Why Rally's dues system does not use In-App Purchase

**Purpose:** the argument we make to App Review, the design constraints that keep it true,
and the one thing that would break it. Not legal advice — run it past counsel before the LLC
signs anything.

---

## 1. The rule that's on our side

Apple's own guidelines don't merely *permit* an outside payment rail for what we're doing —
they **require** it.

- **3.1.5(a) — Goods and Services Outside of the App.** Apps enabling the purchase of
  physical goods or services consumed outside the app *must* use a payment method other
  than in-app purchase. IAP is for digital content consumed inside the app.
- **3.1.3(e) — Goods and Services Outside of the App.** Reinforces that real-world
  services are outside IAP's scope.

Chapter dues are the textbook case. A member's dues fund a physical chapter house, a
formal at a real venue, an intramural fee, national organization obligations. None of it is
delivered by Rally. Rally is the ledger and the receipt — the same role a treasurer's
spreadsheet plus Venmo plays today.

**The one-sentence version:** *Rally does not sell anything. Chapters bill their own members
for real-world organizational obligations, using their own Stripe accounts, and Rally is the
software that tracks it.*

## 2. The structural facts that make the argument credible

These aren't rhetoric — they're properties of how the system is actually built, and a
reviewer can verify each one.

| Claim | Why it's verifiably true |
|---|---|
| Rally never holds the money | Stripe Connect **Standard** accounts. Funds settle directly to the chapter's own Stripe account. The chapter is the merchant of record; Rally is not a payment facilitator. |
| The chapter, not Rally, sets the price | Dues amounts are created by a chapter treasurer in `create_dues_cycle`. There is no price list, no catalog, no SKU anywhere in the product. |
| Nothing digital is unlocked by paying | Every app feature — calendar, chat, map, feed, roster — works identically whether a member's balance is $0 or $500. Paying dues changes one row's status; it grants zero entitlements in the app. |
| The obligation exists off-app | Members owe dues by virtue of chapter membership, established offline through recruitment. Deleting the app does not erase the debt; installing it does not create one. |
| Rally's revenue is a software fee | The application fee (2% + $0.30) is charged to the chapter for using the platform, not to the member for content. |

The third row is the load-bearing one. Apple's real concern is developers routing purchases
of *app value* around IAP. We are routing nothing of the sort, and the build proves it.

## 3. Precedent

Apps that collect real-world dues, memberships, and organizational fees outside IAP and are
live on the App Store: gym and studio membership apps, HOA and property-management payment
apps, youth-sports team apps collecting league fees, church and nonprofit giving apps,
tuition and school-lunch payment apps. Greek-life billing incumbents (OmegaFi, GreekBill)
have shipped on iOS for years on exactly this footing. This is a well-worn path, not an edge
case we're arguing into existence.

## 4. Notes to paste into App Store Connect at submission

> Rally is organization-management software for university student organizations
> (fraternities, sororities, clubs). The Dues screen is a ledger, not a store.
>
> Chapters bill their own members for real-world membership obligations — chapter house
> costs, national organization dues, event and social fees. Payments are processed through
> each chapter's own Stripe Connect Standard account; funds settle directly to the chapter,
> and Rally never takes custody of them. Rally charges the chapter a software fee for the
> service.
>
> No digital content, feature, subscription, or functionality within the app is unlocked or
> gated by these payments. Every feature is fully available to every verified member
> regardless of their balance. Treasurers may also record cash or bank-transfer payments
> manually, which is the same accounting function performed without any payment processing.
>
> Per Guideline 3.1.5(a), these are services consumed outside the app and therefore use a
> payment method other than in-app purchase.
>
> Demo chapter for review: [treasurer login] / [member login] — the member account has one
> outstanding charge so the flow can be exercised end to end.

Give the reviewer a working treasurer account **and** a member account with a live charge on
it. A reviewer who can't reach the screen rejects on 2.1 instead, and we'd never get to make
this argument.

## 5. What would break the argument

One decision could turn a clean 3.1.5(a) case into a 3.1.1 rejection, so it's worth naming
now, before Chapter Pro ships:

- **Never gate an app feature behind a payment.** No "pay dues to unlock the calendar," no
  member-facing "Pro" upgrade, no badge or cosmetic sold to individuals. The moment a
  payment buys something that exists only inside Rally, IAP applies and Apple is right.
- **Chapter Pro is the real risk, not dues.** A subscription that unlocks in-app software
  features *is* digital content. Sell it **B2B to the chapter, off-app** — signed on our
  website, invoiced to the chapter's treasurer, never purchasable from an iOS screen. Do not
  put an upgrade button in the app. (This is the "reader app" boundary; even the link out is
  restricted, so keep the sales motion entirely outside the app.)
- **Don't describe dues as buying anything.** Copy discipline matters: "what you owe,"
  "balance," "record a payment" — never "buy," "purchase," "upgrade," "unlock."
- **Keep the manual-payment path prominent.** A treasurer marking a cash payment received is
  plainly bookkeeping. Its presence makes the whole screen read as accounting software,
  which is what it is.

## 6. Prerequisites before any of this is live

- LLC formed — Stripe Connect requires a legal entity to be the platform.
- Stripe account with Connect enabled (Standard accounts) and the platform profile filled in.
- Privacy policy and terms hosted publicly, covering payment data handling.
- A real support email, published. Payment disputes need somewhere to go.
- Chapter-facing terms making explicit that the chapter is the merchant of record and Rally
  is not responsible for refunds of chapter dues.

## 7. If we get rejected anyway

It happens; reviewers vary. The response is a reply in Resolution Center, not a redesign:
restate that funds settle to the chapter's own Stripe account, that no in-app functionality
is gated, and cite 3.1.5(a) directly. If that fails, request an App Review Board escalation.
Do not preemptively add IAP — a 30% cut on chapter dues destroys the business model, and
Apple would be taking a fee on money that never touches our product.
