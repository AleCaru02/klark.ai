-- Create reminders table for appointment notifications
CREATE TABLE public.reminders (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    contact_id uuid REFERENCES public.contacts(id) ON DELETE CASCADE,
    appointment_id uuid REFERENCES public.appointments(id) ON DELETE CASCADE,
    channel text NOT NULL CHECK (channel IN ('whatsapp', 'email')),
    reminder_type text NOT NULL CHECK (reminder_type IN ('confirmation', 'reminder_24h', 'rescheduled', 'canceled')),
    when_ts timestamp with time zone NOT NULL,
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'skipped')),
    payload_json jsonb DEFAULT '{}'::jsonb,
    error_message text,
    sent_at timestamp with time zone,
    created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Admins can do everything on reminders" 
ON public.reminders 
FOR ALL 
USING (has_membership_role(auth.uid(), 'admin'::membership_role));

CREATE POLICY "Customers can view own tenant reminders" 
ON public.reminders 
FOR SELECT 
USING (user_belongs_to_tenant(auth.uid(), tenant_id));

CREATE POLICY "Customers can insert own tenant reminders" 
ON public.reminders 
FOR INSERT 
WITH CHECK (user_belongs_to_tenant(auth.uid(), tenant_id));

-- Indexes for efficient querying
CREATE INDEX idx_reminders_pending ON public.reminders(when_ts) WHERE status = 'pending';
CREATE INDEX idx_reminders_tenant_id ON public.reminders(tenant_id);
CREATE INDEX idx_reminders_appointment_id ON public.reminders(appointment_id);