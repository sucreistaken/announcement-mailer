'use strict';

define('admin/plugins/announcement-mailer', ['settings', 'alerts'], function (Settings, alerts) {
	var ACP = {};
	var API = '';
	var LOG = '[announcement-mailer]';

	function log() {
		var args = Array.prototype.slice.call(arguments);
		args.unshift(LOG);
		console.log.apply(console, args);
	}
	function logErr() {
		var args = Array.prototype.slice.call(arguments);
		args.unshift(LOG);
		console.error.apply(console, args);
	}
	function logAjaxErr(label, x) {
		logErr(label + ' AJAX error', {
			status: x && x.status,
			statusText: x && x.statusText,
			responseJSON: x && x.responseJSON,
			responseText: x && x.responseText && String(x.responseText).slice(0, 500),
		});
	}

	function api(path) { return API + path; }
	function csrf() { return { 'x-csrf-token': config.csrf_token }; }

	ACP.init = function () {
		API = config.relative_path + '/api/admin/plugins/announcement-mailer';
		log('ACP.init başladı, API base:', API, '| CSRF token mevcut:', !!(window.config && config.csrf_token));

		// ========================
		// SETTINGS — websocket'e bağımlı olmayan HTTP load/save
		// ========================
		log('Settings yükleniyor (HTTP):', api('/settings'));
		loadSettingsHttp(function () {
			log('Settings yüklendi, otomatik grupları yüklüyorum');
			loadAutoGroups();
		});

		$('#save-settings').on('click', function () {
			log('save-settings tıklandı');
			var btn = $(this);
			btn.prop('disabled', true);

			var autoGroups = [];
			$('input.auto-group-checkbox:checked').each(function () { autoGroups.push($(this).val()); });
			$('[data-key="autoEmailGroups"]').val(JSON.stringify(autoGroups));

			// Form'daki tüm data-key alanlarını topla
			var payload = {};
			$('#announcement-mailer-settings [data-key]').each(function () {
				var key = $(this).attr('data-key');
				var val;
				if ($(this).is(':checkbox')) {
					val = $(this).is(':checked') ? 'on' : '';
				} else {
					val = $(this).val();
				}
				payload[key] = val;
			});
			log('POST /settings payload (' + Object.keys(payload).length + ' alan):',
				Object.keys(payload).reduce(function (acc, k) { acc[k] = (k === 'smtpPass' && payload[k]) ? '***' : payload[k]; return acc; }, {}));

			$.ajax({
				url: api('/settings'), method: 'POST', contentType: 'application/json', headers: csrf(),
				data: JSON.stringify({ settings: payload }),
				success: function (d) {
					log('Settings POST başarılı, DB döndü:',
						Object.keys(d.settings || {}).reduce(function (acc, k) { acc[k] = (k === 'smtpPass' && d.settings[k]) ? '***' : d.settings[k]; return acc; }, {}));
					alerts.alert({ type: 'success', title: 'Kaydedildi', message: 'Ayarlar kaydedildi.', timeout: 3000 });
				},
				error: function (x) {
					logAjaxErr('save-settings', x);
					alerts.alert({ type: 'danger', title: 'Hata', message: x.responseJSON?.error || 'Ayarlar kaydedilemedi.', timeout: 5000 });
				},
				complete: function () { btn.prop('disabled', false); },
			});
		});

		$('#test-connection').on('click', function () {
			log('test-connection tıklandı');
			var testEmail = prompt('Test email adresi:');
			if (!testEmail) { log('Test iptal edildi (email girilmedi)'); return; }
			var btn = $(this);
			btn.prop('disabled', true).html('<i class="fa fa-spinner fa-spin"></i>');
			log('SMTP test isteği gönderiliyor →', api('/test'), 'to', testEmail);
			$.ajax({
				url: api('/test'), method: 'POST', contentType: 'application/json', headers: csrf(),
				data: JSON.stringify({ testEmail: testEmail, subject: 'SMTP Test', templateHtml: '<p>SMTP test basarili. Tarih: {date}</p>' }),
				success: function (d) { log('SMTP test başarılı', d); alerts.alert({ type: 'success', title: 'Basarili', message: d.message, timeout: 5000 }); },
				error: function (x) { logAjaxErr('test-connection', x); alerts.alert({ type: 'danger', title: 'Hata', message: x.responseJSON?.error || 'Hata', timeout: 5000 }); },
				complete: function () { btn.prop('disabled', false).html('<i class="fa fa-plug"></i> SMTP Test'); },
			});
		});

		// ========================
		// COMPOSE
		// ========================
		loadGroups();
		loadTemplateSelect();

		$('#btn-load-template').on('click', function () {
			var name = $('#template-select').val();
			log('btn-load-template tıklandı, seçili template:', name);
			if (!name) return;
			$.get(api('/templates'), function (d) {
				log('Template listesi alındı, eşleşme aranıyor:', name, '| toplam:', (d.templates || []).length);
				var tpl = d.templates.find(function (t) { return t.name === name; });
				if (tpl) {
					$('#email-subject').val(tpl.subject || '');
					$('#email-html').val(tpl.html || '');
					alerts.alert({ type: 'info', title: 'Yuklendi', message: 'Template yuklendi.', timeout: 2000 });
				} else {
					logErr('Template bulunamadı:', name);
				}
			}).fail(function (x) { logAjaxErr('btn-load-template', x); });
		});

		// Preview with sandboxed iframe
		$('#btn-preview').on('click', function () {
			log('btn-preview tıklandı');
			var subject = $('#email-subject').val();
			var html = $('#email-html').val();
			$('#preview-subject').text('Subject: ' + subject);
			var frame = document.getElementById('preview-frame');
			if (!frame) { logErr('preview-frame elementi bulunamadı'); return; }
			var doc = frame.contentDocument || frame.contentWindow.document;
			doc.open();
			doc.write(html);
			doc.close();
			$('#preview-area').slideToggle(200);
		});

		$('#btn-test').on('click', function () {
			log('btn-test tıklandı');
			var testEmail = prompt('Test email adresi:');
			if (!testEmail) { log('Test iptal (email yok)'); return; }
			var subject = $('#email-subject').val().trim();
			var templateHtml = $('#email-html').val().trim();
			if (!subject || !templateHtml) { logErr('Subject veya body boş'); alerts.alert({ type: 'warning', message: 'Subject ve body doldurun.', timeout: 3000 }); return; }

			var btn = $(this);
			btn.prop('disabled', true).html('<i class="fa fa-spinner fa-spin"></i>');
			log('Test e-posta gönderiliyor →', testEmail);
			$.ajax({
				url: api('/test'), method: 'POST', contentType: 'application/json', headers: csrf(),
				data: JSON.stringify({ testEmail: testEmail, subject: subject, templateHtml: templateHtml }),
				success: function (d) { log('Test başarılı', d); alerts.alert({ type: 'success', message: d.message, timeout: 5000 }); },
				error: function (x) { logAjaxErr('btn-test', x); alerts.alert({ type: 'danger', message: x.responseJSON?.error || 'Hata', timeout: 5000 }); },
				complete: function () { btn.prop('disabled', false).html('<i class="fa fa-paper-plane"></i> Test Email'); },
			});
		});

		$('#btn-send').on('click', function () {
			log('btn-send tıklandı');
			var subject = $('#email-subject').val().trim();
			var templateHtml = $('#email-html').val().trim();
			var selectedGroups = [];
			$('input.group-checkbox:checked').each(function () { selectedGroups.push($(this).val()); });
			var scheduledAt = $('#scheduled-at').val();
			log('Gönderim parametreleri:', { subject: subject, htmlLen: templateHtml.length, groups: selectedGroups, scheduledAt: scheduledAt });

			if (!subject || !templateHtml || selectedGroups.length === 0) {
				logErr('Eksik alanlar - subject, body veya grup seçilmemiş');
				alerts.alert({ type: 'warning', message: 'Subject, body ve en az bir grup gerekli.', timeout: 3000 });
				return;
			}

			var schedMsg = scheduledAt ? '\nZamanlanmis: ' + new Date(scheduledAt).toLocaleString('tr-TR') : '';
			if (!confirm('Gondermek istediginizden emin misiniz?\n\nGruplar: ' + selectedGroups.join(', ') + schedMsg)) {
				log('Gönderim onayı reddedildi');
				return;
			}

			var btn = $(this);
			btn.prop('disabled', true).html('<i class="fa fa-spinner fa-spin"></i>');

			var payload = { subject: subject, templateHtml: templateHtml, groupNames: selectedGroups };
			if (scheduledAt) payload.scheduledAt = new Date(scheduledAt).getTime();
			log('POST /send payload (htmlLen=' + payload.templateHtml.length + ')');

			$.ajax({
				url: api('/send'), method: 'POST', contentType: 'application/json', headers: csrf(),
				data: JSON.stringify(payload),
				success: function (d) {
					log('Send başarıyla başlatıldı:', d);
					alerts.alert({ type: 'success', title: 'Baslatildi', message: d.message, timeout: 8000 });
					// Clear form
					$('#email-subject').val('');
					$('#email-html').val('');
					$('#scheduled-at').val('');
					$('input.group-checkbox').prop('checked', false);
					$('a[href="#tab-history"]').tab('show');
					loadHistory();
				},
				error: function (x) { logAjaxErr('btn-send', x); alerts.alert({ type: 'danger', message: x.responseJSON?.error || 'Hata', timeout: 5000 }); },
				complete: function () { btn.prop('disabled', false).html('<i class="fa fa-send"></i> Gonder'); },
			});
		});

		// ========================
		// TEMPLATES TAB
		// ========================
		$('a[href="#tab-templates"]').on('shown.bs.tab', function () { log('Templates tab açıldı'); loadTemplateList(); });

		$('#btn-save-template').on('click', function () {
			log('btn-save-template tıklandı');
			var name = $('#tpl-name').val().trim();
			var subject = $('#tpl-subject').val().trim();
			var html = $('#tpl-html').val().trim();
			if (!name || !html) { logErr('Template adı veya HTML boş'); alerts.alert({ type: 'warning', message: 'Ad ve HTML zorunlu.', timeout: 3000 }); return; }
			log('Template kaydediliyor:', name, '(htmlLen=' + html.length + ')');

			$.ajax({
				url: api('/templates'), method: 'POST', contentType: 'application/json', headers: csrf(),
				data: JSON.stringify({ name: name, subject: subject, html: html }),
				success: function (d) {
					log('Template kaydedildi:', d);
					alerts.alert({ type: 'success', message: d.message, timeout: 3000 });
					$('#tpl-name').val(''); $('#tpl-subject').val(''); $('#tpl-html').val('');
					loadTemplateList();
					loadTemplateSelect();
				},
				error: function (x) { logAjaxErr('btn-save-template', x); alerts.alert({ type: 'danger', message: x.responseJSON?.error || 'Hata', timeout: 3000 }); },
			});
		});

		// ========================
		// HISTORY TAB
		// ========================
		$('a[href="#tab-history"]').on('shown.bs.tab', function () { log('History tab açıldı'); loadHistory(); });
		$('#refresh-history').on('click', function () { log('refresh-history tıklandı'); loadHistory(); });

		// ========================
		// DELEGATED EVENT HANDLERS
		// ========================

		$(document).on('click', '.btn-approve-job', function () {
			var jobId = $(this).data('job-id');
			log('btn-approve-job tıklandı, jobId:', jobId);
			if (!confirm('Bu duyuru emailini onaylamak istiyor musunuz?')) { log('Onay reddedildi'); return; }
			var btn = $(this);
			btn.prop('disabled', true).html('<i class="fa fa-spinner fa-spin"></i>');
			$.ajax({
				url: api('/approve/' + jobId), method: 'POST', headers: csrf(),
				success: function (d) { log('Job onaylandı:', d); alerts.alert({ type: 'success', message: d.message, timeout: 5000 }); setTimeout(loadHistory, 1000); },
				error: function (x) { logAjaxErr('btn-approve-job', x); alerts.alert({ type: 'danger', message: x.responseJSON?.error || 'Hata', timeout: 3000 }); btn.prop('disabled', false).html('<i class="fa fa-check"></i> Onayla'); },
			});
		});

		$(document).on('click', '.btn-reject-job, .btn-cancel-job', function () {
			var jobId = $(this).data('job-id');
			log('btn-cancel/reject tıklandı, jobId:', jobId);
			if (!confirm('Iptal/reddetmek istiyor musunuz?')) { log('İptal reddedildi'); return; }
			$(this).prop('disabled', true);
			$.ajax({
				url: api('/cancel/' + jobId), method: 'POST', headers: csrf(),
				success: function (d) { log('Job iptal edildi:', d); setTimeout(loadHistory, 1000); },
				error: function (x) { logAjaxErr('btn-cancel-job', x); alerts.alert({ type: 'danger', message: x.responseJSON?.error || 'Hata', timeout: 3000 }); },
			});
		});

		$(document).on('click', '.btn-retry-job', function () {
			var jobId = $(this).data('job-id');
			log('btn-retry-job tıklandı, jobId:', jobId);
			if (!confirm('Basarisiz emailleri yeniden gondermek istiyor musunuz?')) { log('Retry reddedildi'); return; }
			$(this).prop('disabled', true);
			$.ajax({
				url: api('/retry/' + jobId), method: 'POST', headers: csrf(),
				success: function (d) { log('Retry başlatıldı:', d); alerts.alert({ type: 'success', message: d.message, timeout: 5000 }); setTimeout(loadHistory, 1000); },
				error: function (x) { logAjaxErr('btn-retry-job', x); alerts.alert({ type: 'danger', message: x.responseJSON?.error || 'Hata', timeout: 3000 }); },
			});
		});

		$(document).on('click', '.btn-delete-template', function () {
			var name = $(this).data('name');
			log('btn-delete-template tıklandı, name:', name);
			if (!confirm('Template "' + name + '" silinsin mi?')) { log('Silme reddedildi'); return; }
			$.ajax({
				url: api('/templates/' + encodeURIComponent(name)), method: 'DELETE', headers: csrf(),
				success: function () { log('Template silindi:', name); loadTemplateList(); loadTemplateSelect(); },
				error: function (x) { logAjaxErr('btn-delete-template', x); },
			});
		});

		log('ACP.init tamamlandı, tüm event handlerlar bağlandı.');
	};

	// ========================
	// HELPERS
	// ========================

	function loadSettingsHttp(done) {
		$.get(api('/settings'), function (d) {
			var settings = (d && d.settings) || {};
			log('GET /settings başarılı (' + Object.keys(settings).length + ' alan)');
			$('#announcement-mailer-settings [data-key]').each(function () {
				var key = $(this).attr('data-key');
				if (settings[key] === undefined || settings[key] === null) return;
				if ($(this).is(':checkbox')) {
					$(this).prop('checked', settings[key] === 'on' || settings[key] === true || settings[key] === '1');
				} else {
					$(this).val(settings[key]);
				}
			});
			if (typeof done === 'function') done();
		}).fail(function (x) {
			logAjaxErr('loadSettingsHttp', x);
			if (typeof done === 'function') done();
		});
	}

	function renderGroupCheckbox(containerSelector, cls, groupName, checked) {
		var safeId = cls + '-' + groupName.replace(/[^a-zA-Z0-9_-]/g, '_');
		var input = $('<input type="checkbox" class="form-check-input">')
			.addClass(cls)
			.attr('id', safeId)
			.val(groupName)
			.prop('checked', !!checked);
		var label = $('<label class="form-check-label">')
			.attr('for', safeId)
			.text(' ' + groupName);
		var wrap = $('<div class="form-check">').append(input).append(label);
		$(containerSelector).append(wrap);
	}

	function loadGroups() {
		log('loadGroups: GET', api('/groups'));
		$.get(api('/groups'), function (d) {
			log('loadGroups başarılı, grup sayısı:', (d.groups || []).length);
			$('#group-checkboxes').empty();
			(d.groups || []).forEach(function (g) {
				renderGroupCheckbox('#group-checkboxes', 'group-checkbox', g, false);
			});
		}).fail(function (x) { logAjaxErr('loadGroups', x); $('#group-checkboxes').html('<p class="text-danger">Yuklenemedi.</p>'); });
	}

	function loadAutoGroups() {
		log('loadAutoGroups: GET', api('/groups'));
		$.get(api('/groups'), function (d) {
			$('#auto-group-checkboxes').empty();
			var savedRaw = $('[data-key="autoEmailGroups"]').val() || '[]';
			var saved = [];
			try { saved = JSON.parse(savedRaw); } catch (e) { logErr('autoEmailGroups JSON parse hatası:', e, '| ham değer:', savedRaw); }
			log('loadAutoGroups: kayıtlı seçimler:', saved);

			(d.groups || []).forEach(function (g) {
				renderGroupCheckbox('#auto-group-checkboxes', 'auto-group-checkbox', g, saved.indexOf(g) >= 0);
			});
		}).fail(function (x) { logAjaxErr('loadAutoGroups', x); });
	}

	function loadTemplateSelect() {
		log('loadTemplateSelect: GET', api('/templates'));
		$.get(api('/templates'), function (d) {
			log('loadTemplateSelect başarılı, template sayısı:', (d.templates || []).length);
			var sel = $('#template-select').empty().append($('<option>').val('').text('-- Template sec --'));
			(d.templates || []).forEach(function (t) {
				sel.append($('<option>').val(t.name).text(t.name));
			});
		}).fail(function (x) { logAjaxErr('loadTemplateSelect', x); });
	}

	function loadTemplateList() {
		log('loadTemplateList: GET', api('/templates'));
		var container = $('#template-list');
		$.get(api('/templates'), function (d) {
			container.empty();
			if (!d.templates || d.templates.length === 0) {
				container.html('<p class="text-muted">Kayitli template yok.</p>');
				return;
			}
			log('loadTemplateList başarılı, template sayısı:', d.templates.length);
			d.templates.forEach(function (t) {
				var wrap = $('<div class="border rounded p-3 bg-body-tertiary mb-2 d-flex align-items-center justify-content-between gap-2">');
				var info = $('<div class="text-truncate">');
				info.append($('<strong>').text(t.name));
				if (t.subject) {
					info.append(' ').append($('<span class="text-muted">').text('— ' + t.subject));
				}
				wrap.append(info);
				wrap.append(
					$('<button class="btn btn-sm btn-danger btn-delete-template flex-shrink-0">')
						.attr('data-name', t.name)
						.html('<i class="fa fa-trash"></i>')
				);
				container.append(wrap);
			});
		}).fail(function (x) { logAjaxErr('loadTemplateList', x); container.html('<p class="text-danger">Yuklenemedi.</p>'); });
	}

	function loadHistory() {
		log('loadHistory: GET', api('/history'));
		var tbody = $('#history-body');
		tbody.html('<tr><td colspan="8" class="text-muted text-center"><i class="fa fa-spinner fa-spin"></i></td></tr>');

		$.get(api('/history'), function (d) {
			log('loadHistory başarılı, kayıt sayısı:', (d.history || []).length);
			tbody.empty();
			if (!d.history || d.history.length === 0) {
				tbody.html('<tr><td colspan="8" class="text-muted text-center">Gonderi yok.</td></tr>');
				return;
			}
			d.history.forEach(function (job) {
				var date = new Date(job.createdAt).toLocaleString('tr-TR');
				var groupsText = Array.isArray(job.groupNames) ? job.groupNames.join(', ') : '';
				var openRate = (job.openRate !== undefined && job.openRate !== null) ? job.openRate + '%' : '-';

				var row = $('<tr>');
				row.append($('<td>').text(date));
				row.append($('<td>').text(job.subject || '-'));
				row.append($('<td>').css('max-width', '150px').text(groupsText));
				row.append($('<td>').text(job.totalRecipients));
				row.append($('<td>').html('<span class="text-success">' + job.successCount + '</span> / <span class="text-danger">' + job.failCount + '</span>'));
				row.append($('<td>').text(openRate));
				row.append($('<td>').html(getStatusBadge(job)));
				row.append($('<td>').html(getActions(job)));
				tbody.append(row);
			});
		}).fail(function (x) { logAjaxErr('loadHistory', x); tbody.html('<tr><td colspan="8" class="text-danger text-center">Yuklenemedi.</td></tr>'); });
	}

	function getStatusBadge(job) {
		var map = {
			pending_approval: '<span class="badge text-bg-warning"><i class="fa fa-bell"></i> Onay Bekliyor</span>',
			scheduled: '<span class="badge text-bg-info"><i class="fa fa-clock-o"></i> Zamanlanmis</span>',
			queued: '<span class="badge text-bg-secondary">Kuyrukta</span>',
			sending: '<span class="badge text-bg-info"><i class="fa fa-spinner fa-spin"></i> ' + job.progress + '/' + job.totalRecipients + '</span>',
			completed: '<span class="badge text-bg-success">Tamamlandi</span>',
			cancelled: '<span class="badge text-bg-warning">Iptal</span>',
			interrupted: '<span class="badge text-bg-danger">Kesildi</span>',
		};
		return map[job.status] || '<span class="badge text-bg-secondary">' + job.status + '</span>';
	}

	function getActions(job) {
		var a = '';
		if (job.status === 'pending_approval') {
			a += '<button class="btn btn-sm btn-success btn-approve-job" data-job-id="' + job.jobId + '"><i class="fa fa-check"></i></button> ';
			a += '<button class="btn btn-sm btn-danger btn-reject-job" data-job-id="' + job.jobId + '"><i class="fa fa-times"></i></button> ';
		}
		if (job.status === 'sending') {
			a += '<button class="btn btn-sm btn-danger btn-cancel-job" data-job-id="' + job.jobId + '"><i class="fa fa-stop"></i></button> ';
		}
		if (job.status === 'scheduled') {
			a += '<button class="btn btn-sm btn-danger btn-cancel-job" data-job-id="' + job.jobId + '"><i class="fa fa-times"></i></button> ';
		}
		if ((job.status === 'completed' || job.status === 'interrupted') && job.failCount > 0) {
			a += '<button class="btn btn-sm btn-warning btn-retry-job" data-job-id="' + job.jobId + '"><i class="fa fa-repeat"></i> ' + job.failCount + '</button> ';
		}
		return a || '-';
	}

	return ACP;
});
