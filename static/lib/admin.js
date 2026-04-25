'use strict';

define('admin/plugins/announcement-mailer', ['settings', 'alerts'], function (Settings, alerts) {
	var ACP = {};
	var API = '';

	function api(path) { return API + path; }
	function csrf() { return { 'x-csrf-token': config.csrf_token }; }

	ACP.init = function () {
		API = config.relative_path + '/api/admin/plugins/announcement-mailer';

		// ========================
		// SETTINGS
		// ========================
		Settings.load('announcement-mailer', $('#announcement-mailer-settings'), function () {
			loadAutoGroups();
		});

		$('#save-settings').on('click', function () {
			var btn = $(this);
			btn.prop('disabled', true);

			var autoGroups = [];
			$('input.auto-group-checkbox:checked').each(function () { autoGroups.push($(this).val()); });
			$('[data-key="autoEmailGroups"]').val(JSON.stringify(autoGroups));

			Settings.save('announcement-mailer', $('#announcement-mailer-settings'), function () {
				btn.prop('disabled', false);
				alerts.alert({ type: 'success', title: 'Kaydedildi', message: 'Ayarlar kaydedildi.', timeout: 3000 });
			});
		});

		$('#test-connection').on('click', function () {
			var testEmail = prompt('Test email adresi:');
			if (!testEmail) return;
			var btn = $(this);
			btn.prop('disabled', true).html('<i class="fa fa-spinner fa-spin"></i>');
			$.ajax({
				url: api('/test'), method: 'POST', contentType: 'application/json', headers: csrf(),
				data: JSON.stringify({ testEmail: testEmail, subject: 'SMTP Test', templateHtml: '<p>SMTP test basarili. Tarih: {date}</p>' }),
				success: function (d) { alerts.alert({ type: 'success', title: 'Basarili', message: d.message, timeout: 5000 }); },
				error: function (x) { alerts.alert({ type: 'danger', title: 'Hata', message: x.responseJSON?.error || 'Hata', timeout: 5000 }); },
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
			if (!name) return;
			$.get(api('/templates'), function (d) {
				var tpl = d.templates.find(function (t) { return t.name === name; });
				if (tpl) {
					$('#email-subject').val(tpl.subject || '');
					$('#email-html').val(tpl.html || '');
					alerts.alert({ type: 'info', title: 'Yuklendi', message: 'Template yuklendi.', timeout: 2000 });
				}
			});
		});

		// Preview with sandboxed iframe
		$('#btn-preview').on('click', function () {
			var subject = $('#email-subject').val();
			var html = $('#email-html').val();
			$('#preview-subject').text('Subject: ' + subject);
			var frame = document.getElementById('preview-frame');
			var doc = frame.contentDocument || frame.contentWindow.document;
			doc.open();
			doc.write(html);
			doc.close();
			$('#preview-area').slideToggle(200);
		});

		$('#btn-test').on('click', function () {
			var testEmail = prompt('Test email adresi:');
			if (!testEmail) return;
			var subject = $('#email-subject').val().trim();
			var templateHtml = $('#email-html').val().trim();
			if (!subject || !templateHtml) { alerts.alert({ type: 'warning', message: 'Subject ve body doldurun.', timeout: 3000 }); return; }

			var btn = $(this);
			btn.prop('disabled', true).html('<i class="fa fa-spinner fa-spin"></i>');
			$.ajax({
				url: api('/test'), method: 'POST', contentType: 'application/json', headers: csrf(),
				data: JSON.stringify({ testEmail: testEmail, subject: subject, templateHtml: templateHtml }),
				success: function (d) { alerts.alert({ type: 'success', message: d.message, timeout: 5000 }); },
				error: function (x) { alerts.alert({ type: 'danger', message: x.responseJSON?.error || 'Hata', timeout: 5000 }); },
				complete: function () { btn.prop('disabled', false).html('<i class="fa fa-paper-plane"></i> Test Email'); },
			});
		});

		$('#btn-send').on('click', function () {
			var subject = $('#email-subject').val().trim();
			var templateHtml = $('#email-html').val().trim();
			var selectedGroups = [];
			$('input.group-checkbox:checked').each(function () { selectedGroups.push($(this).val()); });
			var scheduledAt = $('#scheduled-at').val();

			if (!subject || !templateHtml || selectedGroups.length === 0) {
				alerts.alert({ type: 'warning', message: 'Subject, body ve en az bir grup gerekli.', timeout: 3000 });
				return;
			}

			var schedMsg = scheduledAt ? '\nZamanlanmis: ' + new Date(scheduledAt).toLocaleString('tr-TR') : '';
			if (!confirm('Gondermek istediginizden emin misiniz?\n\nGruplar: ' + selectedGroups.join(', ') + schedMsg)) return;

			var btn = $(this);
			btn.prop('disabled', true).html('<i class="fa fa-spinner fa-spin"></i>');

			var payload = { subject: subject, templateHtml: templateHtml, groupNames: selectedGroups };
			if (scheduledAt) payload.scheduledAt = new Date(scheduledAt).getTime();

			$.ajax({
				url: api('/send'), method: 'POST', contentType: 'application/json', headers: csrf(),
				data: JSON.stringify(payload),
				success: function (d) {
					alerts.alert({ type: 'success', title: 'Baslatildi', message: d.message, timeout: 8000 });
					// Clear form
					$('#email-subject').val('');
					$('#email-html').val('');
					$('#scheduled-at').val('');
					$('input.group-checkbox').prop('checked', false);
					$('a[href="#tab-history"]').tab('show');
					loadHistory();
				},
				error: function (x) { alerts.alert({ type: 'danger', message: x.responseJSON?.error || 'Hata', timeout: 5000 }); },
				complete: function () { btn.prop('disabled', false).html('<i class="fa fa-send"></i> Gonder'); },
			});
		});

		// ========================
		// TEMPLATES TAB
		// ========================
		$('a[href="#tab-templates"]').on('shown.bs.tab', loadTemplateList);

		$('#btn-save-template').on('click', function () {
			var name = $('#tpl-name').val().trim();
			var subject = $('#tpl-subject').val().trim();
			var html = $('#tpl-html').val().trim();
			if (!name || !html) { alerts.alert({ type: 'warning', message: 'Ad ve HTML zorunlu.', timeout: 3000 }); return; }

			$.ajax({
				url: api('/templates'), method: 'POST', contentType: 'application/json', headers: csrf(),
				data: JSON.stringify({ name: name, subject: subject, html: html }),
				success: function (d) {
					alerts.alert({ type: 'success', message: d.message, timeout: 3000 });
					$('#tpl-name').val(''); $('#tpl-subject').val(''); $('#tpl-html').val('');
					loadTemplateList();
					loadTemplateSelect();
				},
				error: function (x) { alerts.alert({ type: 'danger', message: x.responseJSON?.error || 'Hata', timeout: 3000 }); },
			});
		});

		// ========================
		// HISTORY TAB
		// ========================
		$('a[href="#tab-history"]').on('shown.bs.tab', loadHistory);
		$('#refresh-history').on('click', loadHistory);

		// ========================
		// DELEGATED EVENT HANDLERS
		// ========================

		$(document).on('click', '.btn-approve-job', function () {
			var jobId = $(this).data('job-id');
			if (!confirm('Bu duyuru emailini onaylamak istiyor musunuz?')) return;
			var btn = $(this);
			btn.prop('disabled', true).html('<i class="fa fa-spinner fa-spin"></i>');
			$.ajax({
				url: api('/approve/' + jobId), method: 'POST', headers: csrf(),
				success: function (d) { alerts.alert({ type: 'success', message: d.message, timeout: 5000 }); setTimeout(loadHistory, 1000); },
				error: function (x) { alerts.alert({ type: 'danger', message: x.responseJSON?.error || 'Hata', timeout: 3000 }); btn.prop('disabled', false).html('<i class="fa fa-check"></i> Onayla'); },
			});
		});

		$(document).on('click', '.btn-reject-job, .btn-cancel-job', function () {
			var jobId = $(this).data('job-id');
			if (!confirm('Iptal/reddetmek istiyor musunuz?')) return;
			$(this).prop('disabled', true);
			$.ajax({
				url: api('/cancel/' + jobId), method: 'POST', headers: csrf(),
				success: function () { setTimeout(loadHistory, 1000); },
				error: function (x) { alerts.alert({ type: 'danger', message: x.responseJSON?.error || 'Hata', timeout: 3000 }); },
			});
		});

		$(document).on('click', '.btn-retry-job', function () {
			var jobId = $(this).data('job-id');
			if (!confirm('Basarisiz emailleri yeniden gondermek istiyor musunuz?')) return;
			$(this).prop('disabled', true);
			$.ajax({
				url: api('/retry/' + jobId), method: 'POST', headers: csrf(),
				success: function (d) { alerts.alert({ type: 'success', message: d.message, timeout: 5000 }); setTimeout(loadHistory, 1000); },
				error: function (x) { alerts.alert({ type: 'danger', message: x.responseJSON?.error || 'Hata', timeout: 3000 }); },
			});
		});

		$(document).on('click', '.btn-delete-template', function () {
			var name = $(this).data('name');
			if (!confirm('Template "' + name + '" silinsin mi?')) return;
			$.ajax({
				url: api('/templates/' + encodeURIComponent(name)), method: 'DELETE', headers: csrf(),
				success: function () { loadTemplateList(); loadTemplateSelect(); },
			});
		});
	};

	// ========================
	// HELPERS
	// ========================

	function renderGroupCheckbox(containerSelector, cls, groupName, checked) {
		var input = $('<input type="checkbox">').addClass(cls).val(groupName).prop('checked', !!checked);
		var label = $('<label>').append(input).append(document.createTextNode(' ' + groupName));
		var wrap = $('<div class="checkbox">').css('margin', '2px 0').append(label);
		$(containerSelector).append(wrap);
	}

	function loadGroups() {
		$.get(api('/groups'), function (d) {
			$('#group-checkboxes').empty();
			(d.groups || []).forEach(function (g) {
				renderGroupCheckbox('#group-checkboxes', 'group-checkbox', g, false);
			});
		}).fail(function () { $('#group-checkboxes').html('<p class="text-danger">Yuklenemedi.</p>'); });
	}

	function loadAutoGroups() {
		$.get(api('/groups'), function (d) {
			$('#auto-group-checkboxes').empty();
			var savedRaw = $('[data-key="autoEmailGroups"]').val() || '[]';
			var saved = [];
			try { saved = JSON.parse(savedRaw); } catch (e) {}

			(d.groups || []).forEach(function (g) {
				renderGroupCheckbox('#auto-group-checkboxes', 'auto-group-checkbox', g, saved.indexOf(g) >= 0);
			});
		});
	}

	function loadTemplateSelect() {
		$.get(api('/templates'), function (d) {
			var sel = $('#template-select').empty().append($('<option>').val('').text('-- Template sec --'));
			(d.templates || []).forEach(function (t) {
				sel.append($('<option>').val(t.name).text(t.name));
			});
		});
	}

	function loadTemplateList() {
		var container = $('#template-list');
		$.get(api('/templates'), function (d) {
			container.empty();
			if (!d.templates || d.templates.length === 0) {
				container.html('<p class="text-muted">Kayitli template yok.</p>');
				return;
			}
			d.templates.forEach(function (t) {
				var wrap = $('<div class="well well-sm" style="margin-bottom:8px;">');
				wrap.append($('<strong>').text(t.name));
				if (t.subject) {
					wrap.append(' ').append($('<span class="text-muted">').text('— ' + t.subject));
				}
				wrap.append(
					$('<button class="btn btn-xs btn-danger pull-right btn-delete-template">')
						.attr('data-name', t.name)
						.html('<i class="fa fa-trash"></i>')
				);
				wrap.append('<div class="clearfix"></div>');
				container.append(wrap);
			});
		});
	}

	function loadHistory() {
		var tbody = $('#history-body');
		tbody.html('<tr><td colspan="8" class="text-muted text-center"><i class="fa fa-spinner fa-spin"></i></td></tr>');

		$.get(api('/history'), function (d) {
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
		});
	}

	function getStatusBadge(job) {
		var map = {
			pending_approval: '<span class="label label-warning"><i class="fa fa-bell"></i> Onay Bekliyor</span>',
			scheduled: '<span class="label label-info"><i class="fa fa-clock-o"></i> Zamanlanmis</span>',
			queued: '<span class="label label-default">Kuyrukta</span>',
			sending: '<span class="label label-info"><i class="fa fa-spinner fa-spin"></i> ' + job.progress + '/' + job.totalRecipients + '</span>',
			completed: '<span class="label label-success">Tamamlandi</span>',
			cancelled: '<span class="label label-warning">Iptal</span>',
			interrupted: '<span class="label label-danger">Kesildi</span>',
		};
		return map[job.status] || '<span class="label label-default">' + job.status + '</span>';
	}

	function getActions(job) {
		var a = '';
		if (job.status === 'pending_approval') {
			a += '<button class="btn btn-xs btn-success btn-approve-job" data-job-id="' + job.jobId + '"><i class="fa fa-check"></i></button> ';
			a += '<button class="btn btn-xs btn-danger btn-reject-job" data-job-id="' + job.jobId + '"><i class="fa fa-times"></i></button> ';
		}
		if (job.status === 'sending') {
			a += '<button class="btn btn-xs btn-danger btn-cancel-job" data-job-id="' + job.jobId + '"><i class="fa fa-stop"></i></button> ';
		}
		if (job.status === 'scheduled') {
			a += '<button class="btn btn-xs btn-danger btn-cancel-job" data-job-id="' + job.jobId + '"><i class="fa fa-times"></i></button> ';
		}
		if ((job.status === 'completed' || job.status === 'interrupted') && job.failCount > 0) {
			a += '<button class="btn btn-xs btn-warning btn-retry-job" data-job-id="' + job.jobId + '"><i class="fa fa-repeat"></i> ' + job.failCount + '</button> ';
		}
		return a || '-';
	}

	return ACP;
});
