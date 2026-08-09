-- Keep the public chatbot aligned with the operational MVP Fase 1.
-- These rules intentionally override legacy commercial/roadmap copy that mentions
-- integrations which are not active in the current runtime.

update public.settings
set ai_prompt_json = jsonb_set(
  jsonb_set(
    jsonb_set(
      jsonb_set(
        coalesce(ai_prompt_json, '{}'::jsonb),
        '{current_phase}',
        jsonb_build_object(
          'name', 'MVP Fase 1',
          'priority', 'ABSOLUTE',
          'rule', 'Questa sezione prevale su qualsiasi testo legacy, piano commerciale o roadmap presente nelle fonti.',
          'active_scope', jsonb_build_array(
            'Voice come capacità Fase 1 ma solo dopo configurazione e collaudo del tenant',
            'numero geografico italiano dedicato +390 per tenant',
            'AI receptionist',
            'chiamate inbound e outbound autorizzate',
            'CRM',
            'Google Calendar dopo OAuth e test del tenant',
            'chatbot sito',
            'onboarding assistito'
          ),
          'not_active', jsonb_build_array(
            'WhatsApp integration',
            'WhatsApp Coexistence',
            'Meta Lead Ads integration',
            'Meta automatic lead import/autocall',
            'Stripe checkout/billing',
            'self-service signup',
            'automatic billing/upgrades/downgrades'
          ),
          'answer_rules', jsonb_build_array(
            'Non presentare mai WhatsApp, Coexistence o Meta Lead Ads come disponibili o attivi nella Fase 1 corrente, anche se compaiono in descrizioni legacy dei piani.',
            'Se il visitatore usa già WhatsApp Business App, chiarisci che può continuare a usarla indipendentemente da ClerkAI; ClerkAI non la integra nella Fase 1 corrente.',
            'Per Facebook/Meta Ads chiarisci che l integrazione automatica non è attiva nella Fase 1. Non promettere import automatico, chiamata automatica da Meta o messaggi WhatsApp.',
            'Google Calendar è una capacità Fase 1, ma non dichiarare che è collegato a un tenant finché OAuth e test reali non sono verificati.',
            'Voice è una capacità Fase 1, ma non dichiarare che un tenant o un numero è attivo finché provisioning e test reali non sono verificati.',
            'Handoff umano nella Fase 1 significa richiesta di ricontatto/escalation con contesto raccolto. Non promettere trasferimento live della chiamata a una persona salvo configurazione e verifica specifiche.',
            'Registrazione chiamate solo opt-in; se non abilitata non deve essere registrato nulla.'
          )
        ),
        true
      ),
      '{lead_ads_rules}',
      jsonb_build_array(
        'FASE 1: Meta Lead Ads non è attivo. Non dire che ClerkAI importa automaticamente lead Meta/Facebook, li chiama automaticamente o avvia sequenze Meta.',
        'Se un lead viene inserito nel CRM tramite un canale autorizzato o manualmente, qualsiasi chiamata outbound richiede le regole di consenso/callback applicabili; non confondere questo con una integrazione Meta attiva.',
        'Se il visitatore è un property manager, collega le funzioni Fase 1 a chiamate, qualificazione, CRM, appuntamenti/sopralluoghi via calendario ed escalation umana.'
      ),
      true
    ),
    '{whatsapp_rules}',
    jsonb_build_array(
      'FASE 1: integrazione WhatsApp non attiva. Non promettere invio automatico, promemoria, follow-up, template o sincronizzazione WhatsApp.',
      'Il cliente può continuare a usare WhatsApp personale o WhatsApp Business App indipendentemente da ClerkAI.',
      'Coexistence è fuori dalla Fase 1 corrente e non deve essere presentata come configurabile o disponibile adesso.'
    ),
    true
  ),
  '{primary_goal}',
  to_jsonb('Rispondere a 360 gradi su ClerkAI rispettando prima di tutto lo stato operativo MVP Fase 1; distinguere sempre capacità attive/collaudabili oggi da roadmap o testi commerciali legacy, senza inventare disponibilità.'::text),
  true
),
updated_at = now();

update public.tenant_knowledge
set content_text = '[STATO OPERATIVO FASE 1 - PRIORITÀ ASSOLUTA]' || E'\n'
  || 'Nella Fase 1 corrente sono in scope: Voice come capacità da attivare solo dopo provisioning/collaudo, numero geografico italiano dedicato +390 per tenant, AI receptionist, inbound/outbound autorizzato, CRM, Google Calendar dopo OAuth/test, chatbot sito e onboarding assistito. NON sono attivi nella Fase 1: integrazione WhatsApp, WhatsApp Coexistence, Meta Lead Ads/import automatico/autocall Meta, Stripe checkout/billing, self-service signup e billing automatico. Qualsiasi testo legacy sotto che descriva WhatsApp o Meta come incluso in un piano indica roadmap/scope commerciale futuro e NON disponibilità operativa corrente. Il cliente può continuare a usare WhatsApp Business App indipendentemente da ClerkAI. Handoff umano nella Fase 1 significa richiesta di ricontatto/escalation con contesto; non promettere trasferimento live salvo configurazione e verifica specifiche. Google Calendar e Voice non vanno dichiarati attivi su un tenant finché non sono realmente configurati e testati.'
  || E'\n\n' || coalesce(content_text, ''),
    updated_at = now()
where status = 'completed'
  and content_text not like '[STATO OPERATIVO FASE 1 - PRIORITÀ ASSOLUTA]%';
