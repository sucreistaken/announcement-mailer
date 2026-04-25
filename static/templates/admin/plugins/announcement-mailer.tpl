<div class="acp-page-container">
	<div class="col-lg-12">

		<div class="page-header">
			<h3><i class="fa fa-envelope"></i> Announcement Mailer</h3>
			<p class="text-muted">Secilen kullanici gruplarina toplu email gonderin.</p>
		</div>

		<ul class="nav nav-tabs" id="mailer-tabs">
			<li class="active"><a data-toggle="tab" href="#tab-compose"><i class="fa fa-pencil"></i> Compose</a></li>
			<li><a data-toggle="tab" href="#tab-templates"><i class="fa fa-file-text"></i> Templates</a></li>
			<li><a data-toggle="tab" href="#tab-settings"><i class="fa fa-cog"></i> Settings</a></li>
			<li><a data-toggle="tab" href="#tab-history"><i class="fa fa-history"></i> History</a></li>
		</ul>

		<div class="tab-content" style="padding-top: 15px;">

			<!-- ===================== COMPOSE TAB ===================== -->
			<div id="tab-compose" class="tab-pane fade in active">
				<div class="panel panel-default">
					<div class="panel-heading"><i class="fa fa-envelope"></i> Compose Announcement</div>
					<div class="panel-body">

						<div class="form-group">
							<label>Template Yukle</label>
							<div class="input-group">
								<select id="template-select" class="form-control">
									<option value="">-- Template sec --</option>
								</select>
								<span class="input-group-btn">
									<button id="btn-load-template" class="btn btn-default"><i class="fa fa-download"></i> Yukle</button>
								</span>
							</div>
						</div>

						<div class="form-group">
							<label for="email-subject">Subject</label>
							<input type="text" id="email-subject" class="form-control" placeholder="Ornek: Onemli Duyuru" required>
						</div>

						<div class="form-group">
							<label for="email-html">Email Body (HTML)</label>
							<textarea id="email-html" class="form-control" rows="14" placeholder="HTML icerik yazin..." required></textarea>
							<p class="help-block">
								Placeholder'lar:
								<code>{username}</code> <code>{email}</code> <code>{siteName}</code> <code>{siteUrl}</code> <code>{date}</code> <code>{unsubscribeUrl}</code>
							</p>
						</div>

						<div class="form-group">
							<label>Hedef Gruplar</label>
							<div id="group-checkboxes" class="well" style="max-height: 250px; overflow-y: auto;">
								<p class="text-muted"><i class="fa fa-spinner fa-spin"></i> Gruplar yukleniyor...</p>
							</div>
						</div>

						<!-- Scheduled send -->
						<div class="form-group">
							<label for="scheduled-at"><i class="fa fa-clock-o"></i> Zamanlanmis Gonderim (istege bagli)</label>
							<input type="datetime-local" id="scheduled-at" class="form-control" style="max-width: 300px;">
							<p class="help-block">Bos birakirsaniz hemen gonderilir.</p>
						</div>

						<div class="form-group">
							<button id="btn-preview" class="btn btn-default"><i class="fa fa-eye"></i> Preview</button>
							<button id="btn-test" class="btn btn-warning"><i class="fa fa-paper-plane"></i> Test Email</button>
							<button id="btn-send" class="btn btn-primary"><i class="fa fa-send"></i> Gonder</button>
						</div>

						<div id="preview-area" style="display: none;">
							<hr/>
							<h5><i class="fa fa-eye"></i> Preview:</h5>
							<div id="preview-subject" style="font-weight:bold;margin-bottom:8px;padding:8px;background:#f5f5f5;border-radius:4px;"></div>
							<iframe id="preview-frame" style="width:100%;min-height:300px;border:1px solid #ddd;border-radius:4px;" sandbox=""></iframe>
						</div>

					</div>
				</div>
			</div>

			<!-- ===================== TEMPLATES TAB ===================== -->
			<div id="tab-templates" class="tab-pane fade">
				<div class="panel panel-default">
					<div class="panel-heading"><i class="fa fa-file-text"></i> Template Library</div>
					<div class="panel-body">
						<div class="form-group">
							<label for="tpl-name">Template Adi</label>
							<input type="text" id="tpl-name" class="form-control" placeholder="ornek: duyuru-genel">
						</div>
						<div class="form-group">
							<label for="tpl-subject">Subject</label>
							<input type="text" id="tpl-subject" class="form-control" placeholder="Email subject">
						</div>
						<div class="form-group">
							<label for="tpl-html">HTML Body</label>
							<textarea id="tpl-html" class="form-control" rows="8" placeholder="Template HTML..."></textarea>
						</div>
						<button id="btn-save-template" class="btn btn-primary"><i class="fa fa-save"></i> Template Kaydet</button>
						<hr/>
						<h5>Kayitli Template'ler</h5>
						<div id="template-list">
							<p class="text-muted">Yukleniyor...</p>
						</div>
					</div>
				</div>
			</div>

			<!-- ===================== SETTINGS TAB ===================== -->
			<div id="tab-settings" class="tab-pane fade">
				<div class="panel panel-default">
					<div class="panel-heading"><i class="fa fa-cog"></i> SMTP & Settings</div>
					<div class="panel-body">
						<form id="announcement-mailer-settings">

							<h5><i class="fa fa-server"></i> SMTP</h5>
							<div class="row">
								<div class="col-sm-8">
									<div class="form-group">
										<label>SMTP Host</label>
										<input type="text" data-key="smtpHost" class="form-control" placeholder="mail.ieu.app">
									</div>
								</div>
								<div class="col-sm-4">
									<div class="form-group">
										<label>Port</label>
										<input type="number" data-key="smtpPort" class="form-control" placeholder="587">
									</div>
								</div>
							</div>
							<div class="form-group">
								<label>Username</label>
								<input type="text" data-key="smtpUser" class="form-control" placeholder="noreply@ieu.app">
							</div>
							<div class="form-group">
								<label>Password</label>
								<input type="password" data-key="smtpPass" class="form-control">
							</div>
							<div class="form-group">
								<label>From Address</label>
								<input type="text" data-key="smtpFrom" class="form-control" placeholder="IEU Forum <noreply@ieu.app>">
							</div>

							<hr/>
							<h5><i class="fa fa-tachometer"></i> Rate Limiting</h5>
							<div class="row">
								<div class="col-sm-3">
									<div class="form-group">
										<label>Batch Size</label>
										<input type="number" data-key="batchSize" class="form-control" placeholder="10">
										<p class="help-block">Max 500</p>
									</div>
								</div>
								<div class="col-sm-3">
									<div class="form-group">
										<label>Batch Delay (ms)</label>
										<input type="number" data-key="batchDelay" class="form-control" placeholder="2000">
									</div>
								</div>
								<div class="col-sm-3">
									<div class="form-group">
										<label>Email Delay (ms)</label>
										<input type="number" data-key="emailDelay" class="form-control" placeholder="200">
									</div>
								</div>
								<div class="col-sm-3">
									<div class="form-group">
										<label>Max Retries</label>
										<input type="number" data-key="maxRetries" class="form-control" placeholder="3">
									</div>
								</div>
							</div>

							<hr/>
							<h5><i class="fa fa-bullhorn"></i> Otomatik Duyuru</h5>
							<div class="row">
								<div class="col-sm-6">
									<div class="form-group">
										<label>Duyuru Kategori ID</label>
										<input type="number" data-key="announcementCategoryId" class="form-control" placeholder="Bos = devre disi">
									</div>
								</div>
								<div class="col-sm-6">
									<div class="form-group">
										<label>Otomatik Subject</label>
										<input type="text" data-key="autoEmailSubject" class="form-control" placeholder="Yeni Duyuru: {topicTitle}">
									</div>
								</div>
							</div>
							<div class="form-group">
								<label>Hedef Gruplar</label>
								<input type="hidden" data-key="autoEmailGroups" value="[]">
								<div id="auto-group-checkboxes" class="well" style="max-height:200px;overflow-y:auto;">
									<p class="text-muted"><i class="fa fa-spinner fa-spin"></i> Yukleniyor...</p>
								</div>
							</div>
							<div class="form-group">
								<label>Otomatik Email Template</label>
								<textarea data-key="autoEmailTemplate" class="form-control" rows="8"
									placeholder="<h2>{topicTitle}</h2><p>Merhaba {username},</p><p>{topicContent}</p><p><a href='{topicUrl}'>Oku</a></p>"></textarea>
							</div>

						</form>

						<button class="btn btn-primary" id="save-settings"><i class="fa fa-save"></i> Kaydet</button>
						<button class="btn btn-default" id="test-connection" style="margin-left:8px;"><i class="fa fa-plug"></i> SMTP Test</button>
					</div>
				</div>
			</div>

			<!-- ===================== HISTORY TAB ===================== -->
			<div id="tab-history" class="tab-pane fade">
				<div class="panel panel-default">
					<div class="panel-heading">
						<i class="fa fa-history"></i> Send History
						<button class="btn btn-xs btn-default pull-right" id="refresh-history"><i class="fa fa-refresh"></i> Yenile</button>
					</div>
					<div class="panel-body">
						<div class="table-responsive">
							<table class="table table-striped table-hover">
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
									<tr><td colspan="8" class="text-muted text-center"><i class="fa fa-spinner fa-spin"></i> Yukleniyor...</td></tr>
								</tbody>
							</table>
						</div>
					</div>
				</div>
			</div>

		</div>
	</div>
</div>
