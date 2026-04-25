<div class="acp-page-container">
	<!-- IMPORT admin/partials/settings/header.tpl -->

	<div class="row m-0">
		<div id="spy-container" class="col-12 px-0 mb-4" tabindex="0">

			<!-- Hero Header -->
			<div class="d-flex align-items-center gap-3 mb-4 pb-3 border-bottom">
				<div class="d-flex align-items-center justify-content-center rounded-3" style="width:48px;height:48px;background:linear-gradient(135deg,#0d6efd 0%,#6ea8fe 100%);">
					<i class="fa fa-envelope" style="font-size:22px;color:#fff;"></i>
				</div>
				<div>
					<h4 class="fw-bold mb-0">Announcement Mailer</h4>
					<p class="text-muted mb-0" style="font-size:13px;">Secilen kullanici gruplarina toplu email gonderin.</p>
				</div>
			</div>

			<!-- Tabs -->
			<ul class="nav nav-tabs mb-3" id="mailer-tabs" role="tablist">
				<li class="nav-item" role="presentation">
					<a class="nav-link active" data-bs-toggle="tab" href="#tab-compose" role="tab"><i class="fa fa-pencil me-1"></i> Compose</a>
				</li>
				<li class="nav-item" role="presentation">
					<a class="nav-link" data-bs-toggle="tab" href="#tab-templates" role="tab"><i class="fa fa-file-text me-1"></i> Templates</a>
				</li>
				<li class="nav-item" role="presentation">
					<a class="nav-link" data-bs-toggle="tab" href="#tab-settings" role="tab"><i class="fa fa-cog me-1"></i> Settings</a>
				</li>
				<li class="nav-item" role="presentation">
					<a class="nav-link" data-bs-toggle="tab" href="#tab-history" role="tab"><i class="fa fa-history me-1"></i> History</a>
				</li>
			</ul>

			<div class="tab-content">

				<!-- ===================== COMPOSE TAB ===================== -->
				<div id="tab-compose" class="tab-pane fade show active" role="tabpanel">
					<div class="card border-0 shadow-sm">
						<div class="card-header bg-transparent border-bottom d-flex align-items-center gap-2 py-3">
							<i class="fa fa-envelope text-muted"></i>
							<h6 class="fw-semibold mb-0">Compose Announcement</h6>
						</div>
						<div class="card-body">

							<div class="mb-3">
								<label class="form-label fw-medium">Template Yukle</label>
								<div class="input-group">
									<select id="template-select" class="form-select">
										<option value="">-- Template sec --</option>
									</select>
									<button id="btn-load-template" class="btn btn-outline-secondary" type="button"><i class="fa fa-download me-1"></i> Yukle</button>
								</div>
							</div>

							<div class="mb-3">
								<label class="form-label fw-medium" for="email-subject">Subject</label>
								<input type="text" id="email-subject" class="form-control" placeholder="Ornek: Onemli Duyuru" required>
							</div>

							<div class="mb-3">
								<label class="form-label fw-medium" for="email-html">Email Body (HTML)</label>
								<textarea id="email-html" class="form-control" rows="14" placeholder="HTML icerik yazin..." required></textarea>
								<div class="form-text">
									Placeholder'lar:
									<code>{username}</code> <code>{email}</code> <code>{siteName}</code> <code>{siteUrl}</code> <code>{date}</code> <code>{unsubscribeUrl}</code>
								</div>
							</div>

							<div class="mb-3">
								<label class="form-label fw-medium">Hedef Gruplar</label>
								<div id="group-checkboxes" class="border rounded p-3 bg-body-tertiary" style="max-height: 250px; overflow-y: auto;">
									<p class="text-muted mb-0"><i class="fa fa-spinner fa-spin me-1"></i> Gruplar yukleniyor...</p>
								</div>
							</div>

							<div class="mb-3">
								<label class="form-label fw-medium" for="scheduled-at"><i class="fa fa-clock-o me-1"></i> Zamanlanmis Gonderim (istege bagli)</label>
								<input type="datetime-local" id="scheduled-at" class="form-control" style="max-width: 300px;">
								<div class="form-text">Bos birakirsaniz hemen gonderilir.</div>
							</div>

							<div class="d-flex flex-wrap gap-2 mb-3">
								<button id="btn-preview" class="btn btn-outline-secondary" type="button"><i class="fa fa-eye me-1"></i> Preview</button>
								<button id="btn-test" class="btn btn-warning" type="button"><i class="fa fa-paper-plane me-1"></i> Test Email</button>
								<button id="btn-send" class="btn btn-primary" type="button"><i class="fa fa-send me-1"></i> Gonder</button>
							</div>

							<div id="preview-area" style="display: none;">
								<hr class="my-3"/>
								<h6 class="fw-semibold mb-2"><i class="fa fa-eye me-1"></i> Preview</h6>
								<div id="preview-subject" class="fw-semibold mb-2 p-2 rounded bg-body-tertiary border"></div>
								<iframe id="preview-frame" class="w-100 border rounded" style="min-height:300px;" sandbox=""></iframe>
							</div>

						</div>
					</div>
				</div>

				<!-- ===================== TEMPLATES TAB ===================== -->
				<div id="tab-templates" class="tab-pane fade" role="tabpanel">
					<div class="card border-0 shadow-sm">
						<div class="card-header bg-transparent border-bottom d-flex align-items-center gap-2 py-3">
							<i class="fa fa-file-text text-muted"></i>
							<h6 class="fw-semibold mb-0">Template Library</h6>
						</div>
						<div class="card-body">

							<div class="mb-3">
								<label class="form-label fw-medium" for="tpl-name">Template Adi</label>
								<input type="text" id="tpl-name" class="form-control" placeholder="ornek: duyuru-genel">
							</div>
							<div class="mb-3">
								<label class="form-label fw-medium" for="tpl-subject">Subject</label>
								<input type="text" id="tpl-subject" class="form-control" placeholder="Email subject">
							</div>
							<div class="mb-3">
								<label class="form-label fw-medium" for="tpl-html">HTML Body</label>
								<textarea id="tpl-html" class="form-control" rows="8" placeholder="Template HTML..."></textarea>
							</div>
							<button id="btn-save-template" class="btn btn-primary" type="button"><i class="fa fa-save me-1"></i> Template Kaydet</button>

							<hr class="my-4"/>
							<h6 class="fw-semibold mb-3">Kayitli Template'ler</h6>
							<div id="template-list">
								<p class="text-muted mb-0">Yukleniyor...</p>
							</div>

						</div>
					</div>
				</div>

				<!-- ===================== SETTINGS TAB ===================== -->
				<div id="tab-settings" class="tab-pane fade" role="tabpanel">
					<form id="announcement-mailer-settings" role="form">

						<div class="card border-0 shadow-sm mb-4">
							<div class="card-header bg-transparent border-bottom d-flex align-items-center gap-2 py-3">
								<i class="fa fa-server text-muted"></i>
								<h6 class="fw-semibold mb-0">SMTP</h6>
							</div>
							<div class="card-body">
								<div class="row g-3">
									<div class="col-12 col-md-8">
										<label class="form-label fw-medium">SMTP Host</label>
										<input type="text" data-key="smtpHost" class="form-control" placeholder="mail.ieu.app">
									</div>
									<div class="col-12 col-md-4">
										<label class="form-label fw-medium">Port</label>
										<input type="number" data-key="smtpPort" class="form-control" placeholder="587">
									</div>
									<div class="col-12">
										<label class="form-label fw-medium">Username</label>
										<input type="text" data-key="smtpUser" class="form-control" placeholder="noreply@ieu.app">
									</div>
									<div class="col-12">
										<label class="form-label fw-medium">Password</label>
										<input type="password" data-key="smtpPass" class="form-control">
									</div>
									<div class="col-12">
										<label class="form-label fw-medium">From Address</label>
										<input type="text" data-key="smtpFrom" class="form-control" placeholder="IEU Forum &lt;noreply@ieu.app&gt;">
									</div>
								</div>
							</div>
						</div>

						<div class="card border-0 shadow-sm mb-4">
							<div class="card-header bg-transparent border-bottom d-flex align-items-center gap-2 py-3">
								<i class="fa fa-tachometer text-muted"></i>
								<h6 class="fw-semibold mb-0">Rate Limiting</h6>
							</div>
							<div class="card-body">
								<div class="row g-3">
									<div class="col-6 col-md-3">
										<label class="form-label fw-medium">Batch Size</label>
										<input type="number" data-key="batchSize" class="form-control" placeholder="10">
										<div class="form-text">Max 500</div>
									</div>
									<div class="col-6 col-md-3">
										<label class="form-label fw-medium">Batch Delay (ms)</label>
										<input type="number" data-key="batchDelay" class="form-control" placeholder="2000">
									</div>
									<div class="col-6 col-md-3">
										<label class="form-label fw-medium">Email Delay (ms)</label>
										<input type="number" data-key="emailDelay" class="form-control" placeholder="200">
									</div>
									<div class="col-6 col-md-3">
										<label class="form-label fw-medium">Max Retries</label>
										<input type="number" data-key="maxRetries" class="form-control" placeholder="3">
									</div>
								</div>
							</div>
						</div>

						<div class="card border-0 shadow-sm mb-4">
							<div class="card-header bg-transparent border-bottom d-flex align-items-center gap-2 py-3">
								<i class="fa fa-bullhorn text-muted"></i>
								<h6 class="fw-semibold mb-0">Otomatik Duyuru</h6>
							</div>
							<div class="card-body">
								<div class="row g-3">
									<div class="col-12 col-md-6">
										<label class="form-label fw-medium">Duyuru Kategori ID</label>
										<input type="number" data-key="announcementCategoryId" class="form-control" placeholder="Bos = devre disi">
									</div>
									<div class="col-12 col-md-6">
										<label class="form-label fw-medium">Otomatik Subject</label>
										<input type="text" data-key="autoEmailSubject" class="form-control" placeholder="Yeni Duyuru: {topicTitle}">
									</div>
									<div class="col-12">
										<label class="form-label fw-medium">Hedef Gruplar</label>
										<input type="hidden" data-key="autoEmailGroups" value="[]">
										<div id="auto-group-checkboxes" class="border rounded p-3 bg-body-tertiary" style="max-height:200px;overflow-y:auto;">
											<p class="text-muted mb-0"><i class="fa fa-spinner fa-spin me-1"></i> Yukleniyor...</p>
										</div>
									</div>
									<div class="col-12">
										<label class="form-label fw-medium">Otomatik Email Template</label>
										<textarea data-key="autoEmailTemplate" class="form-control" rows="8"
											placeholder="<h2>{topicTitle}</h2><p>Merhaba {username},</p><p>{topicContent}</p><p><a href='{topicUrl}'>Oku</a></p>"></textarea>
									</div>
								</div>
							</div>
						</div>

					</form>

					<div class="d-flex flex-wrap gap-2">
						<button class="btn btn-primary" id="save-settings" type="button"><i class="fa fa-save me-1"></i> Kaydet</button>
						<button class="btn btn-outline-secondary" id="test-connection" type="button"><i class="fa fa-plug me-1"></i> SMTP Test</button>
					</div>
				</div>

				<!-- ===================== HISTORY TAB ===================== -->
				<div id="tab-history" class="tab-pane fade" role="tabpanel">
					<div class="card border-0 shadow-sm">
						<div class="card-header bg-transparent border-bottom d-flex align-items-center justify-content-between py-3">
							<div class="d-flex align-items-center gap-2">
								<i class="fa fa-history text-muted"></i>
								<h6 class="fw-semibold mb-0">Send History</h6>
							</div>
							<button class="btn btn-sm btn-outline-secondary" id="refresh-history" type="button"><i class="fa fa-refresh me-1"></i> Yenile</button>
						</div>
						<div class="card-body p-0">
							<div class="table-responsive">
								<table class="table table-striped table-hover mb-0 align-middle">
									<thead>
										<tr>
											<th>Tarih</th>
											<th>Subject</th>
											<th>Gruplar</th>
											<th>Alici</th>
											<th>Basari/Fail</th>
											<th>Acilma</th>
											<th>Durum</th>
											<th>Aksiyonlar</th>
										</tr>
									</thead>
									<tbody id="history-body">
										<tr><td colspan="8" class="text-muted text-center"><i class="fa fa-spinner fa-spin me-1"></i> Yukleniyor...</td></tr>
									</tbody>
								</table>
							</div>
						</div>
					</div>
				</div>

			</div>
		</div>
	</div>
</div>
