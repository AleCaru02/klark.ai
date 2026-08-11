import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const previewOrigin = process.env.E2E_BASE_URL;
const vercelOidcToken = process.env.E2E_VERCEL_OIDC_TOKEN;
const email = process.env.E2E_EMAIL;
const password = process.env.E2E_PASSWORD;
if (!previewOrigin || !vercelOidcToken || !email || !password) throw new Error('Missing E2E runtime credentials');

const supabaseOrigin = 'https://ipazbzctivqquwndifxh.supabase.co';
const outDir = path.resolve('e2e-artifacts');
fs.mkdirSync(outDir, { recursive: true });

function safeUrl(value) {
  try {
    const url = new URL(value);
    return `${url.origin}${url.pathname}`;
  } catch {
    return '<invalid-url>';
  }
}

function isCriticalUrl(value) {
  try {
    const origin = new URL(value).origin;
    return origin === previewOrigin || origin === supabaseOrigin;
  } catch {
    return false;
  }
}

async function installTrustedSource(page) {
  await page.context().route('**/*', async (route) => {
    const request = route.request();
    let isPreviewRequest = false;
    try {
      isPreviewRequest = new URL(request.url()).origin === previewOrigin;
    } catch {
      isPreviewRequest = false;
    }
    if (!isPreviewRequest) {
      await route.continue();
      return;
    }
    await route.continue({
      headers: {
        ...request.headers(),
        'x-vercel-trusted-oidc-idp-token': vercelOidcToken,
      },
    });
  });
}

function installDiagnostics(page, projectName) {
  const diagnostics = { consoleErrors: [], pageErrors: [], failedRequests: [], badResponses: [] };
  page.on('console', (message) => {
    if (message.type() === 'error') diagnostics.consoleErrors.push(message.text().slice(0, 600));
  });
  page.on('pageerror', (error) => diagnostics.pageErrors.push(String(error.message || error).slice(0, 600)));
  page.on('requestfailed', (request) => {
    if (!isCriticalUrl(request.url())) return;
    const failure = request.failure()?.errorText || 'request failed';
    if (!failure.includes('ERR_ABORTED')) diagnostics.failedRequests.push({ url: safeUrl(request.url()), method: request.method(), error: failure });
  });
  page.on('response', (response) => {
    if (!isCriticalUrl(response.url())) return;
    const status = response.status();
    const type = response.request().resourceType();
    if (status >= 500 || (status >= 400 && ['document', 'script', 'stylesheet', 'xhr', 'fetch'].includes(type))) {
      diagnostics.badResponses.push({ status, type, method: response.request().method(), url: safeUrl(response.url()) });
    }
  });
  return {
    diagnostics,
    save() {
      fs.writeFileSync(path.join(outDir, `${projectName}-diagnostics.json`), JSON.stringify(diagnostics, null, 2));
    },
  };
}

async function assertNoPageOverflow(page, label) {
  const values = await page.evaluate(() => ({
    doc: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
    client: document.documentElement.clientWidth,
  }));
  expect(Math.max(values.doc, values.body), `${label}: horizontal page overflow`).toBeLessThanOrEqual(values.client + 2);
}

async function dismissTechnicalNotice(page) {
  const button = page.getByRole('button', { name: 'Ho capito' });
  if (await button.isVisible().catch(() => false)) await button.click();
}

async function establishPreviewAccess(page) {
  const response = await page.goto(`${previewOrigin}/`, { waitUntil: 'domcontentloaded' });
  expect(response, 'preview response missing').not.toBeNull();
  expect(response.status(), 'preview document status').toBe(200);
  await page.waitForLoadState('networkidle');
  await dismissTechnicalNotice(page);
  await expect(page.locator('#root')).toBeVisible();
  const assets = await page.evaluate(() => ({
    scripts: [...document.scripts].filter((node) => node.src).length,
    styles: [...document.querySelectorAll('link[rel="stylesheet"]')].length,
  }));
  expect(assets.scripts, 'no JS asset loaded').toBeGreaterThan(0);
  expect(assets.styles, 'no CSS asset loaded').toBeGreaterThan(0);
}

async function login(page) {
  const response = await page.goto(`${previewOrigin}/login`, { waitUntil: 'networkidle' });
  expect(response?.status(), 'direct /login must resolve through SPA fallback').toBe(200);
  await expect(page.getByRole('heading', { name: 'Accedi', exact: true })).toBeVisible();
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await Promise.all([
    page.waitForURL((url) => url.pathname.startsWith('/app'), { timeout: 20_000 }),
    page.getByRole('button', { name: 'Accedi', exact: true }).click(),
  ]);
  expect(new URL(page.url()).pathname).toBe('/app');
}

async function choose(page, id, optionText) {
  await page.locator(`#${id}`).click();
  await page.getByRole('option', { name: optionText, exact: true }).click();
}

function fieldByLabelText(page, text) {
  return page.locator('label').filter({ hasText: text }).locator('..').locator('input,textarea').first();
}

async function completeDesktopOnboarding(page) {
  const response = await page.goto(`${previewOrigin}/app/onboarding`, { waitUntil: 'networkidle' });
  expect(response?.status()).toBe(200);
  await expect(page.getByRole('heading', { name: 'Configurazione operativa assistita' })).toBeVisible();
  await expect(page.getByText('Completezza operativa')).toBeVisible();

  await page.locator('#studio-name').fill('ClerkAI Browser E2E Tenant B');
  await choose(page, 'profession', 'Property manager');
  await page.locator('#business-address').fill('Via E2E 1');
  await fieldByLabelText(page, 'Città *').fill('Usmate Velate');
  await fieldByLabelText(page, 'Provincia *').fill('MB');
  await fieldByLabelText(page, 'CAP *').fill('20865');
  await fieldByLabelText(page, 'Telefono attività *').fill('+390391234567');
  await fieldByLabelText(page, 'Email attività *').fill('e2e-browser@example.com');
  await page.getByRole('button', { name: 'Salva dati azienda' }).click();
  await expect(page.getByText('Dati azienda salvati')).toBeVisible();
  await page.getByRole('button', { name: /Salva e definisci gli obiettivi/ }).click();
  await expect(page.getByRole('heading', { name: 'Servizi' })).toBeVisible();

  await choose(page, 'primary-goal', 'Ridurre richieste senza risposta');
  await choose(page, 'expected-volume', 'Fino a 20 richieste a settimana');
  await page.locator('#success-metric').fill('E2E: zero errori bloccanti nel flusso browser');
  await page.locator('#main-use-cases').fill('Richieste informative E2E e verifica agenda test.');
  await page.getByRole('button', { name: 'Aggiungi servizio' }).click();
  await fieldByLabelText(page, 'Nome *').last().fill('Servizio Browser E2E');
  await page.getByRole('button', { name: 'Salva servizi e FAQ' }).click();
  await expect(page.getByText('Servizi e FAQ salvati')).toBeVisible();
  await choose(page, 'appointment-mode', 'Prenota direttamente sul calendario');
  await page.getByRole('button', { name: /Salva obiettivi/ }).click();
  await expect(page.getByRole('heading', { name: 'Receptionist AI' })).toBeVisible();

  await page.locator('#greeting').fill('Ciao, sono l’assistente AI di test ClerkAI. Come posso aiutarti?');
  await page.locator('#tone-notes').fill('E2E: risposte concise; non inventare dati.');
  await page.getByRole('button', { name: /Salva assistente/ }).click();
  await expect(page.getByRole('heading', { name: 'Regole operative' })).toBeVisible();

  await fieldByLabelText(page, 'Policy callback *').fill('Solo richieste autorizzate durante gli orari di test.');
  await fieldByLabelText(page, 'Escalation *').fill('Escalation a referente umano per richieste non risolvibili.');
  await fieldByLabelText(page, 'Fuori orario *').fill('Raccogli richiesta e proponi richiamo nel primo orario utile.');
  const disclosure = page.getByText('Confermo che la receptionist deve dichiarare chiaramente di essere un assistente AI').locator('..').locator('input[type="checkbox"]');
  if (!(await disclosure.isChecked())) await disclosure.check();
  const recording = page.getByText('Registrazione chiamate autorizzata per questo tenant (opzionale)').locator('..').locator('input[type="checkbox"]');
  await expect(recording).not.toBeChecked();
  await page.getByRole('button', { name: 'Salva configurazione operativa' }).click();
  await expect(page.getByText('Orari, agenda e regole Voice salvati')).toBeVisible();

  await page.locator('#business-hours').fill('Lun-Ven 09:00-18:00');
  await page.locator('#handoff-contact').fill('Referente E2E');
  await page.locator('#handoff-rules').fill('Passa a una persona su richiesta esplicita o informazione non disponibile.');
  await page.locator('#forbidden-actions').fill('Non comprare, non attivare Voice, non modificare dati reali.');
  await page.getByRole('button', { name: /Salva escalation/ }).click();
  await expect(page.getByRole('heading', { name: 'Integrazioni' })).toBeVisible();
  await expect(page.getByText('Google Calendar')).toBeVisible();
  await expect(page.getByText('Collegato', { exact: true })).toBeVisible();
  await expect(page.getByText('Numero telefonico')).toBeVisible();
  await expect(page.getByText('In attesa', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Aggiorna stato' }).click();
  await expect(page.getByText('Stato integrazioni aggiornato')).toBeVisible();
  await page.getByRole('button', { name: /Registra revisione/ }).click();
  await expect(page.getByRole('heading', { name: 'Riepilogo' })).toBeVisible();
  await expect(page.getByText('Numero telefonico non assegnato')).toBeVisible();
}

async function verifyDashboard(page) {
  await page.goto(`${previewOrigin}/app`, { waitUntil: 'networkidle' });
  await expect(page.getByText(/Ecco un riepilogo dell'attività/)).toBeVisible();
  await expect(page.getByText('Prontezza operativa')).toBeVisible();
  const voiceRow = page.getByText('Telefonia Voice').locator('xpath=ancestor::div[contains(@class,"rounded-lg")][1]');
  await expect(voiceRow.getByText('CONFIGURATO')).toBeVisible();
  await expect(voiceRow.getByText('ATTIVO')).toHaveCount(0);
  const calendarRow = page.getByText('Google Calendar').locator('xpath=ancestor::div[contains(@class,"rounded-lg")][1]');
  await expect(calendarRow.getByText('COLLEGATO')).toBeVisible();
  const e2eRow = page.getByText('Collaudo Voice end-to-end').locator('xpath=ancestor::div[contains(@class,"rounded-lg")][1]');
  await expect(e2eRow.getByText('NON CONFIGURATO')).toBeVisible();
  await expect(page.getByText('Voice live non autorizzata')).toBeVisible();
}

async function verifyCrm(page) {
  await page.goto(`${previewOrigin}/app/crm`, { waitUntil: 'networkidle' });
  await expect(page.getByText('CRM', { exact: true })).toBeVisible();
  await expect(page.getByPlaceholder('Cerca contatti...')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Nuovo', exact: true })).toBeVisible();
  await expect(page.getByText(/Nessun contatto in questo foglio|Stato|Nome/).first()).toBeVisible();
}

async function verifyCalendar(page) {
  await page.goto(`${previewOrigin}/app/calendar`, { waitUntil: 'networkidle' });
  await expect(page.getByRole('heading', { name: 'Calendario' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Disponibilità' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Nuovo Evento' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Settimana' })).toBeVisible();
}

async function verifySettings(page) {
  await page.goto(`${previewOrigin}/app/settings`, { waitUntil: 'networkidle' });
  await expect(page.getByRole('heading', { name: 'Impostazioni' })).toBeVisible();
  await expect(page.getByText(email, { exact: true })).toBeVisible();
  await expect(page.locator('#businessName')).toHaveValue('ClerkAI Browser E2E Tenant B');
}

async function verifyChatbot(page, sendMessage) {
  await page.goto(`${previewOrigin}/app/site-chatbot`, { waitUntil: 'networkidle' });
  await expect(page.getByRole('heading', { name: 'Chatbot del sito' })).toBeVisible();
  await expect(page.getByText('Attivo sui domini autorizzati')).toBeVisible();
  await page.evaluate(() => {
    const original = Element.prototype.attachShadow;
    Element.prototype.attachShadow = function attachShadow(init) {
      return original.call(this, { ...init, mode: 'open' });
    };
  });
  await page.getByRole('button', { name: 'Testa widget' }).click();
  const launcher = page.getByRole('button', { name: 'Apri assistente' });
  await expect(launcher).toBeVisible();
  await launcher.click();
  await expect(page.getByRole('dialog', { name: 'Chat con assistente AI' })).toBeVisible();
  if (sendMessage) {
    const input = page.getByPlaceholder('Scrivi una domanda…');
    await input.fill('Qual è il servizio E2E disponibile?');
    await page.getByRole('button', { name: 'Invia' }).click();
    const assistantMessages = page.locator('.msg.assistant');
    await expect(assistantMessages).toHaveCount(2, { timeout: 45_000 });
    expect((await assistantMessages.last().innerText()).trim().length).toBeGreaterThan(3);
  }
}

async function verifyMobileOnboardingNavigation(page) {
  await page.goto(`${previewOrigin}/app/onboarding`, { waitUntil: 'networkidle' });
  await expect(page.getByRole('heading', { name: 'Configurazione operativa assistita' })).toBeVisible();
  const checks = [
    ['La tua attività', '#studio-name'],
    ['Servizi', '#primary-goal'],
    ['Receptionist AI', '#greeting'],
    ['Regole operative', '#business-hours'],
    ['Integrazioni', 'text=Google Calendar'],
    ['Riepilogo', 'text=Riepilogo'],
  ];
  for (const [step, selector] of checks) {
    const button = page.getByRole('button', { name: new RegExp(step) });
    await expect(button).toBeEnabled();
    await button.click();
    await expect(page.locator(selector).first()).toBeVisible();
    await assertNoPageOverflow(page, `mobile onboarding ${step}`);
  }
}

test('real browser smoke against exact protected preview', async ({ page }, testInfo) => {
  const projectName = testInfo.project.name;
  await installTrustedSource(page);
  const { diagnostics, save } = installDiagnostics(page, projectName);
  page.on('dialog', (dialog) => dialog.dismiss());
  try {
    await establishPreviewAccess(page);
    await assertNoPageOverflow(page, 'public');
    await login(page);
    await expect(page.getByText(/Ecco un riepilogo dell'attività/)).toBeVisible();

    if (projectName === 'desktop-chromium') {
      await completeDesktopOnboarding(page);
      await assertNoPageOverflow(page, 'desktop onboarding');
    } else {
      await verifyMobileOnboardingNavigation(page);
    }

    await verifyDashboard(page);
    await assertNoPageOverflow(page, `${projectName} dashboard`);
    await verifyCrm(page);
    await assertNoPageOverflow(page, `${projectName} crm`);
    await verifyCalendar(page);
    await assertNoPageOverflow(page, `${projectName} calendar`);
    await verifySettings(page);
    await assertNoPageOverflow(page, `${projectName} settings`);
    await verifyChatbot(page, projectName === 'desktop-chromium');
    await assertNoPageOverflow(page, `${projectName} chatbot`);

    expect(diagnostics.pageErrors, 'uncaught page errors').toEqual([]);
    expect(diagnostics.failedRequests, 'failed critical network requests').toEqual([]);
    expect(diagnostics.badResponses, 'unexpected first-party/Supabase HTTP 4xx/5xx').toEqual([]);
    expect(diagnostics.consoleErrors, 'console errors').toEqual([]);
  } catch (error) {
    await page.screenshot({ path: path.join(outDir, `${projectName}-failure.png`), fullPage: true }).catch(() => undefined);
    throw error;
  } finally {
    save();
  }
});
