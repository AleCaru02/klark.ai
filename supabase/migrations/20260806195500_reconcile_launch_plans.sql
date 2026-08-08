-- Reconcile the public plan catalogue with the approved launch pricing.
-- Safe only while no subscriptions exist; the guard prevents accidental remapping.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.subscriptions) THEN
    RAISE EXCEPTION 'Plan reconciliation blocked: subscriptions exist';
  END IF;
END $$;

ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS setup_fee_cents integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS technical_cost_per_voice_min_cents integer NOT NULL DEFAULT 14,
  ADD COLUMN IF NOT EXISTS whatsapp_billing_mode text NOT NULL DEFAULT 'provider_cost_plus_markup',
  ADD COLUMN IF NOT EXISTS whatsapp_markup_cent_per_msg integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS minimum_commitment_months integer NOT NULL DEFAULT 3;

DELETE FROM public.plans
WHERE code NOT IN ('essential', 'growth', 'pro', 'enterprise');

INSERT INTO public.plans (
  code, name,
  included_connected_seconds_per_quarter,
  included_wa_templates_per_quarter,
  price_per_quarter_cents,
  monthly_price_cents,
  included_voice_minutes,
  included_wa_messages,
  overage_voice_cent_per_min,
  overage_wa_cent_per_msg,
  overage_mode,
  warning_thresholds,
  features,
  feature_flags,
  setup_fee_cents,
  technical_cost_per_voice_min_cents,
  whatsapp_billing_mode,
  whatsapp_markup_cent_per_msg,
  minimum_commitment_months
) VALUES
(
  'essential', 'Essential', 36000, 0, 59700, 19900, 200, 0, 39, 1, 'overage',
  '[70,85,100]'::jsonb,
  '["Twilio Voice","ElevenLabs","OpenAI tools e RAG","Google Calendar","CRM","Knowledge base","Handoff umano"]'::jsonb,
  '{"voice_enabled":true,"calendar_enabled":true,"whatsapp_enabled":false,"crm_basic_enabled":true,"crm_advanced_enabled":false,"followup_basic_enabled":true,"followup_advanced_enabled":false,"ads_enabled":false,"ai_training_basic_enabled":true,"ai_training_advanced_enabled":false,"analytics_basic_enabled":true,"analytics_advanced_enabled":false,"integrations_enabled":false,"max_meta_pages":0,"max_phone_numbers":1,"max_users":2,"max_whatsapp_numbers":0}'::jsonb,
  39000, 14, 'provider_cost_plus_markup', 1, 3
),
(
  'growth', 'Growth', 117000, 0, 119700, 39900, 650, 0, 39, 1, 'overage',
  '[70,85,100]'::jsonb,
  '["Tutto Essential","Meta Lead Ads","WhatsApp Cloud API","Follow-up avanzato","Più pipeline","Economics Center"]'::jsonb,
  '{"voice_enabled":true,"calendar_enabled":true,"whatsapp_enabled":true,"crm_basic_enabled":true,"crm_advanced_enabled":true,"followup_basic_enabled":true,"followup_advanced_enabled":true,"ads_enabled":true,"ai_training_basic_enabled":true,"ai_training_advanced_enabled":true,"analytics_basic_enabled":true,"analytics_advanced_enabled":false,"integrations_enabled":true,"max_meta_pages":1,"max_phone_numbers":1,"max_users":4,"max_whatsapp_numbers":1}'::jsonb,
  69000, 14, 'provider_cost_plus_markup', 1, 3
),
(
  'pro', 'Pro', 270000, 0, 224700, 74900, 1500, 0, 39, 1, 'overage',
  '[70,85,100]'::jsonb,
  '["Tutto Growth","Più campagne","Più calendari","Knowledge base estesa","Report avanzati","Priorità e supervisione"]'::jsonb,
  '{"voice_enabled":true,"calendar_enabled":true,"whatsapp_enabled":true,"crm_basic_enabled":true,"crm_advanced_enabled":true,"followup_basic_enabled":true,"followup_advanced_enabled":true,"ads_enabled":true,"ai_training_basic_enabled":true,"ai_training_advanced_enabled":true,"analytics_basic_enabled":true,"analytics_advanced_enabled":true,"integrations_enabled":true,"max_meta_pages":5,"max_phone_numbers":3,"max_users":10,"max_whatsapp_numbers":3}'::jsonb,
  119000, 14, 'provider_cost_plus_markup', 1, 3
),
(
  'enterprise', 'Enterprise', 0, 0, 387000, 129000, 0, 0, 39, 1, 'custom',
  '[70,85,100]'::jsonb,
  '["Sedi e volumi personalizzati","CRM e API su progetto","SLA","Monitoraggio","Escalation dedicata","Governance personalizzata"]'::jsonb,
  '{"voice_enabled":true,"calendar_enabled":true,"whatsapp_enabled":true,"crm_basic_enabled":true,"crm_advanced_enabled":true,"followup_basic_enabled":true,"followup_advanced_enabled":true,"ads_enabled":true,"ai_training_basic_enabled":true,"ai_training_advanced_enabled":true,"analytics_basic_enabled":true,"analytics_advanced_enabled":true,"integrations_enabled":true,"max_meta_pages":100,"max_phone_numbers":100,"max_users":100,"max_whatsapp_numbers":100}'::jsonb,
  0, 14, 'custom', 1, 3
)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  included_connected_seconds_per_quarter = EXCLUDED.included_connected_seconds_per_quarter,
  included_wa_templates_per_quarter = EXCLUDED.included_wa_templates_per_quarter,
  price_per_quarter_cents = EXCLUDED.price_per_quarter_cents,
  monthly_price_cents = EXCLUDED.monthly_price_cents,
  included_voice_minutes = EXCLUDED.included_voice_minutes,
  included_wa_messages = EXCLUDED.included_wa_messages,
  overage_voice_cent_per_min = EXCLUDED.overage_voice_cent_per_min,
  overage_wa_cent_per_msg = EXCLUDED.overage_wa_cent_per_msg,
  overage_mode = EXCLUDED.overage_mode,
  warning_thresholds = EXCLUDED.warning_thresholds,
  features = EXCLUDED.features,
  feature_flags = EXCLUDED.feature_flags,
  setup_fee_cents = EXCLUDED.setup_fee_cents,
  technical_cost_per_voice_min_cents = EXCLUDED.technical_cost_per_voice_min_cents,
  whatsapp_billing_mode = EXCLUDED.whatsapp_billing_mode,
  whatsapp_markup_cent_per_msg = EXCLUDED.whatsapp_markup_cent_per_msg,
  minimum_commitment_months = EXCLUDED.minimum_commitment_months;
