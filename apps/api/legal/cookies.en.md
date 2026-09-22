# Cookie policy

**Version 1.0** — in force since {{document.effectiveAt}}

## In short

Inbox sets **four cookies, all strictly necessary** for the site to work. No
advertising cookies. No third-party trackers. No external scripts loaded
before, during or after your visit.

That is why you will not see a banner asking you to accept trackers: there are
none to accept. The cookies below cannot be refused, because the site does not
work without them — but none of them is used to follow you around.

## Contents

1. Strictly necessary cookies
2. Audience measurement
3. Third-party cookies
4. Managing your cookies
5. If this ever changes

---

## 1. Strictly necessary cookies

| Name            | Purpose                                                                                                                 | Duration | Issuer           |
| --------------- | ----------------------------------------------------------------------------------------------------------------------- | -------- | ---------------- |
| `inbox_refresh` | Keeps you signed in between visits. Not readable by page scripts (`httpOnly`), restricted to authentication paths.      | 30 days  | {{site.domaine}} |
| `inbox_csrf`    | Protects against forged requests: the value is signed by our servers and compared with a header only the site can send. | 30 days  | {{site.domaine}} |
| `inbox_locale`  | Remembers your language choice, French or English.                                                                      | 1 year   | {{site.domaine}} |
| `inbox_vue`     | Avoids counting the same visit to an ad more than once. Holds a random identifier unconnected to your account.          | 24 hours | {{site.domaine}} |

All four are **Inbox's own cookies**. None is read by a third party, none
leaves our servers, none builds an advertising profile.

`inbox_vue` deserves a note: it holds a random number, changed daily, used only
to avoid counting the same person twice on the same ad. It cannot identify you,
follow you from one ad to another, or link your visits to your account.

## 2. Audience measurement

We measure site traffic with a **self-hosted solution that sets no cookies** and
uses no persistent identifier.

It records the page viewed, the referring page, the device type and the
country, without building an individual profile and without any way of
recognising you from one visit to the next. The data stays on our servers and
is sent to nobody.

This is a deliberate choice: a conventional analytics tool would have required
a consent banner and a transfer of data to a third party.

## 3. Third-party cookies

**On Inbox pages, none.**

One exception exists, and only if you take out a professional subscription by
bank card: you are then redirected to the **Stripe** payment page, which sets
its own cookies for security and fraud prevention.

Those cookies are set **by Stripe, on Stripe's domain**, under its
responsibility and its own privacy policy. We have no access to them. You meet
them only during payment, never while browsing Inbox.

Mobile Money payment goes through no third-party page: confirmation happens on
your phone.

## 4. Managing your cookies

The four cookies in section 1 being strictly necessary, there is nothing to
accept or refuse: without them you could neither stay signed in, nor be
protected against forged requests.

You can still delete or block them in your browser settings. In that case:

- you will be signed out on every page reload;
- some actions will be refused by the anti-forgery protection;
- your language choice will not be remembered.

Every browser has its own settings; look for "cookies" in its preferences.

## 5. If this ever changes

Should we one day add a tracker requiring consent, then:

- **no tracker would be set before you choose**;
- a banner would offer to accept all or refuse all, with **two buttons of equal
  prominence and equal ease of use**;
- no box would be pre-ticked;
- your choice would be changeable at any time and asked again after six months;
- your choice would be recorded, with its date and a truncated IP address, so
  that we can account for it.

The technical mechanism is already in place. It is simply unused, for want of
any tracker requiring consent.

---

This policy complements the
[privacy policy]({{site.url}}/legal/confidentialite).

Where the French and English versions of this policy differ, **the French
version prevails**.
