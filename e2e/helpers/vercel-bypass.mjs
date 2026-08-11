const previewOrigin = process.env.E2E_BASE_URL;
const automationBypassSecret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;

if (!previewOrigin) throw new Error('E2E_BASE_URL is required');
if (!automationBypassSecret) throw new Error('VERCEL_AUTOMATION_BYPASS_SECRET is required');

export async function installVercelAutomationBypass(page) {
  await page.context().route('**/*', async (route) => {
    const request = route.request();
    let samePreviewOrigin = false;
    try {
      samePreviewOrigin = new URL(request.url()).origin === previewOrigin;
    } catch {
      samePreviewOrigin = false;
    }

    if (!samePreviewOrigin) {
      await route.continue();
      return;
    }

    await route.continue({
      headers: {
        ...request.headers(),
        'x-vercel-protection-bypass': automationBypassSecret,
        'x-vercel-set-bypass-cookie': 'true',
      },
    });
  });
}
