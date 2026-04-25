# Announcement Mailer

NodeBB plugin to send bulk announcement emails to user groups from the admin panel.

## What it does

- ACP page where you pick groups, write an HTML template, hit send
- Send now or schedule for later
- Auto-create a draft email when a topic is posted in a configured category (sent after admin approval)
- Test send to a single address before blasting the list
- Unsubscribe link + `List-Unsubscribe` header
- Tracking pixel for open rate
- Hard bounces are added to a bounce list and skipped on subsequent sends
- Retry failed deliveries
- Template library (save and reuse)
- History view with per-job progress, success/fail counts, remaining queue size

## Install

In your NodeBB directory:

```
npm install nodebb-plugin-announcement-mailer
./nodebb activate nodebb-plugin-announcement-mailer
./nodebb build
./nodebb restart
```

For local development, `npm link` inside the plugin folder, then `npm link nodebb-plugin-announcement-mailer` from NodeBB.

Tested on NodeBB v4.x.

## SMTP settings

ACP > Plugins > Announcement Mailer:

- `smtpHost`, `smtpPort` (587 or 465), `smtpUser`, `smtpPass`
- `smtpFrom` (falls back to `smtpUser`)
- `batchSize` (default 10), `batchDelay` ms (default 2000), `emailDelay` ms (default 200)
- `maxRetries` (default 3)

Tune the batch values to your provider's rate limit. Don't try to push thousands of emails through Gmail or Outlook — your account will get throttled or your mail will end up in spam. Use a transactional provider (SendGrid, Mailgun, SES, Postmark, etc).

Send a `/test` email to yourself first and check the rendered output before running a real campaign.

## Auto announcements

If you set `announcementCategoryId`, a draft email is created whenever a new topic is posted in that category. Admins get a notification and the mail won't go out until someone approves it from the ACP. You can also cancel it from there.

Related settings:
- `autoEmailGroups` — recipient groups
- `autoEmailSubject` — defaults to `Yeni Duyuru: {topicTitle}`
- `autoEmailTemplate` — body HTML

Placeholders available in templates: `{topicTitle}`, `{topicUrl}`, `{topicContent}`, `{authorName}`, `{username}`, `{email}`, `{unsubscribeUrl}`.

Topic content is HTML-escaped before being injected, so user-supplied markup won't break the template.

## Things to know

- If NodeBB restarts mid-send, the job is marked `interrupted`. The queue still lives in the DB but it isn't auto-resumed. Retry only re-sends the `failures` list, not addresses still sitting in the queue. Worth keeping in mind for 8k+ sends.
- Transporter pool size is 3, connections recycle every 50 messages.
- The tracking pixel is a plain GIF — image proxies and blockers will hide it, so the open rate underreports.
- Jobs are guarded by a `jobLock` mutex; two admins can't retry/cancel/approve the same job at the same time.

## License

MIT
