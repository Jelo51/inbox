# Privacy policy

**Version 1.0** — in force since {{document.effectiveAt}}

This document explains what data we collect, why, how long we keep it, who we
send it to, and what you can require of us. It is written to be read, not to be
worked around.

## Contents

1. Who is responsible for your data
2. What we collect, and why
3. Encrypted messaging: what we see and what we do not
4. How long we keep your data
5. Who your data is shared with
6. Transfers out of Cameroon
7. Your rights, and how to exercise them
8. Security
9. Cookies
10. Minors
11. Changes
12. Contacting us and complaining

---

## 1. Who is responsible for your data

The data controller is:

- **{{editeur.nom}}**, {{editeur.qualite}}
- {{editeur.formeJuridique}}
- RCCM: {{editeur.rccm}}
- {{editeur.adresse}}
- {{contact.donnees}}

Data protection officer: {{dpo.nom}}
Officer's contact: {{dpo.email}}

**Two legal frameworks apply together.** The controller being established in
the European Union, **Regulation (EU) 2016/679 (GDPR)** applies, in addition to
**Law No. 2024/017 of 23 December 2024** on the protection of personal data in
Cameroon. On each point we have applied the more protective rule.

## 2. What we collect, and why

We collect only what the service needs. No data is sold, rented, or passed on
for advertising purposes.

### Creating and managing your account

|                 |                                                                                                                                                                |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Data**        | Email address, password (never in the clear: only an argon2id hash is kept), display name, language, declaration of adulthood, sign-up date, last sign-in date |
| **Purpose**     | Identify you, secure your account, contact you                                                                                                                 |
| **Legal basis** | Performance of the contract between us (the terms of use)                                                                                                      |

### Phone number

|                 |                                                                            |
| --------------- | -------------------------------------------------------------------------- |
| **Data**        | Cameroonian phone number                                                   |
| **Purpose**     | Let buyers reach you, if you want them to                                  |
| **Legal basis** | Your consent — this field is optional, and you can withdraw it at any time |

Your number is **never shown in the clear** on your ads: visitors see only a
masked preview and must explicitly ask to see it. Every viewing is recorded
(date, ad, truncated IP address) and their frequency is limited. That record
lets us detect automated harvesting of numbers.

### Ads

|                 |                                                                                  |
| --------------- | -------------------------------------------------------------------------------- |
| **Data**        | Title, description, price, category, city, neighbourhood, condition, photographs |
| **Purpose**     | Publish your ad and make it findable                                             |
| **Legal basis** | Performance of the contract                                                      |

**The metadata of your photographs is removed before publication**, including
the GPS coordinates recorded by your device. A photo taken at your home
contains your address; we do not publish it.

### Messaging

|                 |                                                                                    |
| --------------- | ---------------------------------------------------------------------------------- |
| **Data**        | Public keys, encrypted messages, sender, recipient, ad concerned, date, read state |
| **Purpose**     | Deliver your messages                                                              |
| **Legal basis** | Performance of the contract                                                        |

See section 3: we cannot read the content of your messages.

### Viewing ads

|                 |                                                                          |
| --------------- | ------------------------------------------------------------------------ |
| **Data**        | A non-reversible hash combining the ad, the day and a session identifier |
| **Purpose**     | Count views without counting the same visitor twice                      |
| **Legal basis** | Legitimate interest: giving the seller an honest measure of interest     |

This hash cannot identify you or follow you from one ad to another.

### Moderation and security

|                 |                                                                                               |
| --------------- | --------------------------------------------------------------------------------------------- |
| **Data**        | Reports, reasons, moderation decisions, truncated IP addresses, audit log                     |
| **Purpose**     | Remove prohibited content, sanction abuse, account for our decisions                          |
| **Legal basis** | Legitimate interest in keeping the service safe; legal obligation for keeping certain records |

### Professional subscription

|                 |                                                                   |
| --------------- | ----------------------------------------------------------------- |
| **Data**        | Payment reference, amount, payment method, status, date, receipts |
| **Purpose**     | Process your payment and meet our accounting obligations          |
| **Legal basis** | Performance of the contract, then legal obligation for retention  |

We see neither your bank details nor your Mobile Money code: they are entered
at the payment provider, never with us.

### Emails

|                 |                                                                                                              |
| --------------- | ------------------------------------------------------------------------------------------------------------ |
| **Data**        | Email address, notification preferences                                                                      |
| **Purpose**     | Address verification, forgotten password, ad published or refused, new message received, subscription expiry |
| **Legal basis** | Performance of the contract for service messages; consent for the rest                                       |

**A new-message notification never contains the message.** We cannot read it,
and even if we could, we would not send it by email.

### Audience measurement

|                 |                                                                                   |
| --------------- | --------------------------------------------------------------------------------- |
| **Data**        | Page viewed, referring page, device type, country — with no persistent identifier |
| **Purpose**     | Understand how the site is used, to improve it                                    |
| **Legal basis** | Legitimate interest                                                               |

We use a **self-hosted solution that sets no cookies** and builds no individual
profile. The data stays on our servers and is sent to nobody.

### What we do not do

- No targeted advertising, no advertising profiling.
- No selling, renting or exchanging data.
- No automated decision producing legal effects concerning you: the filter that
  flags suspicious ads **orders a queue**, it decides no refusal. Every
  publication and every refusal is a human decision.
- No processing of special-category data under the GDPR.

## 3. Encrypted messaging: what we see and what we do not

This section describes how something works, because it shapes your rights.

Your messages are **end-to-end encrypted**. On your first sign-in on a device,
that device creates a key pair. The private key stays on your device; only the
public key is sent to our servers.

**What our servers hold:**

- your public key and its fingerprint;
- encrypted messages, as unreadable bytes;
- who wrote to whom, about which ad, on what date, and whether the message was
  read.

**What our servers do not hold:**

- the content of your messages, in any form, at any time;
- your private key;
- any means of reconstructing either.

This is not a promise not to look: we have **no technical ability** to do so.

### Backing up your key

You can back up your private key to restore it on another device. It is then
encrypted **on your device** with a key derived from a secret phrase you
choose. We receive only the encrypted result, never the phrase.

If you lose that phrase, we cannot help: messages already received become
permanently unreadable.

### Reporting a conversation

Since we cannot read your messages, we cannot review a report about a
conversation without your help. If you report a conversation, **your device
decrypts the messages concerned and sends them to us in the clear**, with your
explicit agreement. The interface tells you how many messages will be sent.
Nothing is sent without that agreement, which is timestamped.

Those disclosed messages are kept while the report is handled, then purged as
set out in section 4. They are erased when you delete your account.

### Judicial requests

If a competent judicial authority sends us a lawful request, we may hand over
the data we hold — that is, the metadata described above. **We cannot hand over
the content of your messages, because we do not have it.**

## 4. How long we keep your data

| Data                              | Retention                                                                    |
| --------------------------------- | ---------------------------------------------------------------------------- |
| Active account                    | As long as the account exists                                                |
| Inactive account                  | Warning after 2 years without sign-in, anonymised after 3 years              |
| Deleted account                   | Anonymised immediately; residual data actually deleted within 30 days        |
| Ad online                         | 60 days, renewable                                                           |
| Expired ad                        | 6 months after expiry, then deleted                                          |
| Ad deleted by its author          | 30 days, then deleted                                                        |
| Photographs not attached to an ad | 24 hours                                                                     |
| Encrypted messages                | Until your account is deleted                                                |
| Public keys                       | Until your account is deleted                                                |
| Encrypted private-key backup      | Until deleted by you, or with the account                                    |
| Messages disclosed in a report    | 2 years after the report is handled, or account deletion                     |
| Handled reports                   | 2 years                                                                      |
| Moderation audit log              | 5 years                                                                      |
| Revoked sessions                  | 90 days                                                                      |
| Verification and reset tokens     | 30 days                                                                      |
| Records of phone-number viewings  | 1 year                                                                       |
| Tracker consent records           | 3 years                                                                      |
| Read notifications                | 90 days                                                                      |
| Technical logs                    | 1 year                                                                       |
| **Payments and receipts**         | **10 years**, including after account deletion, under accounting obligations |

These periods are enforced by automated tasks, not merely written in this
document.

**Why messages are not purged after a year.** We chose to keep them until the
account is deleted rather than erasing them periodically. Reason: they are
encrypted and we cannot read them, so keeping them teaches us nothing and
exposes almost nothing in case of an incident — whereas erasing them would
deprive a seller of the history of an older transaction.

## 5. Who your data is shared with

We neither sell nor rent your data. We use technical providers, acting on our
behalf and on our instructions:

| Provider           | Role                                      | Data concerned                    | Country                       |
| ------------------ | ----------------------------------------- | --------------------------------- | ----------------------------- |
| {{hebergeur.nom}}  | Hosting the site and the database         | All                               | {{hebergeur.pays}}            |
| Cloudinary         | Storing and transforming ad photographs   | Photographs                       | United States, European Union |
| Resend             | Sending the service's emails              | Email address, message content    | United States                 |
| Maviance Smobilpay | Mobile Money payment for the subscription | Reference, amount, payer's number | Cameroon                      |
| Stripe             | Card payment for the subscription         | Reference, amount                 | United States, Ireland        |

The payment providers are involved only if you take out a professional
subscription. They collect your payment data directly, which we never see, and
are controllers in that respect.

We may also hand data to a competent judicial or administrative authority upon
a lawful request.

## 6. Transfers out of Cameroon

A point that runs against intuition: **our servers are located in
{{hebergeur.pays}}**. Under the GDPR, the data therefore stays within the
European Union and no transfer out of the Union takes place on that account.

Under **Law No. 2024/017**, however, this hosting does constitute a **transfer
of data out of Cameroon**. It is framed by the contract binding us to our host,
which is itself subject to the GDPR.

Some providers listed in section 5 are established in the United States. Those
transfers are framed by the European Commission's standard contractual clauses
or by the applicable adequacy mechanisms, depending on the provider.

You can ask us for a copy of the applicable safeguards by writing to
{{contact.donnees}}.

## 7. Your rights, and how to exercise them

You have the following rights:

- **Access**: know what data we hold about you and obtain a copy.
- **Rectification**: correct inaccurate data.
- **Erasure**: ask for your data to be deleted.
- **Objection**: object to processing based on our legitimate interest.
- **Restriction**: ask for processing to be frozen while something is checked.
- **Portability**: receive your data in a machine-readable format and pass it
  to another service.
- **Withdrawal of consent**: at any time, for processing that relies on it.
  Withdrawal does not affect what was done before.

### In practice, without writing to us

Two of these rights are exercised directly from the **"My data"** page of your
account, with no delay and no justification:

- **Export your data**: a JSON file containing all your data — account, ads,
  favourites, conversations, payments, acceptances of terms. This covers the
  rights of access and portability.
- **Delete your account**: immediate anonymisation of your profile, removal of
  your ads, erasure of your keys and encrypted messages. Only data we are
  legally required to keep is retained, for the period given in section 4.

### For the other rights

Write to **{{contact.donnees}}**. We answer within one month. If your request
is complex, we tell you about the extension and why.

We may ask you to confirm your identity if we have reasonable doubt, but we do
not ask for identity documents as a matter of course.

## 8. Security

Measures in place:

- passwords protected with **argon2id**; the plain password is never stored or
  logged;
- **end-to-end encryption** of messaging;
- encrypted connections (HTTPS) across the whole site;
- short-lived session tokens, rotated on each use, with replay detection;
- **no full IP address kept**: they are truncated before being recorded, in
  logs as in consent records;
- application logs containing no password, no token and no message content;
- **tamper-proof moderation audit log**: the database refuses any modification
  of an entry once written;
- encrypted backups and a documented restore procedure;
- back-office access limited to moderation and administration accounts, checked
  server-side on every request.

No system is invulnerable. In case of a data breach likely to create a high
risk to your rights, we inform you and the competent authorities within the
time limits set by the regulation.

## 9. Cookies

Inbox sets only **strictly necessary cookies**. No advertising cookies, no
third-party trackers, no external analytics scripts.

The detail is in the [cookie policy]({{site.url}}/legal/cookies).

## 10. Minors

The service is restricted to people aged 18 or over, which you declare when
registering.

We do not knowingly collect data about minors. If we learn that an account
belongs to a minor, it is closed and the associated data deleted. If you are
the legal guardian of a registered minor, write to {{contact.donnees}}: we will
act without delay.

## 11. Changes

This policy may change. Each version carries a number and an effective date,
and previous versions remain available on the site.

When a new version is published, it is shown to you on your next sign-in and
your acceptance is requested. We keep a record of what you accepted, with the
date and a truncated IP address.

## 12. Contacting us and complaining

For any question about your data: **{{contact.donnees}}**

If our answer does not satisfy you, you can refer the matter to a supervisory
authority:

- in Cameroon, the **Personal Data Protection Authority (APDP)**, established
  by Law No. 2024/017 of 23 December 2024;
- in the European Union, the **Commission nationale de l'informatique et des
  libertés (CNIL)**, the controller being established in France.

You may go to either one, without writing to us first.

---

Where the French and English versions of this policy differ, **the French
version prevails**.
