import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Copy, Share2, Users, TrendingUp, Gift, ChevronRight, Network, DollarSign, UserPlus } from "lucide-react";
import { useReferral } from "@/hooks/useReferral";
import { motion } from "framer-motion";

export default function Referral() {
  const {
    loading,
    referralCode,
    referrals,
    commissions,
    totalEarnedCents,
    totalPendingCents,
    level1Referrals,
    level2Referrals,
    referralLink,
    generateCode,
    copyLink,
  } = useReferral();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold mb-1">Programma Referral</h1>
        <p className="text-muted-foreground">
          Invita professionisti e guadagna commissioni ricorrenti su ogni rinnovo
        </p>
      </div>

      {/* How it works */}
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Network className="w-5 h-5 text-primary" />
            Come funziona il Network
          </CardTitle>
          <CardDescription>Guadagni su 2 livelli di profondità, per sempre</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-3 gap-4">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0 }}
              className="p-4 rounded-xl bg-card border border-border text-center"
            >
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                <Share2 className="w-6 h-6 text-primary" />
              </div>
              <h4 className="font-semibold text-sm mb-1">1. Condividi</h4>
              <p className="text-xs text-muted-foreground">
                Condividi il tuo link referral con colleghi e professionisti
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="p-4 rounded-xl bg-card border border-border text-center"
            >
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                <UserPlus className="w-6 h-6 text-primary" />
              </div>
              <h4 className="font-semibold text-sm mb-1">2. Livello 1 — 5%</h4>
              <p className="text-xs text-muted-foreground">
                Guadagni il 5% su ogni rinnovo dei tuoi invitati diretti
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="p-4 rounded-xl bg-card border border-border text-center"
            >
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                <Users className="w-6 h-6 text-primary" />
              </div>
              <h4 className="font-semibold text-sm mb-1">3. Livello 2 — 5%</h4>
              <p className="text-xs text-muted-foreground">
                Guadagni il 5% anche sui rinnovi degli invitati dai tuoi invitati
              </p>
            </motion.div>
          </div>
        </CardContent>
      </Card>

      {/* Referral Link */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Gift className="w-4 h-4" />
            Il tuo Link Referral
          </CardTitle>
        </CardHeader>
        <CardContent>
          {referralCode ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="flex-1 p-3 rounded-lg bg-muted/50 border border-border font-mono text-sm truncate">
                  {referralLink}
                </div>
                <Button variant="outline" size="icon" onClick={copyLink} title="Copia link">
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant="secondary" className="font-mono text-xs">
                  Codice: {referralCode.code}
                </Badge>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (referralLink && navigator.share) {
                      navigator.share({
                        title: "ClerkAI — Segretaria AI",
                        text: "Prova ClerkAI, la segretaria telefonica AI per professionisti! Usa il mio link referral:",
                        url: referralLink,
                      });
                    } else {
                      copyLink();
                    }
                  }}
                >
                  <Share2 className="w-4 h-4 mr-2" />
                  Condividi
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-center py-6">
              <p className="text-sm text-muted-foreground mb-4">
                Genera il tuo codice referral unico per iniziare a guadagnare
              </p>
              <Button onClick={generateCode}>
                <Gift className="w-4 h-4 mr-2" />
                Genera Codice Referral
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Users className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{level1Referrals.length}</p>
                <p className="text-xs text-muted-foreground">Invitati Livello 1</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Network className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{level2Referrals.length}</p>
                <p className="text-xs text-muted-foreground">Invitati Livello 2</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{(totalPendingCents / 100).toFixed(2)}€</p>
                <p className="text-xs text-muted-foreground">In attesa</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-green-600">{(totalEarnedCents / 100).toFixed(2)}€</p>
                <p className="text-xs text-muted-foreground">Guadagnato Totale</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Network Tree */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Network className="w-4 h-4" />
            La tua Rete
          </CardTitle>
          <CardDescription>Struttura del tuo network su 2 livelli</CardDescription>
        </CardHeader>
        <CardContent>
          {referrals.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Nessun referral ancora. Condividi il tuo link per iniziare!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {level1Referrals.map((ref) => {
                const l2 = level2Referrals.filter(
                  (r2) => r2.referrer_tenant_id === ref.referred_tenant_id || true
                );
                return (
                  <div key={ref.id} className="rounded-xl border border-border overflow-hidden">
                    <div className="flex items-center gap-3 p-3 bg-primary/5">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <UserPlus className="w-4 h-4 text-primary" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium">Invitato Livello 1</p>
                        <p className="text-xs text-muted-foreground">
                          Registrato il {new Date(ref.created_at).toLocaleDateString("it-IT")}
                        </p>
                      </div>
                      <Badge variant={ref.status === "active" ? "default" : "secondary"}>
                        {ref.status === "active" ? "Attivo" : ref.status}
                      </Badge>
                      <Badge variant="outline" className="text-xs">5%</Badge>
                    </div>
                  </div>
                );
              })}

              {level2Referrals.length > 0 && (
                <>
                  <div className="flex items-center gap-2 pt-2">
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Livello 2
                    </span>
                  </div>
                  {level2Referrals.map((ref) => (
                    <div key={ref.id} className="rounded-xl border border-border ml-6">
                      <div className="flex items-center gap-3 p-3 bg-muted/30">
                        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                          <Users className="w-4 h-4 text-muted-foreground" />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium">Invitato Livello 2</p>
                          <p className="text-xs text-muted-foreground">
                            Registrato il {new Date(ref.created_at).toLocaleDateString("it-IT")}
                          </p>
                        </div>
                        <Badge variant={ref.status === "active" ? "default" : "secondary"}>
                          {ref.status === "active" ? "Attivo" : ref.status}
                        </Badge>
                        <Badge variant="outline" className="text-xs">5%</Badge>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Commission History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <DollarSign className="w-4 h-4" />
            Storico Commissioni
          </CardTitle>
          <CardDescription>Tutte le commissioni guadagnate dal tuo network</CardDescription>
        </CardHeader>
        <CardContent>
          {commissions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <TrendingUp className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Le commissioni appariranno qui dopo il primo rinnovo dei tuoi invitati</p>
            </div>
          ) : (
            <div className="space-y-2">
              {commissions.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border"
                >
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="text-[10px]">
                      Lv{c.level}
                    </Badge>
                    <div>
                      <p className="text-sm font-medium">
                        Commissione {c.rate_percent}%
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(c.created_at).toLocaleDateString("it-IT")}
                        {c.period_start && c.period_end && (
                          <> · Periodo: {new Date(c.period_start).toLocaleDateString("it-IT")} — {new Date(c.period_end).toLocaleDateString("it-IT")}</>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`font-bold ${c.status === "paid" ? "text-green-600" : "text-foreground"}`}>
                      {(c.amount_cents / 100).toFixed(2)}€
                    </p>
                    <Badge
                      variant={c.status === "paid" ? "default" : "secondary"}
                      className="text-[10px]"
                    >
                      {c.status === "paid" ? "Pagato" : c.status === "pending" ? "In attesa" : c.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Rules */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Regolamento</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <span className="text-primary font-bold">•</span>
              Commissione del 5% su ogni rinnovo trimestrale dei tuoi invitati diretti (Livello 1)
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary font-bold">•</span>
              Commissione del 5% anche sui rinnovi degli invitati dai tuoi invitati (Livello 2)
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary font-bold">•</span>
              Massimo 2 livelli di profondità — nessuna catena infinita
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary font-bold">•</span>
              Le commissioni vengono calcolate automaticamente ad ogni rinnovo
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary font-bold">•</span>
              I pagamenti vengono accreditati mensilmente sul tuo metodo di pagamento
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary font-bold">•</span>
              La commissione è ricorrente finché l'invitato mantiene attivo l'abbonamento
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
