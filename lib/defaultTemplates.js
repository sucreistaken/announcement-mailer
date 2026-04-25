'use strict';

// Preset email templates that ship with the plugin. Each template is seeded
// into the database on first plugin start. A per-name "seeded" flag prevents
// re-creating one the user has explicitly deleted.
//
// Designed for cross-client compatibility: table-based layouts, inline CSS,
// safe color palette, no <style> blocks, no external CSS, no images that
// require a CDN. Placeholders supported by emailRenderer:
//   {username} {email} {siteName} {siteUrl} {date} {unsubscribeUrl}
// Plus auto-announcement extras handled by onTopicPost in library.js:
//   {topicTitle} {topicUrl} {topicContent} {authorName}

const FOOTER = `
		<tr>
			<td style="padding:24px 32px;background:#f6f8fa;border-top:1px solid #e5e7eb;text-align:center;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:12px;color:#6b7280;line-height:1.6;">
				<div style="margin-bottom:8px;">Bu e-posta {siteName} tarafından <strong>{email}</strong> adresine gönderildi.</div>
				<div><a href="{unsubscribeUrl}" style="color:#6b7280;text-decoration:underline;">E-posta aboneliğinden çık</a> &nbsp;·&nbsp; <a href="{siteUrl}" style="color:#6b7280;text-decoration:underline;">{siteName}</a></div>
			</td>
		</tr>`;

function shell(headerHtml, bodyHtml, accent) {
	const accentColor = accent || '#0d6efd';
	return `<!doctype html>
<html lang="tr">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f6;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 16px;">
	<tr><td align="center">
		<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.05);">
			<tr>
				<td style="padding:32px;background:${accentColor};color:#ffffff;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
					${headerHtml}
				</td>
			</tr>
			<tr>
				<td style="padding:32px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.65;color:#1f2937;">
					${bodyHtml}
				</td>
			</tr>
			${FOOTER}
		</table>
	</td></tr>
</table>
</body></html>`;
}

const TEMPLATES = [
	{
		name: 'duyuru-genel',
		subject: '{siteName} - Önemli Duyuru',
		html: shell(
			`<div style="font-size:13px;text-transform:uppercase;letter-spacing:1px;opacity:0.85;">{siteName}</div>
			<h1 style="margin:8px 0 0;font-size:24px;font-weight:700;">Önemli Duyuru</h1>`,
			`<p style="margin:0 0 16px;">Merhaba <strong>{username}</strong>,</p>
			<p style="margin:0 0 16px;">Buraya duyuru metnini yazın. Birden fazla paragraf, liste, bağlantı kullanabilirsiniz.</p>
			<p style="margin:0 0 24px;">Detaylar için forumu ziyaret edebilirsiniz.</p>
			<table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="border-radius:6px;background:#0d6efd;">
				<a href="{siteUrl}" style="display:inline-block;padding:12px 24px;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;">Foruma Git</a>
			</td></tr></table>
			<p style="margin:24px 0 0;color:#6b7280;font-size:13px;">{date}</p>`,
			'#0d6efd'
		),
	},
	{
		name: 'etkinlik-davet',
		subject: 'Etkinlik Daveti: [Etkinlik Adı]',
		html: shell(
			`<div style="font-size:13px;text-transform:uppercase;letter-spacing:1px;opacity:0.85;">Etkinlik</div>
			<h1 style="margin:8px 0 0;font-size:24px;font-weight:700;">Sizi etkinliğimize davet ediyoruz</h1>`,
			`<p style="margin:0 0 16px;">Sayın <strong>{username}</strong>,</p>
			<p style="margin:0 0 24px;">[Etkinlik açıklaması buraya gelecek.]</p>
			<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 24px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;">
				<tr><td style="padding:16px 20px;">
					<div style="font-size:13px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">Tarih</div>
					<div style="font-size:16px;font-weight:600;color:#111827;">[Tarih ve saat]</div>
				</td></tr>
				<tr><td style="padding:16px 20px;border-top:1px solid #e5e7eb;">
					<div style="font-size:13px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">Yer</div>
					<div style="font-size:16px;font-weight:600;color:#111827;">[Konum]</div>
				</td></tr>
			</table>
			<table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="border-radius:6px;background:#10b981;">
				<a href="{siteUrl}" style="display:inline-block;padding:12px 24px;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;">Detayları Gör</a>
			</td></tr></table>`,
			'#10b981'
		),
	},
	{
		name: 'bakim-bildirimi',
		subject: 'Planlı Bakım Bildirimi - {siteName}',
		html: shell(
			`<div style="font-size:13px;text-transform:uppercase;letter-spacing:1px;opacity:0.85;">Sistem Bildirimi</div>
			<h1 style="margin:8px 0 0;font-size:24px;font-weight:700;">Planlı Bakım</h1>`,
			`<p style="margin:0 0 16px;">Merhaba <strong>{username}</strong>,</p>
			<p style="margin:0 0 16px;">{siteName} platformunda planlı bir bakım çalışması yapılacaktır. Bakım süresince siteye erişim kısa süreli olarak kesintiye uğrayabilir.</p>
			<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:16px 0;background:#fff7ed;border-left:3px solid #f59e0b;border-radius:6px;">
				<tr><td style="padding:16px 20px;color:#92400e;">
					<strong>Tarih:</strong> [Bakım tarihi]<br>
					<strong>Süre:</strong> [Tahmini süre]<br>
					<strong>Etki:</strong> [Etkilenecek hizmetler]
				</td></tr>
			</table>
			<p style="margin:0 0 16px;">Anlayışınız için teşekkür ederiz.</p>
			<p style="margin:0;">— {siteName} Ekibi</p>`,
			'#f59e0b'
		),
	},
	{
		name: 'hosgeldin',
		subject: '{siteName} ailesine hoş geldiniz!',
		html: shell(
			`<div style="font-size:13px;text-transform:uppercase;letter-spacing:1px;opacity:0.85;">Hoş Geldiniz</div>
			<h1 style="margin:8px 0 0;font-size:24px;font-weight:700;">Aramıza katıldığın için teşekkürler!</h1>`,
			`<p style="margin:0 0 16px;">Merhaba <strong>{username}</strong>,</p>
			<p style="margin:0 0 16px;">{siteName} topluluğuna katıldığın için heyecanlıyız. Forumda yapabileceklerinden bazıları:</p>
			<ul style="margin:0 0 24px;padding-left:20px;">
				<li style="margin-bottom:8px;">İlgi alanlarına göre kategorileri keşfet</li>
				<li style="margin-bottom:8px;">Sorularını sor, deneyimini paylaş</li>
				<li style="margin-bottom:8px;">Diğer üyelerle bağlantı kur</li>
				<li style="margin-bottom:8px;">Bildirim ayarlarını profilinden yönet</li>
			</ul>
			<table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="border-radius:6px;background:#8b5cf6;">
				<a href="{siteUrl}" style="display:inline-block;padding:12px 24px;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;">Foruma Başla</a>
			</td></tr></table>
			<p style="margin:24px 0 0;color:#6b7280;font-size:13px;">Sorularınız için her zaman buradayız.</p>`,
			'#8b5cf6'
		),
	},
	{
		name: 'yeni-konu',
		subject: 'Yeni Duyuru: {topicTitle}',
		html: shell(
			`<div style="font-size:13px;text-transform:uppercase;letter-spacing:1px;opacity:0.85;">Yeni Duyuru</div>
			<h1 style="margin:8px 0 0;font-size:22px;font-weight:700;line-height:1.3;">{topicTitle}</h1>`,
			`<p style="margin:0 0 16px;">Merhaba <strong>{username}</strong>,</p>
			<p style="margin:0 0 16px;">{siteName} forumunda yeni bir duyuru yayınlandı.</p>
			<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:16px 0;background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;">
				<tr><td style="padding:20px;color:#374151;font-size:14px;line-height:1.6;">
					{topicContent}
				</td></tr>
			</table>
			<p style="margin:0 0 16px;color:#6b7280;font-size:13px;">Yazan: <strong>{authorName}</strong></p>
			<table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="border-radius:6px;background:#0d6efd;">
				<a href="{topicUrl}" style="display:inline-block;padding:12px 24px;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;">Duyuruyu Oku</a>
			</td></tr></table>`,
			'#0d6efd'
		),
	},
	{
		name: 'haftalik-bulten',
		subject: '{siteName} Haftalık Bülten',
		html: shell(
			`<div style="font-size:13px;text-transform:uppercase;letter-spacing:1px;opacity:0.85;">Haftalık Bülten</div>
			<h1 style="margin:8px 0 0;font-size:24px;font-weight:700;">Bu hafta forumda neler oldu?</h1>`,
			`<p style="margin:0 0 16px;">Merhaba <strong>{username}</strong>,</p>
			<p style="margin:0 0 24px;">İşte bu haftanın öne çıkan konuları:</p>

			<h3 style="margin:0 0 8px;font-size:16px;color:#111827;">[Konu Başlığı 1]</h3>
			<p style="margin:0 0 16px;color:#4b5563;">[Kısa özet veya konunun ilk birkaç satırı...]</p>
			<a href="{siteUrl}" style="color:#0d6efd;text-decoration:none;font-weight:600;">Devamını oku →</a>

			<hr style="border:0;border-top:1px solid #e5e7eb;margin:24px 0;">

			<h3 style="margin:0 0 8px;font-size:16px;color:#111827;">[Konu Başlığı 2]</h3>
			<p style="margin:0 0 16px;color:#4b5563;">[Kısa özet...]</p>
			<a href="{siteUrl}" style="color:#0d6efd;text-decoration:none;font-weight:600;">Devamını oku →</a>

			<hr style="border:0;border-top:1px solid #e5e7eb;margin:24px 0;">

			<p style="margin:0;text-align:center;">
				<a href="{siteUrl}" style="color:#6b7280;font-size:13px;">Tüm konuları forumda görün →</a>
			</p>`,
			'#0d6efd'
		),
	},
];

module.exports = { TEMPLATES };
